from flask import Blueprint, jsonify
import random

health_api = Blueprint("health_api", __name__)


@health_api.route("/api/health", methods=["GET"])
def health_metrics():

    data = {
        "heart_rate": random.randint(70, 88),
        "steps": random.randint(3500, 9000),
        "spo2": random.randint(96, 99),
        "calories": random.randint(250, 550),
        "hrv": random.randint(50, 75),
        "sleep": round(random.uniform(6.0, 8.5), 1)
    }

    return jsonify(data)