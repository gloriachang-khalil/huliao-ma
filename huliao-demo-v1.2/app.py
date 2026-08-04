from __future__ import annotations

import tempfile
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory
from PIL import Image

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "models" / "best.pt"

app = Flask(__name__, static_folder=str(BASE_DIR), static_url_path="")
model = None

CLASS_TO_TILE = {
    "circle_1": "一筒",
    "circle_2": "二筒",
    "circle_3": "三筒",
    "circle_4": "四筒",
    "circle_5": "五筒",
    "circle_6": "六筒",
    "circle_7": "七筒",
    "circle_8": "八筒",
    "circle_9": "九筒",
    "bamboo_1": "一条",
    "bamboo_2": "二条",
    "bamboo_3": "三条",
    "bamboo_4": "四条",
    "bamboo_5": "五条",
    "bamboo_6": "六条",
    "bamboo_7": "七条",
    "bamboo_8": "八条",
    "bamboo_9": "九条",
    "character_1": "一萬",
    "character_2": "二萬",
    "character_3": "三萬",
    "character_4": "四萬",
    "character_5": "五萬",
    "character_6": "六萬",
    "character_7": "七萬",
    "character_8": "八萬",
    "character_9": "九萬",
    "east": "东",
    "south": "南",
    "west": "西",
    "north": "北",
    "green": "發",
    "red": "中",
    "white": "白",
}


def get_model():
    global model
    if model is None:
        from ultralytics import YOLO

        model = YOLO(str(MODEL_PATH))
    return model


@app.get("/")
def index():
    return send_from_directory(BASE_DIR, "index.html")


@app.get("/api/health")
def health():
    return jsonify(
        {
            "ok": True,
            "version": "v1.2.0",
            "model_exists": MODEL_PATH.exists(),
            "model_path": str(MODEL_PATH),
        }
    )


@app.post("/api/recognize")
def recognize():
    if "image" not in request.files:
        return jsonify({"ok": False, "error": "missing image file"}), 400

    image_file = request.files["image"]
    if not image_file.filename:
        return jsonify({"ok": False, "error": "empty filename"}), 400

    try:
        image = Image.open(image_file.stream).convert("RGB")
    except Exception as exc:
        return jsonify({"ok": False, "error": f"invalid image: {exc}"}), 400

    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        temp_path = Path(tmp.name)
        image.save(temp_path, format="JPEG")

    try:
        yolo = get_model()
        results = yolo.predict(source=str(temp_path), conf=0.25, verbose=False)
        detections = []

        for result in results:
            for box in result.boxes:
                class_id = int(box.cls[0])
                class_name = yolo.names[class_id]
                confidence = float(box.conf[0])
                xyxy = [float(value) for value in box.xyxy[0].tolist()]
                detections.append(
                    {
                        "class_id": class_id,
                        "class_name": class_name,
                        "tile": CLASS_TO_TILE.get(class_name, class_name),
                        "confidence": confidence,
                        "box": xyxy,
                        "center_x": (xyxy[0] + xyxy[2]) / 2,
                        "center_y": (xyxy[1] + xyxy[3]) / 2,
                    }
                )

        detections.sort(key=lambda item: (round(item["center_y"] / 80), item["center_x"]))
        tiles = [item["tile"] for item in detections]
        average_confidence = (
            sum(item["confidence"] for item in detections) / len(detections)
            if detections
            else 0
        )

        return jsonify(
            {
                "ok": True,
                "model_version": "best.pt from Loran-ash/Mahjong-Vision-Scoring-and-Game-Analysis",
                "tile_count": len(tiles),
                "tiles": tiles,
                "average_confidence": average_confidence,
                "detections": detections,
            }
        )
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500
    finally:
        temp_path.unlink(missing_ok=True)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5120, debug=False, use_reloader=False)
