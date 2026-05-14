import os
import shutil
import xml.etree.ElementTree as ET
import kagglehub
import torch
from ultralytics import YOLO

# Fix for PyTorch 2.6+ WeightsUnpickler error (Monkeypatching)
_original_load = torch.load
def _hooked_load(*args, **kwargs):
    if 'weights_only' not in kwargs:
        kwargs['weights_only'] = False
    return _original_load(*args, **kwargs)
torch.load = _hooked_load

def convert_voc_to_yolo(voc_dir, output_dir):
    """Converts PASCAL VOC annotations to YOLO format."""
    print("Converting VOC dataset to YOLO format...")
    annotations_dir = os.path.join(voc_dir, 'annotations')
    images_dir = os.path.join(voc_dir, 'images')
    
    # Create output directories
    os.makedirs(os.path.join(output_dir, 'images', 'train'), exist_ok=True)
    os.makedirs(os.path.join(output_dir, 'images', 'val'), exist_ok=True)
    os.makedirs(os.path.join(output_dir, 'labels', 'train'), exist_ok=True)
    os.makedirs(os.path.join(output_dir, 'labels', 'val'), exist_ok=True)

    xml_files = [f for f in os.listdir(annotations_dir) if f.endswith('.xml')]
    
    # Simple split: 80% train, 20% val
    split_index = int(len(xml_files) * 0.8)
    train_files = xml_files[:split_index]
    
    for xml_file in xml_files:
        tree = ET.parse(os.path.join(annotations_dir, xml_file))
        root = tree.getroot()
        
        size = root.find('size')
        w = int(size.find('width').text)
        h = int(size.find('height').text)
        
        subset = 'train' if xml_file in train_files else 'val'
        
        img_filename = root.find('filename').text
        src_img = os.path.join(images_dir, img_filename)
        dst_img = os.path.join(output_dir, 'images', subset, img_filename)
        
        if not os.path.exists(src_img):
            continue
            
        shutil.copy(src_img, dst_img)
        
        txt_filename = os.path.splitext(xml_file)[0] + '.txt'
        txt_path = os.path.join(output_dir, 'labels', subset, txt_filename)
        
        with open(txt_path, 'w') as out_file:
            for obj in root.iter('object'):
                difficult = obj.find('difficult')
                if difficult is not None and int(difficult.text) == 1:
                    continue
                    
                cls = obj.find('name').text
                if cls != 'pothole':
                    continue
                    
                xmlbox = obj.find('bndbox')
                b = (float(xmlbox.find('xmin').text), float(xmlbox.find('xmax').text), float(xmlbox.find('ymin').text), float(xmlbox.find('ymax').text))
                
                # YOLO format: x_center, y_center, width, height (normalized)
                x_center = ((b[0] + b[1]) / 2.0) / w
                y_center = ((b[2] + b[3]) / 2.0) / h
                width = (b[1] - b[0]) / w
                height = (b[3] - b[2]) / h
                
                out_file.write(f"0 {x_center} {y_center} {width} {height}\n")
                
    print("Conversion complete.")

def main():
    print("Downloading dataset...")
    # Download dataset
    dataset_path = kagglehub.dataset_download("andrewmvd/pothole-detection")
    print("Path to dataset files:", dataset_path)
    
    yolo_dataset_dir = os.path.abspath("yolo_pothole_dataset")
    
    if not os.path.exists(yolo_dataset_dir):
        convert_voc_to_yolo(dataset_path, yolo_dataset_dir)
        
        # Create dataset.yaml
        yaml_content = f"""
path: {yolo_dataset_dir}
train: images/train
val: images/val

names:
  0: pothole
"""
        with open(os.path.join(yolo_dataset_dir, 'dataset.yaml'), 'w') as f:
            f.write(yaml_content)
            
    print("Starting YOLOv8 training...")
    # Load a pretrained model
    model = YOLO("yolov8n.pt")  
    
    # Train the model
    # Note: epochs=5 to keep training short for demonstration
    results = model.train(data=os.path.join(yolo_dataset_dir, 'dataset.yaml'), epochs=3, imgsz=640, device='cpu')
    
    # Move the trained model to AI_Engine folder
    best_model_path = os.path.join("runs", "detect", "train", "weights", "best.pt")
    if os.path.exists(best_model_path):
        shutil.copy(best_model_path, "yolov8_pothole.pt")
        print("Model trained and saved as yolov8_pothole.pt")
    else:
        # If running into issues locating the folder (due to incremental train2, train3, etc.)
        import glob
        runs = glob.glob(os.path.join("runs", "detect", "train*", "weights", "best.pt"))
        if runs:
            latest_run = sorted(runs, key=os.path.getmtime)[-1]
            shutil.copy(latest_run, "yolov8_pothole.pt")
            print(f"Model trained and saved as yolov8_pothole.pt (from {latest_run})")
        else:
            print("Could not find best.pt. Training might have failed.")

if __name__ == "__main__":
    main()
