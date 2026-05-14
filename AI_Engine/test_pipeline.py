import cv2
from pipeline import AIPipeline

def main():
    pipeline = AIPipeline()
    cap = cv2.VideoCapture('test_videos/pothole_test.mp4')
    
    ret, frame = cap.read()
    if not ret:
        print("Failed to read video")
        return
        
    annotated_frame, incidents = pipeline.process_frame(frame, 'CAM_01')
    print(f"Detected incidents: {len(incidents)}")
    for inc in incidents:
        print(f" - {inc['type']}: severity {inc['severity']}")
        
    cv2.imwrite('test_output.jpg', annotated_frame)
    print("Saved test_output.jpg")
    cap.release()

if __name__ == '__main__':
    main()
