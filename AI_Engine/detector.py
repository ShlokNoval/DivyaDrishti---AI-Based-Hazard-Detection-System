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
        self.animal_model = None
        import os
        if os.path.exists(POTHOLE_MODEL_PATH):
            try:
                self.pothole_model = YOLO(POTHOLE_MODEL_PATH)
                print(f"Loaded dedicated pothole model from {POTHOLE_MODEL_PATH}")
            except Exception as e:
                print(f"Failed to load pothole model: {e}")

        ANIMAL_MODEL_PATH = "yolov8_animal.pt"
        if os.path.exists(ANIMAL_MODEL_PATH):
            try:
                self.animal_model = YOLO(ANIMAL_MODEL_PATH)
                print(f"Loaded fine-tuned animal model from {ANIMAL_MODEL_PATH}")
            except Exception as e:
                print(f"Failed to load animal model: {e}")
                
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
        
        # If pothole model is loaded, run it with balanced conf=0.28 to catch genuine potholes without plain road noise
        if self.pothole_model:
            pothole_results_raw = self.pothole_model(frame, conf=0.28, iou=0.35, verbose=False)
            process_results(pothole_results_raw, default_class_name='pothole')
            
        # If fine-tuned animal model is loaded, run it as well
        if self.animal_model:
            animal_results = self.animal_model(frame, conf=self.conf_threshold, iou=NMS_THRESHOLD, verbose=False)
            process_results(animal_results)

        # -------------------------------------------------------------------------
        # CROSS-MODEL NMS & OVERLAP DEDUPLICATION
        # -------------------------------------------------------------------------
        ANIMAL_CLASSES = {'dog', 'cat', 'cow', 'horse', 'sheep', 'animal'}
        VEHICLE_CLASSES = {'car', 'truck', 'motorcycle', 'bus', 'bicycle', 'train', 'vehicle'}
        NON_POTHOLE_CLASSES = ANIMAL_CLASSES | VEHICLE_CLASSES | {'person'}
        
        # 1. Normalize exotic / misclassified COCO animal labels (elephant, bear, zebra, horse, sheep)
        EXOTIC_ANIMAL_MAP = {'elephant', 'bear', 'zebra', 'giraffe', 'sheep', 'horse'}
        for det in detections:
            cname = str(det['class_name']).lower()
            if cname in EXOTIC_ANIMAL_MAP:
                if det['area_norm'] > 0.45:
                    det['class_name'] = 'cow'
                    det['class_id'] = 19
                else:
                    det['class_name'] = 'dog'
                    det['class_id'] = 16

        # 2. Separate pothole candidates vs non-pothole candidates
        non_pothole_dets = [d for d in detections if str(d['class_name']).lower() != 'pothole']
        pothole_dets = [d for d in detections if str(d['class_name']).lower() == 'pothole']

        def compute_iou(box1, box2):
            x1, y1, w1, h1 = box1
            x2, y2, w2, h2 = box2
            ix1, iy1 = max(x1, x2), max(y1, y2)
            ix2, iy2 = min(x1 + w1, x2 + w2), min(y1 + h1, y2 + h2)
            if ix2 <= ix1 or iy2 <= iy1:
                return 0.0
            inter = (ix2 - ix1) * (iy2 - iy1)
            union = (w1 * h1) + (w2 * h2) - inter
            return inter / union if union > 0 else 0.0

        def pothole_overlaps_entity(p_box, entity_det):
            x1, y1, w1, h1 = p_box
            entity_box = entity_det['bbox']
            entity_class = str(entity_det['class_name']).lower()
            
            x2, y2, w2, h2 = entity_box
            ix1, iy1 = max(x1, x2), max(y1, y2)
            ix2, iy2 = min(x1 + w1, x2 + w2), min(y1 + h1, y2 + h2)
            if ix2 <= ix1 or iy2 <= iy1:
                return False
            inter = (ix2 - ix1) * (iy2 - iy1)
            p_area = w1 * h1
            
            # Vehicles: STRICT suppression (no potholes on top of cars/trucks)
            if entity_class in VEHICLE_CLASSES:
                return (p_area > 0 and inter / p_area > 0.10) or compute_iou(p_box, entity_box) > 0.05
                
            # Animals / Persons: Drop if significantly covered
            return (p_area > 0 and inter / p_area > 0.35) or compute_iou(p_box, entity_box) > 0.20

        # Filter potholes against cars/animals/persons and keep conf >= 0.28
        pothole_dets.sort(key=lambda d: d['confidence'], reverse=True)
        filtered_potholes = []
        for p in pothole_dets:
            overlaps = False
            for np_det in non_pothole_dets:
                if pothole_overlaps_entity(p['bbox'], np_det):
                    overlaps = True
                    break
            if not overlaps and p['confidence'] >= 0.28:
                # Check duplicate potholes
                dup_pothole = False
                for kept_p in filtered_potholes:
                    if compute_iou(p['bbox'], kept_p['bbox']) > 0.30:
                        dup_pothole = True
                        break
                if not dup_pothole:
                    filtered_potholes.append(p)

        # 3. Apply NMS across non-pothole detections to deduplicate overlapping animal boxes
        non_pothole_dets.sort(key=lambda d: d['confidence'], reverse=True)
        keep_non_potholes = []
        for d in non_pothole_dets:
            duplicate = False
            for kept in keep_non_potholes:
                if compute_iou(d['bbox'], kept['bbox']) > 0.35:
                    duplicate = True
                    break
            if not duplicate:
                keep_non_potholes.append(d)

        final_detections = keep_non_potholes + filtered_potholes
        return final_detections

    def annotate(self, frame: np.ndarray, detections: list, track_ids: dict, severity_map: dict) -> np.ndarray:
        annotated_frame = frame.copy()
        
        # Draw timestamp top-left in white
        timestamp_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cv2.putText(annotated_frame, timestamp_str, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
        
        for idx, det in enumerate(detections):
            x, y, w, h = map(int, det['bbox'])
            class_name = str(det['class_name']).lower()
            conf = det['confidence']
            
            # Distinct vibrant category colors for crisp bounding boxes (BGR)
            if class_name in ['dog', 'stray dog']:
                color = (0, 165, 255)       # Bright Orange
                display_label = "DOG"
            elif class_name in ['cow', 'cattle', 'bull', 'buffalo']:
                color = (50, 205, 50)      # Emerald Green
                display_label = "COW"
            elif class_name in ['cat']:
                color = (255, 255, 0)      # Cyan
                display_label = "CAT"
            elif class_name in ['horse']:
                color = (211, 85, 186)     # Purple / Magenta
                display_label = "HORSE"
            elif class_name in ['person', 'human']:
                color = (255, 191, 0)     # Amber
                display_label = "PERSON"
            elif class_name in ['car', 'truck', 'motorcycle', 'bus', 'vehicle']:
                color = (255, 144, 30)    # Deep Sky Blue
                display_label = class_name.upper()
            elif class_name == 'pothole':
                color = (0, 0, 255)        # Bright Red
                display_label = "POTHOLE"
            else:
                color = (0, 255, 255)      # Yellow
                display_label = class_name.upper()
            
            # 1. Draw crisp bounding box with corner accents
            cv2.rectangle(annotated_frame, (x, y), (x + w, y + h), color, 2)
            
            # 2. Extract track ID and severity
            track_id = track_ids.get(idx, '0')
            severity = severity_map.get(idx, 'LOW')
            bg_color = self.severity_colors.get(severity, (0, 200, 0))
            
            # 3. Unified non-overlapping tag header
            label_text = f" {display_label} #{track_id} | {severity} | {conf*100:.0f}% "
            font_scale = 0.5
            font_thick = 1
            (text_w, text_h), baseline = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, font_scale, font_thick)
            
            # Position tag above box, or just inside top if near frame boundary
            if y - text_h - 10 < 0:
                tag_y1 = y
                tag_y2 = y + text_h + 10
                text_y = y + text_h + 5
            else:
                tag_y1 = y - text_h - 10
                tag_y2 = y
                text_y = y - 4
                
            # Draw badge background fill and matching border
            cv2.rectangle(annotated_frame, (x, tag_y1), (x + text_w + 8, tag_y2), bg_color, -1)
            cv2.rectangle(annotated_frame, (x, tag_y1), (x + text_w + 8, tag_y2), color, 1)
            # Draw crisp text inside badge
            cv2.putText(annotated_frame, label_text, (x + 4, text_y), cv2.FONT_HERSHEY_SIMPLEX, font_scale, (255, 255, 255), font_thick, cv2.LINE_AA)
            
        return annotated_frame

    def frame_to_base64(self, frame: np.ndarray) -> str:
        _, buffer = cv2.imencode('.jpg', frame)
        return base64.b64encode(buffer).decode('utf-8')
