import cv2
from pipeline import AIPipeline

def main():
    pipeline = AIPipeline()
    video_path = 'mixkit-potholes-in-a-rural-road-25208-hd-ready.mp4'
    cap = cv2.VideoCapture(video_path)
    
    if not cap.isOpened():
        print(f"Error: Could not open video file {video_path}")
        return

    print("Playing video with AI detections. Press 'q' to quit.")
    
    while True:
        ret, frame = cap.read()
        if not ret:
            print("Video finished.")
            break
            
        # Resize frame for faster inference and viewing
        frame = cv2.resize(frame, (800, 600))
        
        annotated_frame, incidents = pipeline.process_frame(frame, 'CAM_01')
        
        cv2.imshow('DivyaDrishti AI Detection Engine', annotated_frame)
        
        # Press Q on keyboard to exit
        if cv2.waitKey(25) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == '__main__':
    main()
