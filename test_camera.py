import socketio
import cv2
import time
import base64

sio = socketio.Client()

@sio.event
def connect():
    print("Connected to backend Socket.IO server")

@sio.event
def disconnect():
    print("Disconnected from backend server")

@sio.on('connection_response')
def on_connection_response(data):
    print("Connection response:", data)

sio.connect('http://localhost:8000', transports=['websocket', 'polling'])

cap = cv2.VideoCapture('AI_Engine/mixkit-potholes-in-a-rural-road-25208-hd-ready.mp4')

count = 0
while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
        continue
        
    count += 1
    if count % 15 != 0: # only send 2 frames per second (assuming 30fps)
        continue

    # Resize to max 480 width like frontend does
    MAX_WIDTH = 480
    h, w = frame.shape[:2]
    if w > MAX_WIDTH:
        h = int(h * (MAX_WIDTH / w))
        w = MAX_WIDTH
        frame = cv2.resize(frame, (w, h))

    _, buffer = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 35])
    b64_str = base64.b64encode(buffer).decode('utf-8')
    
    # Send frame
    sio.emit('raw_frame', {
        'frame': b64_str,
        'timestamp': time.time() * 1000,
        'location': {'lat': 19.8762, 'lng': 75.3433}
    })
    print("Sent frame", count)
    time.time()
    time.sleep(0.5)

cap.release()
sio.disconnect()
