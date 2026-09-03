import os
import shutil
import glob
import xml.etree.ElementTree as ET

DATA_ROOT = r"D:\Divya-Drishti\data"
OUTPUT_DIR = os.path.abspath("yolo_animal_dataset")

# Target class mapping
# 0: person, 1: cat, 2: dog, 3: horse
CLASSES = {0: 'person', 1: 'cat', 2: 'dog', 3: 'horse'}

def setup_dirs():
    for split in ['train', 'val']:
        os.makedirs(os.path.join(OUTPUT_DIR, 'images', split), exist_ok=True)
        os.makedirs(os.path.join(OUTPUT_DIR, 'labels', split), exist_ok=True)

def process_stanford_dogs(max_samples=1200):
    """ Converts Stanford Dogs XML annotations & images in SDdataset to YOLO format """
    print("[1/4] Processing Stanford Dogs Dataset (SDdataset)...")
    sd_dir = os.path.join(DATA_ROOT, "SDdataset")
    ann_dir = os.path.join(sd_dir, "annotations", "Annotation")
    img_dir = os.path.join(sd_dir, "images", "Images")
    
    if not os.path.exists(img_dir):
        img_dir = os.path.join(sd_dir, "images")
        
    xml_files = []
    for root, _, files in os.walk(ann_dir):
        for f in files:
            if not f.endswith('.xml') and '.' not in f:
                xml_files.append(os.path.join(root, f))
            elif f.endswith('.xml'):
                xml_files.append(os.path.join(root, f))

    if len(xml_files) > max_samples:
        import random
        random.seed(42)
        random.shuffle(xml_files)
        xml_files = xml_files[:max_samples]

    print(f"  Selected {len(xml_files)} dog annotation files for balanced training.")
    count = 0
    split_index = int(len(xml_files) * 0.85)

    for i, xml_path in enumerate(xml_files):
        try:
            tree = ET.parse(xml_path)
            root = tree.getroot()
            
            size = root.find('size')
            if size is None:
                continue
            w = int(size.find('width').text)
            h = int(size.find('height').text)
            if w <= 0 or h <= 0:
                continue

            filename_elem = root.find('filename')
            base_name = filename_elem.text if filename_elem is not None else os.path.basename(xml_path)
            if not base_name.endswith('.jpg'):
                base_name += '.jpg'
                
            src_img = None
            folder_elem = root.find('folder')
            if folder_elem is not None:
                possible = glob.glob(os.path.join(img_dir, f"*{folder_elem.text}*", base_name))
                if possible:
                    src_img = possible[0]

            if src_img is None or not os.path.exists(src_img):
                possible = glob.glob(os.path.join(img_dir, "**", base_name), recursive=True)
                if possible:
                    src_img = possible[0]

            if src_img is None or not os.path.exists(src_img):
                continue

            split = 'train' if i < split_index else 'val'
            dst_img = os.path.join(OUTPUT_DIR, 'images', split, f"dog_{count}_{base_name}")
            dst_txt = os.path.join(OUTPUT_DIR, 'labels', split, f"dog_{count}_{os.path.splitext(base_name)[0]}.txt")

            labels = []
            for obj in root.iter('object'):
                bnd = obj.find('bndbox')
                if bnd is None:
                    continue
                xmin = float(bnd.find('xmin').text)
                ymin = float(bnd.find('ymin').text)
                xmax = float(bnd.find('xmax').text)
                ymax = float(bnd.find('ymax').text)

                x_center = max(0.0, min(1.0, ((xmin + xmax) / 2.0) / w))
                y_center = max(0.0, min(1.0, ((ymin + ymax) / 2.0) / h))
                width = max(0.0, min(1.0, (xmax - xmin) / w))
                height = max(0.0, min(1.0, (ymax - ymin) / h))

                labels.append(f"2 {x_center:.6f} {y_center:.6f} {width:.6f} {height:.6f}")

            if labels:
                shutil.copy(src_img, dst_img)
                with open(dst_txt, 'w') as f:
                    f.write('\n'.join(labels) + '\n')
                count += 1
        except Exception as e:
            continue

    print(f"  Processed {count} dog images.")

def process_yolo_folder(source_folder, target_class_id, prefix, max_samples=1000):
    """ Process folders already containing YOLO images and labels """
    print(f"Processing {prefix} dataset from {source_folder}...")
    img_dir = os.path.join(source_folder, 'images')
    lbl_dir = os.path.join(source_folder, 'labels')
    
    if not os.path.exists(img_dir) or not os.path.exists(lbl_dir):
        print(f"  Warning: {source_folder} missing images or labels folder.")
        return

    image_files = glob.glob(os.path.join(img_dir, "*.*"))
    if len(image_files) > max_samples:
        import random
        random.seed(42)
        random.shuffle(image_files)
        image_files = image_files[:max_samples]

    print(f"  Found {len(image_files)} {prefix} images.")
    
    split_index = int(len(image_files) * 0.85)
    count = 0

    for i, img_path in enumerate(image_files):
        ext = os.path.splitext(img_path)[1].lower()
        if ext not in ['.jpg', '.jpeg', '.png', '.bmp']:
            continue

        base_stem = os.path.splitext(os.path.basename(img_path))[0]
        lbl_path = os.path.join(lbl_dir, f"{base_stem}.txt")
        if not os.path.exists(lbl_path):
            continue

        split = 'train' if i < split_index else 'val'
        dst_img = os.path.join(OUTPUT_DIR, 'images', split, f"{prefix}_{count}{ext}")
        dst_txt = os.path.join(OUTPUT_DIR, 'labels', split, f"{prefix}_{count}.txt")

        # Copy image
        shutil.copy(img_path, dst_img)

        # Re-index class id to target_class_id
        new_lines = []
        with open(lbl_path, 'r') as f:
            for line in f:
                parts = line.strip().split()
                if len(parts) >= 5:
                    parts[0] = str(target_class_id)
                    new_lines.append(" ".join(parts))

        with open(dst_txt, 'w') as f:
            f.write("\n".join(new_lines) + "\n")

        count += 1

    print(f"  Processed {count} {prefix} images.")

def create_yaml():
    yaml_path = os.path.join(OUTPUT_DIR, 'dataset.yaml')
    yaml_content = f"""path: {OUTPUT_DIR}
train: images/train
val: images/val

names:
  0: person
  1: cat
  2: dog
  3: horse
"""
    with open(yaml_path, 'w') as f:
        f.write(yaml_content)
    print(f"Created dataset configuration at {yaml_path}")

def main():
    setup_dirs()
    
    # 1. Process Dogs (SDdataset)
    process_stanford_dogs()
    
    # 2. Process Cats
    cat_dir = os.path.join(DATA_ROOT, "human", "cat", "cat")
    process_yolo_folder(cat_dir, target_class_id=1, prefix="cat")
    
    # 3. Process Horses
    horse_dir = os.path.join(DATA_ROOT, "human", "horsedata")
    process_yolo_folder(horse_dir, target_class_id=3, prefix="horse")
    
    # 4. Process Humans
    human_dir = os.path.join(DATA_ROOT, "human", "human")
    process_yolo_folder(human_dir, target_class_id=0, prefix="human")
    
    create_yaml()
    print("\nDataset preparation complete! Ready for YOLOv8 fine-tuning.")

if __name__ == "__main__":
    main()
