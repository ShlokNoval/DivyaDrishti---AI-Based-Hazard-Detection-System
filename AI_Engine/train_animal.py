import os
import shutil
import torch
from ultralytics import YOLO

# Fix for PyTorch 2.6+ WeightsUnpickler error (Monkeypatching)
_original_load = torch.load
def _hooked_load(*args, **kwargs):
    if 'weights_only' not in kwargs:
        kwargs['weights_only'] = False
    return _original_load(*args, **kwargs)
torch.load = _hooked_load

def main():
    print("Initializing YOLOv8 fine-tuning for Street Animals / Dogs...")
    
    yolo_dataset_dir = os.path.abspath("yolo_animal_dataset")
    dataset_yaml = os.path.join(yolo_dataset_dir, 'dataset.yaml')
    
    # Try downloading Kaggle dataset if available
    try:
        import kagglehub
        print("Checking Kaggle dataset for Indian Road & Street Animals...")
        ds_path = kagglehub.dataset_download("vigneshg/indian-street-dogs")
        print(f"Downloaded dataset to: {ds_path}")
    except Exception as e:
        print(f"Kaggle download skipped or optional: {e}")
    
    if not os.path.exists(dataset_yaml):
        print(f"Creating placeholder dataset configuration at {dataset_yaml}")
        os.makedirs(os.path.join(yolo_dataset_dir, 'images', 'train'), exist_ok=True)
        os.makedirs(os.path.join(yolo_dataset_dir, 'images', 'val'), exist_ok=True)
        os.makedirs(os.path.join(yolo_dataset_dir, 'labels', 'train'), exist_ok=True)
        os.makedirs(os.path.join(yolo_dataset_dir, 'labels', 'val'), exist_ok=True)
        
        yaml_content = f"""
path: {yolo_dataset_dir}
train: images/train
val: images/val

names:
  0: dog
  1: cat
  2: cow
"""
        with open(dataset_yaml, 'w') as f:
            f.write(yaml_content)
        print("Please place your downloaded YOLO format images & labels inside 'yolo_animal_dataset' directory.")
        return

    print(f"Loading pretrained YOLOv8 model from yolov8n.pt...")
    model = YOLO("yolov8n.pt")  
    
    print("Starting YOLOv8 training on animal dataset...")
    results = model.train(data=dataset_yaml, epochs=10, imgsz=640, device='cpu')
    
    best_model_path = os.path.join("runs", "detect", "train", "weights", "best.pt")
    if os.path.exists(best_model_path):
        shutil.copy(best_model_path, "yolov8_animal.pt")
        print("Model fine-tuned and saved as yolov8_animal.pt")
    else:
        import glob
        runs = glob.glob(os.path.join("runs", "detect", "train*", "weights", "best.pt"))
        if runs:
            latest_run = sorted(runs, key=os.path.getmtime)[-1]
            shutil.copy(latest_run, "yolov8_animal.pt")
            print(f"Model fine-tuned and saved as yolov8_animal.pt (from {latest_run})")
        else:
            print("Could not find best.pt. Check training output log.")

if __name__ == "__main__":
    main()
