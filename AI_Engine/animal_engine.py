import cv2
import numpy as np
from config import ANIMAL_WEIGHTS, BEHAVIOR_WEIGHTS, PROXIMITY_WEIGHTS, V_THRESH_HIGH, V_THRESH_LOW, SEVERITY_LOW, SEVERITY_HIGH

class AnimalEngine:
    def __init__(self, projection_horizon=30):
        # How many frames into the future to project the animal's path
        self.projection_horizon = projection_horizon

    def compute_trajectory_vector(self, centroid_history: list) -> tuple:
        """ Calculates the smoothed (dx, dy) directional vector per frame across recent centroids. """
        if not centroid_history or len(centroid_history) < 2:
            return (0.0, 0.0)
            
        recent = centroid_history[-min(5, len(centroid_history)):]
        c1 = recent[0]
        c2 = recent[-1]
        steps = len(recent) - 1
        
        dx = (c2[0] - c1[0]) / steps
        dy = (c2[1] - c1[1]) / steps
        return (dx, dy)

    def classify_behavior_and_predict(self, centroid: tuple, velocity_px: float, centroid_history: list, road_boundary_polygon: list) -> tuple:
        """
        Returns (behavior_label, predicted_road_entry_in_frames).
        """
        predicted_frames = None
        behavior = 'STATIONARY'

        # 1. High-speed check
        if velocity_px > V_THRESH_HIGH:
            behavior = 'RUNNING'
        elif velocity_px > V_THRESH_LOW:
            behavior = 'MOVING'

        # 2. Predictive crossing check (Trajectory Projection)
        if road_boundary_polygon is not None and velocity_px > 0:
            dx, dy = self.compute_trajectory_vector(centroid_history)
            poly = np.array(road_boundary_polygon, dtype=np.int32)
            
            # Predict position frame-by-frame up to the horizon
            for t in range(1, self.projection_horizon + 1):
                projected_x = centroid[0] + dx * t
                projected_y = centroid[1] + dy * t
                projected_pt = (float(projected_x), float(projected_y))
                
                # Check if projected point is inside the road polygon
                dist = cv2.pointPolygonTest(poly, projected_pt, measureDist=False)
                if dist >= 0:
                    behavior = 'CROSSING'
                    predicted_frames = t
                    break
                    
        return behavior, predicted_frames

    def classify_proximity(self, centroid: tuple, road_boundary_polygon: list, img_h: int) -> str:
        y = centroid[1]
        
        if road_boundary_polygon is None:
            # Fallback horizontal mapping assuming road is bottom 40%
            if y > (img_h * 0.6): 
                return 'on_road'
            elif y > (img_h * 0.4):
                return 'approaching'
            else:
                return 'roadside'
        
        poly = np.array(road_boundary_polygon, dtype=np.int32)
        dist = cv2.pointPolygonTest(poly, centroid, measureDist=True)
        
        if dist >= 0:
            return 'on_road'
        elif -50 < dist < 0:
            return 'approaching'
        else:
            return 'roadside'

    def compute_score(self, detection: dict, velocity_px: float, centroid_history: list, road_boundary_polygon: list, img_w: int, img_h: int) -> dict:
        C = detection.get('confidence', 0.0)
        
        x, y, w, h = detection['bbox']
        centroid = (x + w/2, y + h/2)
        
        # Determine behavior and projection mathematically
        behavior, pred_frames = self.classify_behavior_and_predict(centroid, velocity_px, centroid_history, road_boundary_polygon)
        proximity = self.classify_proximity(centroid, road_boundary_polygon, img_h)
        
        B_weight = BEHAVIOR_WEIGHTS.get(behavior, 0.2)
        P_road = PROXIMITY_WEIGHTS.get(proximity, 0.3)
        V_norm = min(1.0, velocity_px / img_w)
        
        # Calculate Risk Score
        RS = (ANIMAL_WEIGHTS['conf'] * C +
              ANIMAL_WEIGHTS['proximity'] * P_road +
              ANIMAL_WEIGHTS['behavior'] * B_weight +
              ANIMAL_WEIGHTS['velocity'] * V_norm) * 100
              
        # Overrides: if CROSSING imminent (< 10 frames), spike risk
        if behavior == 'CROSSING' and pred_frames is not None and pred_frames < 10:
            RS = max(RS, 85.0)

        if RS <= SEVERITY_LOW:
            label = 'LOW'
        elif RS < SEVERITY_HIGH:
            label = 'MEDIUM'
        else:
            label = 'HIGH'
            
        return {
            'risk_score': round(RS, 2),
            'risk_label': label,
            'behavior': behavior,
            'proximity': proximity,
            'velocity_px': round(velocity_px, 2),
            'predicted_road_entry_in_frames': pred_frames
        }

    def should_alert(self, risk_label: str, centroid_history: list = None) -> bool:
        if risk_label not in ('MEDIUM', 'HIGH'):
            return False
            
        # Feature 7: Temporal Confirmation (Accuracy Boost)
        # A YOLO detection must exist consistently for at least 3 frames
        # This prevents 1-frame glitches/shadows from triggering a false 'HIGH' alert
        if centroid_history is not None and len(centroid_history) < 3:
            return False
            
        return True
