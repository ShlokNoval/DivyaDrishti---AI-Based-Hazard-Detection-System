import cv2
import numpy as np
import base64
from datetime import datetime
import torch
from ultralytics import YOLO
from ultralytics.nn.tasks import DetectionModel
from config import (
    CONF_THRESHOLD,
    CONF_THRESHOLD_NIGHT,
    NMS_THRESHOLD,
    POTHOLE_MODEL_PATH
)

# Fix for PyTorch 2.6+ WeightsUnpickler error (Monkeypatching)
import torch
_original_load = torch.load
def _hooked_load(*args, **kwargs):
    if 'weights_only' not in kwargs:
        kwargs['weights_only'] = False
    return _original_load(*args, **kwargs)
torch.load = _hooked_load

class Detector:
    def __init__(self, model_path, night_mode=False):
        self.model = YOLO(model_path)
        self.pothole_model = None
        import os
        if os.path.exists(POTHOLE_MODEL_PATH):
            try:
                self.pothole_model = YOLO(POTHOLE_MODEL_PATH)
                print(f"Loaded dedicated pothole model from {POTHOLE_MODEL_PATH}")
            except Exception as e:
                print(f"Failed to load pothole model: {e}")
                
        self.night_mode = night_mode
        self.conf_threshold = CONF_THRESHOLD_NIGHT if night_mode else CONF_THRESHOLD
        
        # Color definitions for OpenCV annotations (BGR format)
        self.colors = {
            'pothole': (0, 0, 255),       # Red
            'vehicle': (255, 0, 0),       # Blue
            'car': (255, 0, 0),
            'truck': (255, 0, 0),
            'motorcycle': (255, 0, 0),
            'bus': (255, 0, 0),
            'person': (0, 255, 255),      # Yellow
            'animal': (0, 165, 255),      # Orange
            'dog': (0, 165, 255),
            'cat': (0, 165, 255),
            'cow': (0, 165, 255),
            'horse': (0, 165, 255),
            'sheep': (0, 165, 255)
        }
        
        self.severity_colors = {
            'LOW': (0, 255, 0),       # Green
            'MEDIUM': (0, 165, 255),  # Orange
            'HIGH': (0, 0, 255)       # Red
        }

    def preprocess(self, frame: np.ndarray) -> np.ndarray:
        if not self.night_mode:
            return frame
        
        # 1. Convert BGR -> LAB
        lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        
        # 2. Apply CLAHE to L channel: clip_limit=2.0, tile_grid=(8,8)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        cl = clahe.apply(l)
        
        # 3. Merge LAB -> BGR
        limg = cv2.merge((cl, a, b))
        enhanced_bgr = cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)
        
        # 4. Gamma correction: I_out = I_in ^ (1/0.5) for night
        gamma = 0.5
        inv_gamma = 1.0 / gamma
        table = np.array([((i / 255.0) ** inv_gamma) * 255 for i in np.arange(0, 256)]).astype("uint8")
        gamma_corrected = cv2.LUT(enhanced_bgr, table)
        
        # 5. Denoise
        denoised = cv2.fastNlMeansDenoisingColored(gamma_corrected, None, h=10, hColor=10, templateWindowSize=7, searchWindowSize=21)
        return denoised

    def detect(self, frame: np.ndarray) -> list:
        # Run YOLO inference
        results = self.model(frame, conf=self.conf_threshold, iou=NMS_THRESHOLD, verbose=False)
        detections = []
        
        img_h, img_w = frame.shape[:2]
        
        def process_results(results_obj, default_class_name=None):
            if not results_obj:
                return
            result = results_obj[0]
            for box in result.boxes:
                conf = float(box.conf[0])
                if conf < self.conf_threshold:
                    continue
                    
                class_id = int(box.cls[0])
                
                # If we have a dedicated class name (like from the pothole model), use it.
                if default_class_name:
                    class_name = default_class_name
                else:
                    class_name = result.names[class_id]
                
                # Extract xyxy and convert to normalized xywh format manually to ensure pure math matching the doc
                x1, y1, x2, y2 = map(float, box.xyxy[0])
                
                x, y = x1, y1
                w, h = x2 - x1, y2 - y1
                
                x_norm = x / img_w
                y_norm = y / img_h
                w_norm = w / img_w
                h_norm = h / img_h
                
                area_norm = (w * h) / (img_w * img_h)
                
                detections.append({
                    'class_name': class_name,
                    'class_id': class_id,
                    'confidence': conf,
                    'bbox': [x, y, w, h],         # top-left x, y and width, height
                    'bbox_norm': [x_norm, y_norm, w_norm, h_norm],
                    'area_norm': area_norm
                })

        process_results(results)
        
        # If pothole model is loaded, run it as well
        if self.pothole_model:
            pothole_results = self.pothole_model(frame, conf=self.conf_threshold, iou=NMS_THRESHOLD, verbose=False)
            process_results(pothole_results, default_class_name='pothole')
            
        return detections

    def annotate(self, frame: np.ndarray, detections: list, track_ids: dict, severity_map: dict) -> np.ndarray:
        annotated_frame = frame.copy()
        
        # Draw timestamp top-left in white
        timestamp_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cv2.putText(annotated_frame, timestamp_str, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
        
        for idx, det in enumerate(detections):
            x, y, w, h = map(int, det['bbox'])
            class_name = det['class_name']
            conf = det['confidence']
            
            # Try to get generic color group or specific color
            color = self.colors.get(class_name, (255, 255, 255))
            
            # Map object to specific category color for UI
            if class_name in ['car', 'truck', 'motorcycle', 'bus']:
                color = self.colors['vehicle']
            elif class_name in ['dog', 'cat', 'cow', 'horse', 'sheep']:
                color = self.colors['animal']
            
            # 1. Bounding box
            cv2.rectangle(annotated_frame, (x, y), (x + w, y + h), color, 2)
            
            # Track ID info (track_ids might map idx or bounding box to ID, depending on inputs. Assume indexed or list for now)
            # Generally tracking assigns a single ID to each bounding box.
            track_id = track_ids.get(idx, 'Unknown')
            track_text = f"ID: {track_id}"
            
            # 2. Draw Track ID in Cyan above box
            cv2.putText(annotated_frame, track_text, (x, max(10, y - 25)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2)  # Cyan in BGR is (255,255,0)
            
            # 3. Draw severity tag (filled rect + text)
            severity = severity_map.get(idx, 'LOW')
            bg_color = self.severity_colors.get(severity, (0, 255, 0))
            label_text = f" {class_name} | {conf:.2f} "
            
            (text_w, text_h), baseline = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 1)
            cv2.rectangle(annotated_frame, (x, y - text_h - 5), (x + text_w, y), bg_color, -1)
            cv2.putText(annotated_frame, label_text, (x, y - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
            
            # Note: the prompt asks to draw confidence "below label in white small text"
            # Since I combined it above, I'll draw it strictly below the label if I want to perfectly match
            cv2.putText(annotated_frame, f"Conf: {conf:.2f}", (x, y + 15), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
            
        return annotated_frame

    def frame_to_base64(self, frame: np.ndarray) -> str:
        _, buffer = cv2.imencode('.jpg', frame)
        return base64.b64encode(buffer).decode('utf-8')
