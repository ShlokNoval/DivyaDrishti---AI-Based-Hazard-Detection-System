import cv2
from pipeline import AIPipeline

def main():
    pipeline = AIPipeline()
    video_path = 'mixkit-potholes-in-a-rural-road-25208-hd-ready.mp4'
    cap = cv2.VideoCapture(video_path)
    
    print(f"Opening video: {video_path}")
    
    # Process just the first 5 frames to give an output summary
    for i in range(5):
        ret, frame = cap.read()
        if not ret:
            print("Finished reading video.")
            break
            
        annotated_frame, incidents = pipeline.process_frame(frame, 'CAM_01')
        print(f"Frame {i+1} processed. Detected incidents: {len(incidents)}")
        for inc in incidents:
            type_val = inc.get('type')
            severity_val = inc.get('severity')
            conf_val = inc.get('confidence', 'N/A')
            print(f"  - {type_val}: severity {severity_val}, confidence {conf_val}")
            
        if i == 0:
            cv2.imwrite('first_frame_detection.jpg', annotated_frame)
            print("Saved annotated first frame to first_frame_detection.jpg")

    cap.release()
    print("\nVisual test script `visual_test.py` is also available if you want to watch the video playback with detections live on your screen.")

if __name__ == '__main__':
    main()
