import collections
import numpy as np
from config import DMAX_TRACKING

def get_class_group(class_name: str) -> str:
    c = str(class_name).lower()
    if c in {'dog', 'cat', 'cow', 'horse', 'sheep', 'bird', 'bear', 'elephant', 'zebra', 'giraffe', 'animal'}:
        return 'animal'
    if c in {'car', 'truck', 'motorcycle', 'bus', 'bicycle', 'train', 'boat', 'vehicle'}:
        return 'vehicle'
    if c in {'person'}:
        return 'person'
    if c in {'pothole'}:
        return 'pothole'
    return c

class CentroidTracker:
    def __init__(self, D_max=DMAX_TRACKING, max_disappeared=18):
        self.D_max = D_max
        self.max_disappeared = max_disappeared
        self.next_track_id = 0
        self.objects = {}
        self.disappeared = {}
        self.history = collections.defaultdict(list)
        self.class_history = collections.defaultdict(list)

    def register(self, centroid, det):
        self.class_history[self.next_track_id].append(det['class_name'])
        self.objects[self.next_track_id] = {
            'centroid': centroid,
            'bbox': det['bbox'],
            'class_name': det['class_name']
        }
        self.disappeared[self.next_track_id] = 0
        self.history[self.next_track_id].append(centroid)
        self.next_track_id += 1

    def deregister(self, track_id):
        if track_id in self.objects:
            del self.objects[track_id]
        if track_id in self.disappeared:
            del self.disappeared[track_id]
        if track_id in self.history:
            del self.history[track_id]
        if track_id in self.class_history:
            del self.class_history[track_id]

    def update(self, detections: list) -> dict:
        if len(detections) == 0:
            for track_id in list(self.disappeared.keys()):
                self.disappeared[track_id] += 1
                if self.disappeared[track_id] > self.max_disappeared:
                    self.deregister(track_id)
            return self.objects

        input_centroids = np.zeros((len(detections), 2), dtype="int")
        for i, det in enumerate(detections):
            x, y, w, h = det['bbox']
            input_centroids[i] = (int(x + w / 2), int(y + h / 2))

        if len(self.objects) == 0:
            for i in range(0, len(input_centroids)):
                self.register(input_centroids[i], detections[i])
        else:
            object_ids = list(self.objects.keys())
            object_centroids = [self.objects[track_id]['centroid'] for track_id in object_ids]
            
            D = np.linalg.norm(np.array(object_centroids)[:, np.newaxis] - input_centroids, axis=2)
            
            # Apply class-group matching penalty to prevent cross-class ID swapping
            for r, track_id in enumerate(object_ids):
                obj_group = get_class_group(self.objects[track_id]['class_name'])
                for c, det in enumerate(detections):
                    det_group = get_class_group(det['class_name'])
                    if obj_group != det_group:
                        D[r, c] += 100000.0  # Massive penalty for different class groups

            rows = D.min(axis=1).argsort()
            cols = D.argmin(axis=1)[rows]

            used_rows = set()
            used_cols = set()

            for (row, col) in zip(rows, cols):
                if row in used_rows or col in used_cols:
                    continue
                
                # Dynamic D_max thresholding based on bounding box size
                bw, bh = detections[col]['bbox'][2], detections[col]['bbox'][3]
                effective_dmax = max(self.D_max, 0.4 * max(bw, bh))

                if D[row, col] > effective_dmax:
                    continue

                track_id = object_ids[row]
                self.objects[track_id]['centroid'] = input_centroids[col]
                self.objects[track_id]['bbox'] = detections[col]['bbox']
                
                # Record class history and use majority voting to prevent label flickering (e.g. dog <-> cow)
                self.class_history[track_id].append(detections[col]['class_name'])
                hist_classes = self.class_history[track_id][-min(10, len(self.class_history[track_id])):]
                most_frequent_class = max(set(hist_classes), key=hist_classes.count)
                self.objects[track_id]['class_name'] = most_frequent_class
                
                self.disappeared[track_id] = 0
                self.history[track_id].append(input_centroids[col])
                
                used_rows.add(row)
                used_cols.add(col)

            unused_rows = set(range(0, D.shape[0])).difference(used_rows)
            unused_cols = set(range(0, D.shape[1])).difference(used_cols)

            for row in unused_rows:
                track_id = object_ids[row]
                self.disappeared[track_id] += 1
                if self.disappeared[track_id] > self.max_disappeared:
                    self.deregister(track_id)
                    
            for col in unused_cols:
                self.register(input_centroids[col], detections[col])

        for track_id in list(self.objects.keys()):
            self.objects[track_id]['velocity_px'] = self.get_velocity(track_id)

        return self.objects

    def get_velocity(self, track_id, frame_interval=1) -> float:
        hist = self.history.get(track_id, [])
        if len(hist) < 2:
            return 0.0
        # Use smoothed displacement across up to 5 historical centroids
        recent = hist[-min(5, len(hist)):]
        c1 = recent[0]
        c2 = recent[-1]
        steps = len(recent) - 1
        dist = np.linalg.norm(np.array(c2) - np.array(c1))
        return float(dist / (steps * frame_interval))

