import cv2
import os
import numpy as np
from datetime import datetime

from detector import Detector
from tracking import CentroidTracker
from pothole_engine import PotholeEngine
from accident_engine import AccidentEngine
from animal_engine import AnimalEngine
from config import MODEL_PATH, SEVERITY_HIGH

# Directory for alert snapshot images
SNAPSHOT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'snapshots')
os.makedirs(SNAPSHOT_DIR, exist_ok=True)

class AIPipeline:
    def __init__(self, model_path=MODEL_PATH):
        self.detector = Detector(model_path=model_path)
        self.tracker = CentroidTracker()
        self.pothole_engine = PotholeEngine()
        self.accident_engine = AccidentEngine()
        self.animal_engine = AnimalEngine()
        
        # State mapping camera_id to prev_frame for AccidentEngine optical flow
        self.prev_frames = {}
        self.frame_counts = {}

    def process_frame(self, frame, camera_id="default", source="live"):
        if camera_id not in self.frame_counts:
            self.frame_counts[camera_id] = 0
            
        self.frame_counts[camera_id] += 1
        frame_num = self.frame_counts[camera_id]
        img_h, img_w = frame.shape[:2]

        # 1. Detection
        detections = self.detector.detect(frame)
        
        # 2. Tracking 
        track_objects = self.tracker.update(detections)
        
        # Build enriched detections combining YOLO metadata with tracker persistent IDs
        enriched_detections = []
        
        VEHICLE_CLASSES = frozenset({'car', 'truck', 'motorcycle', 'bus', 'bicycle', 'train', 'boat'})
        ANIMAL_CLASSES  = frozenset({'dog', 'cat', 'cow', 'horse', 'sheep', 'bird', 'bear', 'elephant', 'zebra', 'giraffe'})
        PERSON_CLASSES  = frozenset({'person'})
        EXCLUDE_FROM_ALIAS = VEHICLE_CLASSES | PERSON_CLASSES | ANIMAL_CLASSES
        
        # Collect vehicle bounding boxes so we can do a spatial overlap check
        vehicle_bboxes = [d['bbox'] for d in detections if d['class_name'] in VEHICLE_CLASSES]
        
        def overlaps_vehicle(bbox):
            """Returns True if bbox significantly overlaps any vehicle bbox."""
            x1, y1, w1, h1 = bbox
            for vx, vy, vw, vh in vehicle_bboxes:
                # Compute intersection
                ix1 = max(x1, vx)
                iy1 = max(y1, vy)
                ix2 = min(x1 + w1, vx + vw)
                iy2 = min(y1 + h1, vy + vh)
                if ix2 > ix1 and iy2 > iy1:
                    intersection = (ix2 - ix1) * (iy2 - iy1)
                    area = w1 * h1
                    if area > 0 and intersection / area > 0.3:  # 30% overlap threshold
                        return True
            return False
        
        for det in detections:
            det_bbox = tuple(det['bbox'])
            mapped_track_id = None
            velocity_px = 0.0
            t_id_int = -1
            
            for t_id, t_info in track_objects.items():
                if tuple(t_info['bbox']) == det_bbox:
                    mapped_track_id = str(t_id)
                    t_id_int = t_id
                    velocity_px = t_info.get('velocity_px', 0.0)
                    break
                    
            if mapped_track_id is None:
                mapped_track_id = "unk"
                
            det['track_id'] = mapped_track_id
            det['velocity_px'] = velocity_px
            
            # --- POTHOLE ALIAS (RESTORED FRIEND'S LOGIC) ---
            # Alias low-confidence, stationary, road-surface objects as potholes.
            # Only apply this for uploaded dashcam footage, not live indoor phone streams.
            if (source == "upload"
                    and det['confidence'] < 0.26
                    and det['velocity_px'] < 3.0
                    and det['class_name'] not in EXCLUDE_FROM_ALIAS
                    and not overlaps_vehicle(det['bbox'])):
                x, y, w, h = det['bbox']
                if y > img_h * 0.30:   # Friend's original zone
                    det['class_name'] = 'pothole'
                    det['confidence'] = 0.85
                    det['area_norm'] = 0.7
            
            det['class'] = det['class_name']
            enriched_detections.append(det)

        # -----------------------------------------------------------------------
        # ISOLATED ENGINE CONFIDENCE THRESHOLDS (FRIEND'S SENSITIVITY)
        # -----------------------------------------------------------------------
        VEHICLE_MIN_CONF = 0.40   
        PERSON_MIN_CONF  = 0.40   
        ANIMAL_MIN_CONF  = 0.30   

        # Trusted-class filtered views — only real, confident detections
        trusted_vehicles = [
            d for d in enriched_detections
            if d['class'] in VEHICLE_CLASSES and d['confidence'] >= VEHICLE_MIN_CONF
        ]
        trusted_persons = [
            d for d in enriched_detections
            if d['class'] in PERSON_CLASSES and d['confidence'] >= PERSON_MIN_CONF
        ]
        trusted_animals = [
            d for d in enriched_detections
            if d['class'] in ANIMAL_CLASSES and d['confidence'] >= ANIMAL_MIN_CONF
        ]
        trusted_potholes = [
            d for d in enriched_detections
            if d['class'] == 'pothole'
        ]

        # Accident engine receives ONLY trusted vehicles + persons, not noise
        accident_detections = trusted_vehicles + trusted_persons
        
        # Only visible detections are drawn on screen. This entirely stops the UI bug
        # where "anything is being detected" since 5% confidence noise is not rendered.
        visible_detections = trusted_vehicles + trusted_persons + trusted_animals + trusted_potholes


        track_severities = {}
        all_incidents = []

        # 3. Cross-Engine Evaluation
        # --- Accident Engine ---
        prev_frame = self.prev_frames.get(camera_id)
        M_anomaly = 0.0
        if prev_frame is not None:
            M_anomaly = self.accident_engine.compute_optical_flow(prev_frame, frame, camera_id)
            
        accident_result = self.accident_engine.compute_score(
            accident_detections, M_anomaly, img_w, img_h, camera_id, frame_num
        )
        
        hit_and_run_detected = False
        hit_and_run_tracks = []
        for det in trusted_vehicles:
            if self.accident_engine.detect_hit_and_run(camera_id, det['track_id'], frame_num):
                hit_and_run_detected = True
                hit_and_run_tracks.append(det['track_id'])
                    
        # Hit & run manual severity spike override natively ported
        if hit_and_run_detected and accident_result['severity_score'] < SEVERITY_HIGH:
            accident_result['severity_score'] = min(100, accident_result['severity_score'] + 20)
            if accident_result['severity_score'] >= SEVERITY_HIGH:
                accident_result['severity_label'] = 'HIGH'

        accident_bbox = [0, 0, img_w // 2, img_h // 2]
        accident_conf = 0.8
        for det in trusted_vehicles:
            accident_bbox = det['bbox']
            accident_conf = det['confidence']
            break

        accident_result['bbox'] = accident_bbox
        accident_result['confidence'] = accident_conf

        # Only alert for accidents if MULTIPLE trusted vehicles are present.
        # trusted_vehicles already filtered to conf >= 0.40, so ghost detections
        # cannot inflate this count.
        has_multiple_vehicles = len(trusted_vehicles) >= 2

        if (has_multiple_vehicles and 
            self.accident_engine.should_alert(accident_result['severity_label']) and
            not self.accident_engine._is_duplicate_incident(camera_id, accident_bbox, frame_num)):
            
            # Record this incident to prevent duplicates in next 90 frames
            self.accident_engine.record_incident(camera_id, accident_bbox, frame_num)
            
            all_incidents.append({
                'type': 'accident',
                'camera_id': camera_id,
                'frame': frame_num,
                'severity': accident_result['severity_label'],
                'data': accident_result
            })
            # Map all vehicle tracks to this severity for UI annotation
            for det in trusted_vehicles:
                track_severities[det['track_id']] = accident_result['severity_label']

        # --- Pothole Engine (iterates ONLY over trusted potholes) ---
        for det in trusted_potholes:
            cls_name = det['class']
            t_id = det['track_id']
            
            if cls_name == 'pothole':
                score_info = self.pothole_engine.compute_score(det, img_w, img_h, camera_id, t_id)
                self.pothole_engine.update_lifecycle(camera_id, t_id, score_info['A_norm'])
                score_info['bbox'] = det['bbox']
                
                track_severities[t_id] = score_info['severity_label']
                if self.pothole_engine.should_alert(score_info['severity_label']):
                    score_info['track_id'] = str(t_id) # Attach track_id for backend deduplication
                    all_incidents.append({
                        'type': 'pothole',
                        'camera_id': camera_id,
                        'frame': frame_num,
                        'severity': score_info['severity_label'],
                        'data': score_info
                    })

        # --- Animal Engine (iterates ONLY trusted_animals — conf >= 0.30) ---
        # This prevents ghost animal detections in pothole/accident-only videos
        # from generating false animal alerts.
        for det in trusted_animals:
            t_id = det['track_id']
            t_id_int = int(t_id) if t_id.isdigit() else t_id
            centroid_history = self.tracker.history.get(t_id_int, [])
            
            score_info = self.animal_engine.compute_score(
                det, det['velocity_px'], centroid_history, None, img_w, img_h
            )
            
            score_info['bbox'] = det['bbox']
            
            track_severities[t_id] = score_info['risk_label']
            if (self.animal_engine.should_alert(score_info['risk_label'], centroid_history) and
                not self.accident_engine._is_duplicate_incident(camera_id, det['bbox'], frame_num, threshold_distance=80)):
                
                # Record this animal incident
                self.accident_engine.record_incident(camera_id, det['bbox'], frame_num)
                
                score_info['track_id'] = str(t_id) # Attach track_id for backend deduplication
                all_incidents.append({
                    'type': 'animal',
                    'camera_id': camera_id,
                    'frame': frame_num,
                    'severity': score_info['risk_label'],
                    'data': score_info
                })

        self.prev_frames[camera_id] = frame.copy()
        
        # 4. Annotation Routing (ONLY draw objects we care about)
        track_ids_idx = {}
        severity_map_idx = {}
        for idx, det in enumerate(visible_detections):
            t_id = det['track_id']
            track_ids_idx[idx] = t_id
            severity_map_idx[idx] = track_severities.get(t_id, 'LOW')

        annotated_frame = self.detector.annotate(frame, visible_detections, track_ids_idx, severity_map_idx)
        
        # 5. Snapshot Capture — save annotated frame at alert time for admin dashboard
        if all_incidents:
            for inc in all_incidents:
                ts = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
                snap_name = f"{camera_id}_{inc['type']}_{inc['severity']}_{ts}.jpg"
                snap_path = os.path.join(SNAPSHOT_DIR, snap_name)
                try:
                    cv2.imwrite(snap_path, annotated_frame)
                    inc['data']['snapshot_path'] = snap_path
                    inc['data']['snapshot_filename'] = snap_name
                except Exception as e:
                    print(f"[Snapshot] Failed to save {snap_name}: {e}")
        
        return annotated_frame, all_incidents
