import os
import shutil
import torch
from ultralytics import YOLO

# PyTorch 2.6+ WeightsUnpickler error monkeypatch
_original_load = torch.load
def _hooked_load(*args, **kwargs):
    if 'weights_only' not in kwargs:
        kwargs['weights_only'] = False
    return _original_load(*args, **kwargs)
torch.load = _hooked_load

def main():
    dataset_dir = os.path.abspath("yolo_animal_dataset")
    dataset_yaml = os.path.join(dataset_dir, 'dataset.yaml')

    if not os.path.exists(dataset_yaml):
        print(f"Error: {dataset_yaml} not found. Run prepare_custom_dataset.py first.")
        return

    print("Loading pretrained YOLOv8 base model (yolov8n.pt)...")
    model = YOLO("yolov8n.pt")

    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    print(f"Starting YOLOv8 fine-tuning on custom dataset using device: {device}")

    # Train for 5 epochs to perform fast fine-tuning on local dataset
    results = model.train(
        data=dataset_yaml,
        epochs=5,
        imgsz=640,
        batch=16 if device == 'cuda' else 8,
        device=device,
        verbose=True
    )

    # Save fine-tuned weights to yolov8_animal.pt
    import glob
    runs = glob.glob(os.path.join("runs", "detect", "train*", "weights", "best.pt"))
    if runs:
        latest_best = sorted(runs, key=os.path.getmtime)[-1]
        target_path = os.path.abspath("yolov8_animal.pt")
        shutil.copy(latest_best, target_path)
        print(f"\nTraining complete! Fine-tuned model saved as '{target_path}'.")
    else:
        print("\nTraining completed, but best.pt could not be automatically located.")

if __name__ == "__main__":
    main()
