from flask import Blueprint, jsonify, request
import json
import os

bluetooth_api = Blueprint("bluetooth_api", __name__)

DATA_FILE = "data/user_data.json"

DEMO_DEVICES = [
    {
        "id": "watch001",
        "name": "Apple Watch Series 10",
        "battery": 87
    },
    {
        "id": "watch002",
        "name": "Samsung Galaxy Watch 8",
        "battery": 71
    },
    {
        "id": "watch003",
        "name": "Fitbit Charge 7",
        "battery": 64
    }
]


def save_device(device):
    os.makedirs("data", exist_ok=True)

    data = {
        "connected": True,
        "device": device
    }

    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=4)


@bluetooth_api.route("/api/devices", methods=["GET"])
def scan_devices():
    return jsonify(DEMO_DEVICES)


@bluetooth_api.route("/api/connect", methods=["POST"])
def connect_device():
    device = request.json

    save_device(device)

    return jsonify({
        "success": True,
        "message": f"{device['name']} connected successfully!",
        "device": device
    })


@bluetooth_api.route("/api/device-status", methods=["GET"])
def device_status():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE) as f:
            return jsonify(json.load(f))

    return jsonify({"connected": False})