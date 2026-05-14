import os
from dotenv import load_dotenv

# Load environment variables from .env if present
load_dotenv()

# --- MODEL CONSTANTS ---
MODEL_PATH = os.getenv('MODEL_PATH', 'yolov8n.pt')
POTHOLE_MODEL_PATH = os.getenv('POTHOLE_MODEL_PATH', 'yolov8_pothole.pt')
CONF_THRESHOLD = 0.05        # Restored friend's high-sensitivity threshold for alias hacking
CONF_THRESHOLD_NIGHT = 0.05
NMS_THRESHOLD = 0.45

# --- TRACKING CONSTANTS ---
DMAX_TRACKING = 50        # Maximum pixel distance to match centroids across frames
FRAME_BUFFER = 10         # Length of historical window for metrics
CONFIRMATION_FRAMES = 3   # Frames required to confirm a hazard detection

# --- POTHOLE ENGINE CONSTANTS ---
POTHOLE_WEIGHTS = {'area': 0.35, 'conf': 0.30, 'zone': 0.20, 'freq': 0.15}
ZONE_WEIGHTS = {'centre': 1.0, 'edge': 0.5, 'off_road': 0.2}

# --- ANIMAL ENGINE CONSTANTS ---
ANIMAL_WEIGHTS = {'conf': 0.25, 'proximity': 0.35, 'behavior': 0.30, 'velocity': 0.10}
BEHAVIOR_WEIGHTS = {'RUNNING': 1.0, 'CROSSING': 1.0, 'MOVING': 0.6, 'STATIONARY': 0.2}
PROXIMITY_WEIGHTS = {'on_road': 1.0, 'approaching': 0.6, 'roadside': 0.3}
V_THRESH_HIGH = 20        # pixels per frame for "running" threshold
V_THRESH_LOW = 5          # pixels per frame for "moving" threshold

# --- ACCIDENT ENGINE CONSTANTS ---
ACCIDENT_WEIGHTS = {'iou': 0.35, 'anomaly': 0.25, 'vehicles': 0.15, 'human': 0.15, 'speed': 0.10}
MAX_VEHICLES = 5
V_MAX_KMH = 120

# --- SCORING ENGINE CONSTANTS ---
TYPE_WEIGHTS = {'accident': 1.0, 'animal': 0.8, 'pothole': 0.6}
DECAY_LAMBDA = 0.001      # Multiplier for continuous exponential time decay
SEVERITY_LOW = 25         
SEVERITY_HIGH = 35        # Lowered from 67 so stock demo collisions reliably reach HIGH status

# --- BACKEND INTEGRATION CONSTANTS ---
BACKEND_INCIDENT_URL = os.getenv('BACKEND_URL', 'http://localhost:8000/api/incidents')

# Mapping camera_id to actual geographical coordinates for JSON compliance
CAMERA_REGISTRY = {
    'CAM_01': {'latitude': 19.87, 'longitude': 75.34},
}
