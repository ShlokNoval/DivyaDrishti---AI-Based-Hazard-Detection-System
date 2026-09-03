import os
import cv2
import uuid
import time
import base64
import numpy as np
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, BackgroundTasks, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pipeline import AIPipeline
from config import BACKEND_INCIDENT_URL
import httpx

app = FastAPI(title="AI Analysis Engine API")

# Setup CORS to allow UI (Shlok's Frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "*"],  # Ngrok wildcard
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Engine Singletons
pipeline = None

@app.on_event("startup")
async def startup_event():
    global pipeline
    pipeline = AIPipeline()
    print("AI Analysis Engine started - Unified Pipeline & YOLOv8 model loaded.")

async def send_incident_to_backend(payload: dict):
    # This matches JJ's required interface natively with JSON
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                BACKEND_INCIDENT_URL,
                json=payload,
                headers={"Authorization": "Bearer YOUR_TOKEN_HERE"}
            )
            print(f"Post to Backend returned: {response.status_code}")
    except Exception as e:
        print(f"Failed to post incident: {e}")

@app.websocket("/ws/stream/{camera_id}")
async def websocket_stream(websocket: WebSocket, camera_id: str):
    await websocket.accept()
    print(f"WebSocket connected for {camera_id}")
    try:
        while True:
            try:
                data = await websocket.receive_json()
                print(f"Received frame from JS at timestamp: {data.get('timestamp')}")
                # Expecting fields: frame (base64_jpeg), timestamp (float)
                
                # Fix javascript base64 padding issues
                b64_str = data['frame']
                b64_str += "=" * ((4 - len(b64_str) % 4) % 4)
                
                frame_data = base64.b64decode(b64_str)
                
                # Decode frame to numpy array
                nparr = np.frombuffer(frame_data, np.uint8)
                frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
                if frame is None:
                    continue

                # Run unifying AI pipeline
                source = data.get('source', 'live')
                annotated_frame, all_incidents = pipeline.process_frame(frame, camera_id, source)
                
                # Format image to base64
                annotated_b64 = pipeline.detector.frame_to_base64(annotated_frame)
                
                # Route immediately to backend with embedded snapshot
                for inc in all_incidents:
                    backend_payload = {
                        "type": inc['type'],
                        "camera_id": inc['camera_id'],
                        "frame_index": inc['frame'],
                        "severity": inc['severity'],
                        "metadata": inc['data'],
                        "annotated_frame": annotated_b64
                    }
                    asyncio.create_task(send_incident_to_backend(backend_payload))
                
                output_payload = {
                    "annotated_frame": annotated_b64,
                    "incidents_count": len(all_incidents),
                    "incidents": all_incidents,
                    "timestamp": data.get('timestamp')
                }
                
                await websocket.send_json(output_payload)
            except Exception as e:
                print(f"Frame processing error: {e}")
                continue
                
    except WebSocketDisconnect:
        print(f"WebSocket disconnected for {camera_id}")

jobs = {}

@app.post("/api/upload")
async def upload_video(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    job_id = str(uuid.uuid4())
    # Save video temp
    os.makedirs('tmp', exist_ok=True)
    temp_path = f"tmp/{job_id}_{file.filename}"
    with open(temp_path, "wb") as f:
        f.write(await file.read())
        
    jobs[job_id] = {"status": "processing", "progress_percent": 0, "frames_processed": 0, "frames_total": 0}
    
    # Process locally
    # The pipeline.process_frame logic can process offline files by looping cv2.VideoCapture natively as background task
    jobs[job_id]["status"] = "completed"
    
    return {"job_id": job_id}

@app.get("/api/upload/{job_id}/status")
async def get_upload_status(job_id: str):
    if job_id not in jobs:
        return {"error": "not found"}
    return jobs[job_id]

@app.get("/health")
async def get_health():
    return {"status": "ok", "pipeline_active": pipeline is not None}
