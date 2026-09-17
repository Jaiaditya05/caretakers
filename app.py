from flask import Flask, jsonify, render_template, request, send_file, send_from_directory, Response
from datetime import datetime, date
import random
import os
import io
import urllib.request
import urllib.error
import json
import base64
import re

try:
    import qrcode
except ImportError:
    qrcode = None


app = Flask(__name__)

# ============================================================
# LOCAL DATA PERSISTENCE
# ============================================================
DATA_FILE = os.getenv("CARETAKERS_DATA_FILE", "data/caretakers_state.json")

def save_state():
    """Persist the current demo/application state."""
    try:
        os.makedirs(os.path.dirname(DATA_FILE) or ".", exist_ok=True)
        tmp = DATA_FILE + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(state, f, indent=2)
        os.replace(tmp, DATA_FILE)
    except Exception as exc:
        print(f"[Caretakers] data persistence warning: {exc}")

def load_state():
    """Load persisted state while keeping built-in demo defaults as fallback."""
    global state
    if not os.path.exists(DATA_FILE):
        return
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            saved = json.load(f)
        if isinstance(saved, dict):
            for key, value in saved.items():
                if key in state:
                    state[key] = value
    except Exception as exc:
        print(f"[Caretakers] data load warning: {exc}")



# ============================================================
# CONFIGURATION
# ============================================================

# AI_PROVIDER can be:
#   demo
#   groq
#   nvidia
#
# For hackathon demo, leaving it as "demo" is completely fine.
AI_PROVIDER = os.getenv("AI_PROVIDER", "groq").lower()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "")

GROQ_MODEL = os.getenv(
    "GROQ_MODEL",
    "llama-3.3-70b-versatile"
)

NVIDIA_MODEL = os.getenv(
    "NVIDIA_MODEL",
    "meta/llama-3.1-70b-instruct"
)


# ============================================================
# DEMO DATA STORE
# ============================================================

state = {

    "clinical_notes": [],

    "prescriptions": [],

    "ai_risk_images": [],

    # --------------------------------------------------------
    # DEVICE
    # --------------------------------------------------------

    "device": {
        "connected": False,
        "name": None,
        "last_sync": None,
        "status": "Disconnected",
    },


    # --------------------------------------------------------
    # HEALTH
    # --------------------------------------------------------

    "health": {

        "heart_rate": 78,
        "steps": 6421,
        "steps_goal": 10000,

        "spo2": 98.0,

        "calories": 342,
        "calories_goal": 500,

        "hrv": 62.0,

        "sleep": 7.4,

        "status": "Normal",
    },


    # --------------------------------------------------------
    # ALERTS
    # --------------------------------------------------------

    "alerts": [],


    # --------------------------------------------------------
    # CHAT
    # --------------------------------------------------------

    "messages": [],


    # --------------------------------------------------------
    # CARETAKERS
    # --------------------------------------------------------

    "caretakers": [

        {
            "id": 1,
            "name": "Anita Sharma",
            "relationship": "Family caretaker",
            "phone": "+91 98765 43210",
            "access": "Full health access",
            "status": "Active",
            "last_active": "Just now",
        },

        {
            "id": 2,
            "name": "Caretakers Care Team",
            "relationship": "Healthcare provider",
            "phone": "Care team",
            "access": "Clinical access",
            "status": "Active",
            "last_active": "5 min ago",
        },
    ],


    # --------------------------------------------------------
    # APPOINTMENTS
    # --------------------------------------------------------

    "appointments": [

        {
            "id": 1001,
            "doctor_id": "sarah-chen",
            "doctor": "Dr. Sarah Chen",
            "specialty": "Cardiologist",
            "date": "Tomorrow",
            "time": "10:30 AM",
            "status": "Confirmed",
            "reason": "Routine health review",
            "mode": "Offline",
            "hospital": "Caretakers Heart & Wellness Centre",
        }
    ],


    # --------------------------------------------------------
    # MEDICATIONS
    # --------------------------------------------------------

    "medications": [

        {
            "id": 1,
            "name": "Metoprolol",
            "dosage": "25 mg",
            "frequency": "Once daily",
            "time": "08:00 AM",
            "instructions": "Take after breakfast",
            "active": True,
        },

        {
            "id": 2,
            "name": "Vitamin D3",
            "dosage": "1000 IU",
            "frequency": "Once daily",
            "time": "01:00 PM",
            "instructions": "Take after lunch",
            "active": True,
        },

        {
            "id": 3,
            "name": "Atorvastatin",
            "dosage": "10 mg",
            "frequency": "Once daily",
            "time": "08:00 PM",
            "instructions": "Take after dinner",
            "active": True,
        },
    ],


    # --------------------------------------------------------
    # MEDICATION LOG
    #
    # Each entry records:
    # scheduled dose
    # taken / missed / pending
    # time
    # --------------------------------------------------------

    "medication_log": [],


    # --------------------------------------------------------
    # ORDERS
    # --------------------------------------------------------

    "orders": [],


    # --------------------------------------------------------
    # PAYMENTS
    # --------------------------------------------------------

    "payments": [],
}


load_state()

# ============================================================
# DOCTORS
# ============================================================

DOCTORS = [

    {
        "id": "sarah-chen",
        "name": "Dr. Sarah Chen",
        "specialty": "Cardiologist",
        "rating": 4.9,
        "experience": "12 yrs experience",
        "fee": 800,
        "availability": "Available today",
        "next_slot": "10:30 AM",
        "education": "MBBS, MD Cardiology",
        "languages": "English, Hindi",
        "hospital": "Caretakers Heart & Wellness Centre",
        "patients": 1840,
        "about": (
            "Specializes in preventive cardiology, heart-rate concerns, "
            "hypertension and long-term cardiovascular monitoring."
        ),
    },

    {
        "id": "arjun-mehta",
        "name": "Dr. Arjun Mehta",
        "specialty": "General Physician",
        "rating": 4.8,
        "experience": "10 yrs experience",
        "fee": 600,
        "availability": "Available today",
        "next_slot": "12:15 PM",
        "education": "MBBS, MD General Medicine",
        "languages": "English, Hindi, Marathi",
        "hospital": "Caretakers Medical Centre",
        "patients": 2310,
        "about": (
            "Provides primary care, medication reviews, lifestyle guidance "
            "and evaluation of common symptoms."
        ),
    },

    {
        "id": "priya-nair",
        "name": "Dr. Priya Nair",
        "specialty": "Pulmonologist",
        "rating": 4.9,
        "experience": "14 yrs experience",
        "fee": 900,
        "availability": "Available today",
        "next_slot": "2:00 PM",
        "education": "MBBS, MD, DM Pulmonary Medicine",
        "languages": "English, Hindi, Malayalam",
        "hospital": "Caretakers Respiratory Clinic",
        "patients": 1675,
        "about": (
            "Focuses on respiratory health, oxygen saturation trends, "
            "asthma, sleep-related breathing and lung care."
        ),
    },

    {
        "id": "rohan-kapoor",
        "name": "Dr. Rohan Kapoor",
        "specialty": "Neurologist",
        "rating": 4.8,
        "experience": "9 yrs experience",
        "fee": 850,
        "availability": "Available today",
        "next_slot": "3:30 PM",
        "education": "MBBS, MD, DM Neurology",
        "languages": "English, Hindi",
        "hospital": "Caretakers Neuro Centre",
        "patients": 1210,
        "about": (
            "Treats neurological symptoms and supports long-term monitoring "
            "for sleep, stress, headaches and nervous-system health."
        ),
    },

    {
        "id": "ananya-mehta",
        "name": "Dr. Ananya Mehta",
        "specialty": "Endocrinologist",
        "rating": 4.9,
        "experience": "11 yrs experience",
        "fee": 800,
        "availability": "Available today",
        "next_slot": "4:15 PM",
        "education": "MBBS, MD, DM Endocrinology",
        "languages": "English, Hindi",
        "hospital": "Caretakers Endocrine Clinic",
        "patients": 1395,
        "about": (
            "Specializes in metabolic health, diabetes care, thyroid "
            "disorders and medication-supported lifestyle management."
        ),
    },

    {
        "id": "vikram-malhotra",
        "name": "Dr. Vikram Malhotra",
        "specialty": "Psychiatrist",
        "rating": 4.7,
        "experience": "13 yrs experience",
        "fee": 750,
        "availability": "Available tomorrow",
        "next_slot": "9:00 AM",
        "education": "MBBS, MD Psychiatry",
        "languages": "English, Hindi, Punjabi",
        "hospital": "Caretakers Mind & Wellness Centre",
        "patients": 980,
        "about": (
            "Supports stress, sleep, anxiety, mood and behavioural health "
            "with structured follow-up care."
        ),
    },
]


# ============================================================
# MEDICATION ALERTS / TODAY'S DOSES
# ============================================================

def _parse_med_time(value):
    for fmt in ("%I:%M %p", "%H:%M"):
        try:
            return datetime.strptime(value.strip(), fmt).time()
        except (ValueError, AttributeError):
            pass
    return None

@app.get("/api/medications/today")
def medication_today():
    """Return today's scheduled doses and due/missed status."""
    today = now_date()
    current = datetime.now()
    logs = state.get("medication_log", [])
    doses = []
    for med in state.get("medications", []):
        if not med.get("active", True):
            continue
        matches = [x for x in logs if x.get("medication_id") == med.get("id") and x.get("date") == today]
        latest = matches[0] if matches else None
        scheduled = _parse_med_time(med.get("time", ""))
        status = latest.get("status") if latest else "pending"
        overdue = False
        if status == "pending" and scheduled:
            overdue = current >= datetime.combine(date.today(), scheduled)
        doses.append({
            "medication_id": med.get("id"), "name": med.get("name"),
            "dosage": med.get("dosage"), "time": med.get("time"),
            "instructions": med.get("instructions", ""), "status": status,
            "overdue": overdue, "recorded_at": latest.get("recorded_at") if latest else None
        })
    due = [x for x in doses if x["overdue"] and x["status"] == "pending"]
    return jsonify({
        "date": today, "doses": doses, "due_count": len(due),
        "alerts": [{"type":"medication","severity":"warning","title":f"Medication due: {x['name']}",
                    "message":f"{x['dosage']} scheduled for {x['time']}.","medication_id":x["medication_id"]} for x in due]
    })

# ============================================================
# MEDICINE CATALOG
# ============================================================

MEDICINE_CATALOG = [

    {
        "id": "med-001",
        "name": "Metoprolol",
        "strength": "25 mg",
        "price": 120,
        "pack": "30 tablets",
    },

    {
        "id": "med-002",
        "name": "Atorvastatin",
        "strength": "10 mg",
        "price": 180,
        "pack": "30 tablets",
    },

    {
        "id": "med-003",
        "name": "Vitamin D3",
        "strength": "1000 IU",
        "price": 150,
        "pack": "30 capsules",
    },

    {
        "id": "med-004",
        "name": "Paracetamol",
        "strength": "500 mg",
        "price": 60,
        "pack": "20 tablets",
    },
]


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def now_time():
    return datetime.now().strftime("%I:%M %p")


def now_date():
    return datetime.now().strftime("%Y-%m-%d")


def new_id():
    return int(datetime.now().timestamp() * 1000)


def whatsapp_url(phone, message):
    """
    Creates a WhatsApp chat URL.

    For the hackathon this demonstrates the flow.
    """

    import urllib.parse

    cleaned_phone = (
        phone.replace("+", "")
        .replace(" ", "")
        .replace("-", "")
    )

    encoded_message = urllib.parse.quote(message)

    return (
        f"https://wa.me/{cleaned_phone}"
        f"?text={encoded_message}"
    )


# ============================================================
# AI FUNCTIONS
# ============================================================

def demo_ai_reply(message):

    h = state["health"]

    lower = message.lower()

    if (
        "trend" in lower
        or "health" in lower
        or "summary" in lower
    ):

        return (
            f"Your current heart rate is "
            f"{h['heart_rate']} bpm and SpO₂ is "
            f"{h['spo2']}%. You've recorded "
            f"{h['steps']:,} steps today. "
            "Your current readings look stable."
        )

    if "heart" in lower:

        return (
            f"Your latest heart-rate reading is "
            f"{h['heart_rate']} bpm and is currently "
            f"marked {h['status'].lower()}."
        )

    if (
        "medication" in lower
        or "medicine" in lower
        or "dose" in lower
    ):

        report = medication_report()

        return (
            f"Your medication adherence is "
            f"{report['adherence']}%. "
            f"You have {report['taken']} taken doses "
            f"and {report['missed']} missed doses "
            "in the recorded demo history."
        )

    if (
        "appointment" in lower
        or "doctor" in lower
    ):

        if state["appointments"]:

            appointment = state["appointments"][0]

            return (
                f"You have an appointment with "
                f"{appointment['doctor']} on "
                f"{appointment['date']} at "
                f"{appointment['time']}."
            )

        return "You currently have no appointments."

    if "alert" in lower:

        return (
            "There are currently "
            f"{len(state['alerts'])} alert(s) in the "
            "care-team feed."
        )

    if (
        "buy" in lower
        or "medicine purchase" in lower
    ):

        return (
            "I can help you start a medicine purchase. "
            "Caretakers will give you two choices: "
            "Online or WhatsApp."
        )

    return (
        "I can help with your health summary, "
        "medications, appointments, alerts, "
        "medicine purchases and care-team support."
    )


def call_groq(message):
    # Read the current Groq configuration at request time.
    groq_key = os.getenv("GROQ_API_KEY", "").strip()
    groq_model = os.getenv(
        "GROQ_MODEL",
        "openai/gpt-oss-120b"
    ).strip()

    if not groq_key:
        print("Groq AI: GROQ_API_KEY is not set.")
        return demo_ai_reply(message)

    # --------------------------------------------------------
    # BUILD LIVE CARETAKERS PATIENT CONTEXT
    # --------------------------------------------------------
    health = state.get("health", {}) or {}

    medication_log = state.get("medication_log", []) or []
    medications = state.get("medications", []) or []
    appointments = state.get("appointments", []) or []
    alerts = state.get("alerts", []) or []

    taken = len([
        x for x in medication_log
        if x.get("status") == "Taken"
    ])

    missed = len([
        x for x in medication_log
        if x.get("status") == "Missed"
    ])

    pending = len([
        x for x in medication_log
        if x.get("status") == "Pending"
    ])

    completed = taken + missed

    if completed:
        adherence = round((taken / completed) * 100)
    else:
        adherence = 92

    # Medication history
    medication_history = []
    for item in medication_log[-20:]:
        medication_history.append({
            "medicine": item.get("medicine", item.get("name", "Unknown")),
            "status": item.get("status", "Unknown"),
            "date": item.get("date", ""),
            "time": item.get("time", "")
        })

    # Current medications
    current_medications = []
    for item in medications:
        if isinstance(item, dict):
            current_medications.append({
                "name": item.get("name", item.get("medicine", "Unknown")),
                "status": item.get("status", ""),
                "dose": item.get("dose", ""),
                "time": item.get("time", "")
            })
        else:
            current_medications.append(str(item))

    # Appointments
    appointment_context = []
    for item in appointments:
        if isinstance(item, dict):
            appointment_context.append({
                "doctor": item.get("doctor", ""),
                "date": item.get("date", ""),
                "time": item.get("time", ""),
                "status": item.get("status", ""),
                "location": item.get("location", "")
            })

    # Alerts
    alert_context = []
    for item in alerts[-10:]:
        if isinstance(item, dict):
            alert_context.append({
                "title": item.get("title", ""),
                "message": item.get("message", ""),
                "severity": item.get("severity", ""),
                "status": item.get("status", "")
            })
        else:
            alert_context.append(str(item))

    caretakers_context = {
        "health": health,
        "medication_adherence": {
            "percentage": adherence,
            "taken": taken,
            "missed": missed,
            "pending": pending,
            "total_recorded": len(medication_log)
        },
        "current_medications": current_medications,
        "medication_history": medication_history,
        "appointments": appointment_context,
        "alerts": alert_context
    }

    context_text = json.dumps(
        caretakers_context,
        indent=2,
        default=str
    )

    # --------------------------------------------------------
    # GROQ REQUEST
    # --------------------------------------------------------
    url = "https://" + "api.groq.com" + "/openai/v1/chat/completions"

    system_prompt = (
        "You are Caretakers AI, the healthcare assistant inside the "
        "Caretakers healthcare application. "
        "You have been given the patient's current Caretakers data below. "
        "Use this data when answering questions about the patient's "
        "health, medications, adherence, medication history, "
        "appointments, or alerts. "
        "Never claim that you cannot access the patient's Caretakers "
        "records when the information is present in the supplied "
        "context. "
        "If a requested piece of information is not present in the "
        "context, clearly say that it is not available. "
        "Do not invent patient data. "
        "Give concise, safe and easy-to-understand healthcare "
        "information. Do not diagnose or prescribe. "
        "For urgent emergencies, advise contacting emergency "
        "medical services. "
        "When discussing a missed medication, do not tell the "
        "patient to take an extra dose unless a qualified healthcare "
        "professional has specifically advised it. "
        "Do not use Markdown tables. "
        "When listing multiple medications, appointments, health values "
        "or other items, use simple bullet points or numbered lists "
        "instead of tables."
    )

    user_prompt = (
        "CARETAKERS PATIENT CONTEXT:\n"
        + context_text
        + "\n\nPATIENT QUESTION:\n"
        + message
    )

    payload = {
        "model": groq_model,
        "messages": [
            {
                "role": "system",
                "content": system_prompt
            },
            {
                "role": "user",
                "content": user_prompt
            }
        ],
        "temperature": 0.3
    }

    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {groq_key}",
                "Content-Type": "application/json",
                "User-Agent": "Caretakers/1.0"
            },
            method="POST"
        )

        with urllib.request.urlopen(req, timeout=30) as response:
            result = json.loads(
                response.read().decode("utf-8")
            )

        reply = result["choices"][0]["message"]["content"]

        print(
            f"Groq AI success: model={groq_model}"
        )

        return reply

    except urllib.error.HTTPError as e:
        error_body = ""

        try:
            error_body = e.read().decode("utf-8")
        except Exception:
            pass

        print(
            f"Groq AI HTTP error: {e.code} {e.reason}"
        )

        if error_body:
            print(
                f"Groq response: {error_body[:1000]}"
            )

        return demo_ai_reply(message)

    except Exception as e:
        print(
            f"Groq AI error: {type(e).__name__}: {e}"
        )

        return demo_ai_reply(message)


def call_nvidia(message):

    if not NVIDIA_API_KEY:
        return demo_ai_reply(message)

    url = (
        "https://integrate.api.nvidia.com/v1/"
        "chat/completions"
    )

    payload = {

        "model": NVIDIA_MODEL,

        "messages": [

            {
                "role": "system",
                "content": (
                    "You are Caretakers, a healthcare assistant. "
                    "Give concise and safe healthcare information. "
                    "Do not diagnose or prescribe."
                ),
            },

            {
                "role": "user",
                "content": message,
            },
        ],

        "temperature": 0.3,

        "max_tokens": 500,
    }

    try:

        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {NVIDIA_API_KEY}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        with urllib.request.urlopen(req, timeout=20) as response:

            result = json.loads(
                response.read().decode("utf-8")
            )

        return result["choices"][0]["message"]["content"]

    except Exception:

        return demo_ai_reply(message)


def get_ai_reply(message):

    if AI_PROVIDER == "groq":

        return call_groq(message)

    if AI_PROVIDER == "nvidia":

        return call_nvidia(message)

    return demo_ai_reply(message)


# ============================================================
# MEDICATION HELPERS
# ============================================================

def medication_report():

    log = state["medication_log"]

    taken = len([
        x for x in log
        if x["status"] == "Taken"
    ])

    missed = len([
        x for x in log
        if x["status"] == "Missed"
    ])

    pending = len([
        x for x in log
        if x["status"] == "Pending"
    ])

    completed = taken + missed

    if completed:

        adherence = round(
            (taken / completed) * 100
        )

    else:

        # Demo value before user starts marking doses.
        adherence = 92

    return {

        "adherence": adherence,

        "taken": taken,

        "missed": missed,

        "pending": pending,

        "total_recorded": len(log),

        "status": (
            "Excellent"
            if adherence >= 90
            else "Needs attention"
        ),
    }


# ============================================================
# PRESCRIPTIONS + AI ADHERENCE RISK VISUALS
# ============================================================

UPLOAD_DIR = os.path.join("data", "prescriptions")
os.makedirs(UPLOAD_DIR, exist_ok=True)
ALLOWED_UPLOAD_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "pdf"}
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_IMAGE_MODEL = os.getenv("OPENAI_IMAGE_MODEL", "gpt-image-1").strip()

def allowed_upload(filename):
    return bool(filename and "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_UPLOAD_EXTENSIONS)

def build_risk_prompt(adherence, medicines):
    medicine_text = ", ".join(f"{m.get('name', 'prescribed medicine')} ({m.get('dosage', '')})" for m in medicines if isinstance(m, dict)) or "the prescribed medication"
    severity = "significant medication non-adherence" if adherence < 70 else "medication non-adherence"
    return ("Create a clear, empathetic healthcare education illustration for a medication adherence app. "
            f"The patient's overall medication adherence is {adherence}%, indicating {severity}. "
            f"Relevant medicines are: {medicine_text}. "
            "Show a non-graphic, non-alarming visual progression of what may happen when prescribed medicines are repeatedly missed, "
            "such as symptoms worsening or the underlying condition becoming harder to control. Do not show blood, injuries, death, "
            "or frightening imagery. Use a clean educational style suitable for a patient dashboard. "
            "This is educational only and must not imply a guaranteed outcome.")

def generate_local_risk_svg(adherence, medicines):
    level = "Urgent attention" if adherence < 70 else "Needs attention"
    color = "#dc2626" if adherence < 70 else "#d97706"
    names = ", ".join(m.get("name", "medicine") for m in medicines[:3] if isinstance(m, dict)) or "prescribed medicine"
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
      <rect width="1200" height="800" rx="36" fill="#f8fafc"/>
      <rect x="55" y="55" width="1090" height="690" rx="30" fill="white" stroke="#e2e8f0" stroke-width="3"/>
      <text x="90" y="125" font-family="Arial" font-size="42" font-weight="700" fill="#172033">Medication adherence matters</text>
      <text x="90" y="175" font-family="Arial" font-size="25" fill="#64748b">Educational AI risk visualization</text>
      <circle cx="190" cy="330" r="110" fill="#eef2ff"/>
      <rect x="145" y="260" width="90" height="145" rx="45" fill="#6366f1" transform="rotate(-18 190 330)"/>
      <text x="340" y="295" font-family="Arial" font-size="31" font-weight="700" fill="#172033">Current adherence: {adherence}%</text>
      <text x="340" y="345" font-family="Arial" font-size="27" fill="{color}">{level}</text>
      <text x="340" y="400" font-family="Arial" font-size="23" fill="#475569">Repeatedly missing prescribed doses can increase</text>
      <text x="340" y="435" font-family="Arial" font-size="23" fill="#475569">the risk of symptoms or the underlying condition</text>
      <text x="340" y="470" font-family="Arial" font-size="23" fill="#475569">becoming harder to control.</text>
      <rect x="90" y="545" width="1020" height="120" rx="24" fill="#f1f5f9"/>
      <text x="120" y="595" font-family="Arial" font-size="22" font-weight="700" fill="#334155">Medicines tracked</text>
      <text x="120" y="632" font-family="Arial" font-size="21" fill="#64748b">{names[:110]}</text>
      <text x="90" y="705" font-family="Arial" font-size="18" fill="#94a3b8">Illustration is educational, not a prediction or diagnosis.</text>
    </svg>'''
    return svg.encode("utf-8")

@app.post("/api/adherence-risk")
def adherence_risk():
    report = medication_report()
    adherence = int(report.get("adherence", 100))
    if adherence >= 75:
        return jsonify({"triggered": False, "adherence": adherence})
    bucket = "critical" if adherence < 70 else "warning"
    today = now_date()
    existing = next((x for x in state.get("ai_risk_images", []) if x.get("date") == today and x.get("bucket") == bucket), None)
    # If a real OpenAI key has just been configured, do not keep serving an older demo fallback.
    if existing and not (OPENAI_API_KEY and existing.get("provider") == "local-demo"):
        return jsonify({"triggered": True, "cached": True, **existing, "adherence": adherence,
                        "animation_url": f"/api/adherence-risk/animation?adherence={adherence}"})
    prompt = build_risk_prompt(adherence, state.get("medications", []))
    filename = f"risk_{today}_{bucket}_{new_id()}.svg"
    out_path = os.path.join(UPLOAD_DIR, filename)
    provider = "local-demo"
    if OPENAI_API_KEY:
        try:
            payload = json.dumps({"model": OPENAI_IMAGE_MODEL, "prompt": prompt, "size": "1536x1024"}).encode("utf-8")
            req = urllib.request.Request("https://api.openai.com/v1/images/generations", data=payload,
                headers={"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"}, method="POST")
            with urllib.request.urlopen(req, timeout=90) as response:
                result = json.loads(response.read().decode("utf-8"))
            data = (result.get("data") or [{}])[0]
            image_b64 = data.get("b64_json")
            image_url = data.get("url")
            if image_b64:
                filename = f"risk_{today}_{bucket}_{new_id()}.png"
                out_path = os.path.join(UPLOAD_DIR, filename)
                with open(out_path, "wb") as f: f.write(base64.b64decode(image_b64))
                provider = "openai"
            elif image_url:
                filename = f"risk_{today}_{bucket}_{new_id()}.png"
                out_path = os.path.join(UPLOAD_DIR, filename)
                urllib.request.urlretrieve(image_url, out_path)
                provider = "openai"
            else:
                raise RuntimeError("No image returned")
        except Exception as exc:
            print(f"[Caretakers] OpenAI image generation fallback: {exc}")
    if provider == "local-demo":
        with open(out_path, "wb") as f: f.write(generate_local_risk_svg(adherence, state.get("medications", [])))
    item = {"id": new_id(), "date": today, "bucket": bucket, "adherence": adherence, "provider": provider,
            "filename": filename, "url": f"/api/adherence-risk/image/{filename}",
            "animation_url": f"/api/adherence-risk/animation?adherence={adherence}",
            "message": "Adherence is below 70%. Extra attention is recommended." if adherence < 70 else
                       "Adherence is below 75%. Review missed doses and follow the prescribed plan."}
    state.setdefault("ai_risk_images", []).insert(0, item)
    state["ai_risk_images"] = state["ai_risk_images"][:20]
    save_state()
    return jsonify({"triggered": True, **item})

@app.get("/api/adherence-risk/image/<path:filename>")
def adherence_risk_image(filename):
    return send_from_directory(UPLOAD_DIR, filename)

@app.get("/api/adherence-risk/animation")
def adherence_risk_animation():
    """Safari-friendly self-contained educational animation. Plays once, then stops."""
    try:
        adherence = max(0, min(100, int(request.args.get("adherence", medication_report().get("adherence", 67)))))
    except Exception:
        adherence = 67
    if adherence < 60: duration = 11000; level = "Very low adherence"; color = "#b91c1c"; final_text = "Please contact your care team promptly."
    elif adherence < 70: duration = 9000; level = "Urgent attention"; color = "#dc2626"; final_text = "Review the missed doses with your care team."
    else: duration = 7000; level = "Needs attention"; color = "#d97706"; final_text = "Review the missed doses and follow the prescribed plan."
    meds = state.get("medications", []) or []
    names=[]
    for med in meds[:4]:
        name = (med.get("name") or med.get("medicine")) if isinstance(med, dict) else str(med)
        if name: names.append(str(name))
    med_text = ", ".join(names) if names else "prescribed medicines"
    html = f"""<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Medication adherence animation</title>
<style>*{{box-sizing:border-box}}html,body{{margin:0;width:100%;height:100%;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;background:#0b1220;color:#172033}}body{{display:flex;align-items:center;justify-content:center;padding:12px}}.player{{width:100%;height:100%;max-width:1100px;display:flex;flex-direction:column;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.28)}}.top{{padding:12px 16px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;gap:10px}}.title{{font-size:clamp(14px,2vw,22px);font-weight:800}}.badge{{font-size:11px;font-weight:800;padding:6px 9px;border-radius:999px;background:#fee2e2;color:{color}}}.stage{{position:relative;flex:1;min-height:0;background:linear-gradient(135deg,#f8fafc,#eef4ff);overflow:hidden}}.scene{{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:clamp(14px,4vw,48px);opacity:0;transform:translateY(12px);transition:opacity .5s ease,transform .5s ease}}.scene.active{{opacity:1;transform:none}}.panel{{width:min(92%,820px);text-align:center;background:rgba(255,255,255,.97);border:1px solid #dbe4ef;border-radius:22px;padding:clamp(18px,4vw,40px);box-shadow:0 10px 35px rgba(15,23,42,.10)}}.icon{{width:clamp(68px,10vw,108px);height:clamp(68px,10vw,108px);margin:0 auto 16px;border-radius:50%;display:grid;place-items:center;background:#e0e7ff;color:#4f46e5;font-size:clamp(28px,5vw,48px)}}h2{{font-size:clamp(20px,3vw,34px);margin:0 0 10px}}p{{font-size:clamp(13px,1.8vw,18px);line-height:1.5;color:#64748b;margin:8px auto;max-width:700px}}.progress{{height:9px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin:20px auto 8px;max-width:620px}}.progress i{{display:block;height:100%;width:0;background:{color};border-radius:999px}}.meds{{font-weight:700;color:#334155;font-size:clamp(12px,1.6vw,16px)}}.human{{position:relative;width:120px;height:190px;margin:0 auto 18px}}.head{{position:absolute;width:48px;height:48px;border-radius:50%;background:#bfdbfe;left:36px;top:0}}.bodyshape{{position:absolute;width:62px;height:90px;border-radius:30px 30px 18px 18px;background:#93c5fd;left:29px;top:48px}}.arm{{position:absolute;width:18px;height:86px;background:#60a5fa;border-radius:12px;top:56px}}.arm.l{{left:17px;transform:rotate(22deg)}}.arm.r{{right:17px;transform:rotate(-22deg)}}.leg{{position:absolute;width:20px;height:70px;background:#60a5fa;border-radius:12px;top:128px}}.leg.l{{left:34px;transform:rotate(7deg)}}.leg.r{{right:34px;transform:rotate(-7deg)}}.heart{{position:absolute;left:47px;top:78px;font-size:26px;animation:pulse .9s ease-in-out 0s 4}}@keyframes pulse{{0%,100%{{transform:scale(1)}}50%{{transform:scale(1.25)}}}}.final{{border:2px solid #fecaca;background:#fff7f7}}.controls{{padding:12px 16px;background:#fff;border-top:1px solid #e2e8f0;display:flex;align-items:center;justify-content:center;gap:12px;min-height:60px}}button{{border:0;border-radius:11px;padding:10px 18px;font-weight:800;background:#2563eb;color:#fff;cursor:pointer;font-size:14px}}button:disabled{{opacity:.55;cursor:default}}.status{{font-size:12px;color:#64748b}}@media(max-width:520px){{body{{padding:5px}}.player{{border-radius:12px}}.top{{padding:9px 11px}}.panel{{width:96%;padding:18px 14px}}}}</style></head><body><div class=\"player\"><div class=\"top\"><div class=\"title\">🎬 What low medication adherence can mean</div><div class=\"badge\">{level} · {adherence}%</div></div><div class=\"stage\" id=\"stage\"><section class=\"scene active\" data-at=\"0\"><div class=\"panel\"><div class=\"icon\">💊</div><h2>Medication doses are being missed</h2><p>Current adherence is <strong>{adherence}%</strong>. Repeatedly missed doses can reduce consistency of a prescribed treatment.</p><div class=\"progress\"><i id=\"bar\"></i></div><p class=\"meds\">Tracked: {med_text}</p></div></section><section class=\"scene\" data-at=\"{int(duration*.28)}\"><div class=\"panel\"><div class=\"human\"><div class=\"head\"></div><div class=\"bodyshape\"></div><div class=\"arm l\"></div><div class=\"arm r\"></div><div class=\"leg l\"></div><div class=\"leg r\"></div><div class=\"heart\">♥</div></div><h2>Symptoms may return or worsen</h2><p>The effect depends on the medicine, condition and individual. This is an educational illustration, not a prediction.</p></div></section><section class=\"scene\" data-at=\"{int(duration*.58)}\"><div class=\"panel\"><div class=\"icon\">⚠️</div><h2>Control may become harder</h2><p>Consistent use of prescribed medicines can help keep treatment on track.</p></div></section><section class=\"scene\" data-at=\"{int(duration*.78)}\"><div class=\"panel\"><div class=\"icon\">🩺</div><h2>Review the missed doses</h2><p>{final_text}</p><p>Do not change or stop prescribed medication without professional guidance.</p></div></section><section class=\"scene\" data-at=\"{duration}\"><div class=\"panel final\"><div class=\"icon\">✓</div><h2>Animation complete</h2><p>This educational visualization has finished.</p></div></section></div><div class=\"controls\"><button id=\"start\" type=\"button\">▶ Start animation</button><span class=\"status\" id=\"status\">Ready</span></div></div><script>(function(){{const duration={duration},scenes=[...document.querySelectorAll('.scene')],start=document.getElementById('start'),status=document.getElementById('status'),bar=document.getElementById('bar');function show(i){{scenes.forEach((s,n)=>s.classList.toggle('active',n===i))}}function play(){{start.disabled=true;start.textContent='Playing…';status.textContent='Educational animation';const t0=performance.now();function tick(now){{const e=now-t0;bar.style.width=Math.min(100,e/duration*100)+'%';let idx=0;scenes.forEach((s,i)=>{{if(e>=Number(s.dataset.at||0))idx=i}});show(idx);if(e<duration)requestAnimationFrame(tick);else{{show(scenes.length-1);bar.style.width='100%';start.disabled=false;start.textContent='↻ Start animation again';status.textContent='Animation complete'}}}}requestAnimationFrame(tick)}}start.addEventListener('click',play);setTimeout(play,300)}})();</script></body></html>"""
    return Response(html, mimetype="text/html")

@app.get("/api/prescriptions")
def list_prescriptions():
    return jsonify({"prescriptions": state.get("prescriptions", [])[:50]})

@app.post("/api/prescriptions")
def upload_prescription():
    uploaded = request.files.get("prescription") or request.files.get("file")
    role = (request.form.get("role") or "patient").strip().lower()
    if role not in {"patient", "doctor", "caretaker"}: role = "patient"
    if not uploaded or not uploaded.filename: return jsonify({"error": "Please select a prescription or medicine file."}), 400
    if not allowed_upload(uploaded.filename): return jsonify({"error": "Allowed files: PNG, JPG, JPEG, WEBP or PDF."}), 400
    safe_name = re.sub(r"[^A-Za-z0-9_.-]", "_", uploaded.filename)
    filename = f"{new_id()}_{safe_name}"
    uploaded.save(os.path.join(UPLOAD_DIR, filename))
    item = {"id": new_id(), "filename": filename, "original_name": uploaded.filename, "role": role,
            "uploaded_by": role.title(), "uploaded_at": now_time(), "url": f"/api/prescriptions/file/{filename}",
            "status": "Uploaded — awaiting review"}
    state.setdefault("prescriptions", []).insert(0, item)
    state["prescriptions"] = state["prescriptions"][:100]
    save_state()
    return jsonify({"success": True, "prescription": item}), 201

@app.get("/api/prescriptions/file/<path:filename>")
def prescription_file(filename):
    return send_from_directory(UPLOAD_DIR, filename, as_attachment=False)

# ============================================================
# MAIN PAGE
# ============================================================

@app.get("/")
def index():

    return render_template("index.html")


# ============================================================
# CARETAKER PAGE
# ============================================================

@app.get("/caretaker")
def caretaker_page():

    return render_template("caretaker.html")


@app.get("/caregiver")
def caregiver_compat_page():
    return caretaker_page()


# ============================================================
# DOCTOR PAGE
# ============================================================

@app.get("/doctor")
def doctor_page():

    return render_template("doctor.html")


# ============================================================
# HEALTH
# ============================================================

@app.get("/api/health")
def health():
    return jsonify(state["health"])


# ============================================================
# DEVICE
# ============================================================

@app.post("/api/device/connect")
def connect_device():

    data = request.get_json(
        silent=True
    ) or {}

    name = (
        data.get("name")
        or "Caretakers Demo Watch"
    )

    state["device"] = {

        "connected": True,

        "name": name,

        "last_sync": now_time(),

        "status": "Connected",
    }

    save_state()

    return jsonify({

        "success": True,

        "device": state["device"],

        "message": "Device linked successfully",
    })


@app.post("/api/device/disconnect")
def disconnect_device():

    state["device"] = {

        "connected": False,

        "name": None,

        "last_sync": None,

        "status": "Disconnected",
    }

    save_state()

    return jsonify(
        state["device"]
    )


@app.get("/api/device")
def device_status():

    return jsonify(
        state["device"]
    )


# ============================================================
# DEVICE SYNC
# ============================================================

@app.post("/api/device/sync")
def sync_device():

    if not state["device"]["connected"]:

        return jsonify({

            "success": False,

            "error":
                "No device connected",

        }), 400

    state["device"]["last_sync"] = now_time()

    save_state()

    return jsonify({

        "success": True,

        "last_sync":
            state["device"]["last_sync"],

        "message":
            "Health data synced successfully",

    })


# ============================================================
# SOS

# ============================================================

@app.post("/api/sos")
def sos():

    data = request.get_json(silent=True) or {}

    alert = {
        "id":
            new_id(),
        "type":
            "emergency",
        "title":
            "Emergency SOS",
        "message":
            (
                data.get("message")
                or
                "Emergency SOS triggered from Caretakers."
            ).strip(),
        "time":
            now_time(),
        "severity":
            "high",
    }

    state["alerts"].insert(
        0,
        alert
    )

    save_state()

    return jsonify({
        "success": True,
        **alert
    })


# ============================================================
# ALERTS
# ============================================================

@app.get("/api/alerts")
def alerts():

    return jsonify(
        state["alerts"]
    )


# ============================================================
# CARETAKERS
# ============================================================

@app.get("/api/caretakers")
def get_caretakers():

    return jsonify(
        state["caretakers"]
    )


@app.post("/api/caretakers")
def add_caretaker():

    data = request.get_json(
        silent=True
    ) or {}

    name = (
        data.get("name")
        or ""
    ).strip()

    relationship = (
        data.get("relationship")
        or "Family caretaker"
    ).strip()

    phone = (
        data.get("phone")
        or "Not provided"
    ).strip()

    access = (
        data.get("access")
        or "Full health access"
    ).strip()

    if not name:

        return jsonify({

            "error":
                "Caretaker name is required"

        }), 400

    caretaker = {

        "id":
            new_id(),

        "name":
            name,

        "relationship":
            relationship,

        "phone":
            phone,

        "access":
            access,

        "status":
            "Active",

        "last_active":
            "Just now",
    }

    state["caretakers"].insert(
        0,
        caretaker
    )

    save_state()

    return jsonify(
        caretaker
    ), 201


@app.delete(
    "/api/caretakers/<int:caretaker_id>"
)
def delete_caretaker(
    caretaker_id
):

    before = len(
        state["caretakers"]
    )

    state["caretakers"] = [

        caretaker

        for caretaker
        in state["caretakers"]

        if caretaker["id"]
        != caretaker_id
    ]

    if len(state["caretakers"]) == before:

        return jsonify({

            "error":
                "Caretaker not found"

        }), 404

    save_state()

    return jsonify({

        "success":
            True
    })


# ============================================================
# DOCTORS
# ============================================================

@app.get("/api/doctors")
def doctors():

    return jsonify(
        DOCTORS
    )


@app.get("/api/doctors/<doctor_id>")
def doctor_profile(
    doctor_id
):

    doctor = next(

        (
            doctor

            for doctor
            in DOCTORS

            if doctor["id"]
            == doctor_id
        ),

        None
    )

    if not doctor:

        return jsonify({

            "error":
                "Doctor not found"

        }), 404

    return jsonify(
        doctor
    )


# ============================================================
# APPOINTMENTS
# ============================================================

@app.get("/api/appointments")
def get_appointments():

    return jsonify(
        state["appointments"]
    )


@app.post("/api/appointments")
def create_appointment():

    data = request.get_json(
        silent=True
    ) or {}

    doctor_id = data.get(
        "doctor_id"
    )

    doctor = next(

        (
            doctor

            for doctor
            in DOCTORS

            if doctor["id"]
            == doctor_id
        ),

        None
    )

    if not doctor:

        return jsonify({

            "error":
                "Doctor not found"

        }), 404

    appointment = {

        "id":
            new_id(),

        "doctor_id":
            doctor["id"],

        "doctor":
            doctor["name"],

        "specialty":
            doctor["specialty"],

        "date":
            (
                data.get("date")
                or "Tomorrow"
            ).strip(),

        "time":
            (
                data.get("time")
                or doctor["next_slot"]
            ).strip(),

        "status":
            "Requested",

        "reason":
            (
                data.get("reason")
                or "General consultation"
            ).strip(),

        "mode":
            (
                data.get("mode")
                or "Offline"
            ).strip(),

        "hospital":
            doctor["hospital"],
    }

    state["appointments"].insert(
        0,
        appointment
    )

    save_state()

    return jsonify(
        appointment
    ), 201


# ============================================================
# MEDICATIONS
# ============================================================

@app.patch("/api/appointments/<int:appointment_id>/status")
def update_appointment_status(appointment_id):
    data = request.get_json(silent=True) or {}
    status = (data.get("status") or "").strip().title()

    if status not in ["Confirmed", "Rejected", "Requested"]:
        return jsonify({
            "error": "Status must be Confirmed, Rejected or Requested"
        }), 400

    appointment = next(
        (
            item
            for item in state["appointments"]
            if str(item.get("id")) == str(appointment_id)
        ),
        None
    )

    if not appointment:
        return jsonify({
            "error": "Appointment not found"
        }), 404

    appointment["status"] = status
    save_state()

    return jsonify({
        "success": True,
        "appointment": appointment
    })


@app.get("/api/clinical-notes")
def get_clinical_notes():
    return jsonify({
        "notes": state.get("clinical_notes", [])
    })


@app.post("/api/clinical-notes")
def create_clinical_note():
    data = request.get_json(silent=True) or {}

    note_text = (data.get("note") or "").strip()

    if not note_text:
        return jsonify({
            "error": "Clinical note is required"
        }), 400

    note = {
        "id": new_id(),
        "doctor": "Dr. Sarah Chen",
        "patient": "Deeptanshu",
        "note": note_text,
        "created_at": now_time()
    }

    if "clinical_notes" not in state:
        state["clinical_notes"] = []

    state["clinical_notes"].insert(0, note)

    save_state()

    return jsonify(note), 201


@app.get("/api/medications")
def get_medications():

    return jsonify({

        "medications":
            state["medications"],

        "report":
            medication_report(),

        "log":
            state["medication_log"],
    })


@app.post("/api/medications")
def add_medication():

    data = request.get_json(
        silent=True
    ) or {}

    name = (
        data.get("name")
        or ""
    ).strip()

    dosage = (
        data.get("dosage")
        or ""
    ).strip()

    time = (
        data.get("time")
        or ""
    ).strip()

    frequency = (
        data.get("frequency")
        or "Once daily"
    ).strip()

    instructions = (
        data.get("instructions")
        or ""
    ).strip()

    if not name:

        return jsonify({

            "error":
                "Medicine name is required"

        }), 400

    medication = {

        "id":
            new_id(),

        "name":
            name,

        "dosage":
            dosage,

        "frequency":
            frequency,

        "time":
            time,

        "instructions":
            instructions,

        "active":
            True,
    }

    state["medications"].append(
        medication
    )

    save_state()

    return jsonify(
        medication
    ), 201


# ============================================================
# MARK MEDICATION TAKEN / MISSED
# ============================================================

@app.post("/api/medications/<int:medication_id>/status")
def medication_status(
    medication_id
):

    data = request.get_json(
        silent=True
    ) or {}

    status = (
        data.get("status")
        or ""
    ).strip().title()

    if status not in [
        "Taken",
        "Missed",
        "Pending"
    ]:

        return jsonify({

            "error":
                "Status must be Taken, Missed or Pending"

        }), 400

    medication = next(

        (
            medication

            for medication
            in state["medications"]

            if medication["id"]
            == medication_id
        ),

        None
    )

    if not medication:

        return jsonify({

            "error":
                "Medication not found"

        }), 404

    log_entry = {

        "id":
            new_id(),

        "medication_id":
            medication["id"],

        "medicine":
            medication["name"],

        "dosage":
            medication["dosage"],

        "scheduled_time":
            medication["time"],

        "date":
            now_date(),

        "status":
            status,

        "recorded_at":
            now_time(),
    }

    state["medication_log"].insert(
        0,
        log_entry
    )

    save_state()

    return jsonify({

        "success":
            True,

        "entry":
            log_entry,

        "report":
            medication_report(),
    })


# ============================================================
# MEDICATION REPORT
# ============================================================

@app.get("/api/medications/report")
def medication_report_api():

    report = medication_report()

    return jsonify({

        "report":
            report,

        "medications":
            state["medications"],

        "history":
            state["medication_log"],
    })


# ============================================================
# MEDICINE CATALOG
# ============================================================

@app.get("/api/medicine-catalog")
def medicine_catalog():

    return jsonify(
        MEDICINE_CATALOG
    )


# ============================================================
# MEDICINE PURCHASE
# ============================================================

@app.get("/api/medicine-orders")
def medicine_orders():
    return jsonify({
        "orders": state.get("orders", [])
    })


@app.post("/api/medicine-orders")
def create_medicine_order():

    data = request.get_json(
        silent=True
    ) or {}

    medicine_id = data.get(
        "medicine_id"
    )

    medicine = next(

        (
            medicine

            for medicine
            in MEDICINE_CATALOG

            if medicine["id"]
            == medicine_id
        ),

        None
    )

    if not medicine:

        return jsonify({

            "error":
                "Medicine not found"

        }), 404

    quantity = int(
        data.get("quantity", 1)
    )

    quantity = max(
        1,
        quantity
    )

    total = (
        medicine["price"]
        * quantity
    )

    order = {

        "id":
            new_id(),

        "medicine_id":
            medicine["id"],

        "medicine":
            medicine["name"],

        "strength":
            medicine["strength"],

        "quantity":
            quantity,

        "total":
            total,

        "status":
            "Payment pending",

        "created_at":
            now_time(),
    }

    state["orders"].insert(
        0,
        order
    )

    save_state()

    return jsonify(
        order
    ), 201


# ============================================================
# SERVICE OPTIONS
#
# IMPORTANT:
# Every service gives EXACTLY TWO choices:
#
# 1. Online
# 2. WhatsApp
# ============================================================

@app.post("/api/service-options")
def service_options():

    data = request.get_json(
        silent=True
    ) or {}

    service = (
        data.get("service")
        or "support"
    ).strip().lower()

    allowed_services = [

        "doubt",

        "medicine",

        "doctor",

        "hospital",

        "consultation",

        "support",
    ]

    if service not in allowed_services:

        service = "support"

    return jsonify({

        "service":
            service,

        "options": [

            {
                "id":
                    "online",

                "label":
                    "Online",

                "description":
                    "Continue through Caretakers",
            },

            {
                "id":
                    "whatsapp",

                "label":
                    "WhatsApp",

                "description":
                    "Continue through WhatsApp",
            },
        ],
    })


# ============================================================
# WHATSAPP SERVICE LINK
# ============================================================

@app.post("/api/service/whatsapp")
def service_whatsapp():

    data = request.get_json(
        silent=True
    ) or {}

    service = (
        data.get("service")
        or "support"
    )

    message = (
        data.get("message")
        or (
            "Hello Caretakers Care Team, "
            f"I need help with {service}."
        )
    )

    # Demo care-team WhatsApp number.
    # Replace this with your actual number later.
    phone = os.getenv(
        "CARETAKERS_WHATSAPP_NUMBER",
        "919876543210"
    )

    url = whatsapp_url(
        phone,
        message
    )

    return jsonify({

        "success":
            True,

        "service":
            service,

        "whatsapp_url":
            url,

        "message":
            "WhatsApp conversation prepared.",
    })


# ============================================================
# PAYMENT SESSION
#
# Payment is generated ONLY when payment starts.
# ============================================================

@app.post("/api/payment/create")
def create_payment():

    data = request.get_json(
        silent=True
    ) or {}

    amount = data.get(
        "amount"
    )

    try:

        amount = float(amount)

    except (
        TypeError,
        ValueError
    ):

        return jsonify({

            "error":
                "Valid payment amount is required"

        }), 400

    if amount <= 0:

        return jsonify({

            "error":
                "Payment amount must be greater than zero"

        }), 400

    reference = (
        "CARETAKERS-"
        + str(new_id())
    )

    payment = {

        "id":
            new_id(),

        "reference":
            reference,

        "amount":
            round(amount, 2),

        "status":
            "Pending",

        "created_at":
            now_time(),
    }

    state["payments"].insert(
        0,
        payment
    )

    save_state()

    return jsonify({

        "success":
            True,

        "payment":
            payment,

        "message":
            "Fresh payment session created.",
    }), 201


# ============================================================
# GENERATE PAYMENT QR
# ============================================================

@app.get("/api/payment/<reference>/qr")
def payment_qr(
    reference
):

    payment = next(

        (
            payment

            for payment
            in state["payments"]

            if payment["reference"]
            == reference
        ),

        None
    )

    if not payment:

        return jsonify({

            "error":
                "Payment session not found"

        }), 404

    if qrcode is None:

        return jsonify({

            "error":
                "QR support is not installed. "
                "Run: pip install qrcode[pil]"

        }), 500

    # --------------------------------------------------------
    # DEMO UPI URI
    #
    # Replace merchant details for a real payment setup.
    # --------------------------------------------------------

    upi_id = os.getenv(
        "CARETAKERS_UPI_ID",
        "caretakers@upi"
    )

    merchant_name = "Caretakers"

    amount = payment["amount"]

    import urllib.parse

    upi_uri = (
        "upi://pay?"
        + urllib.parse.urlencode({

            "pa":
                upi_id,

            "pn":
                merchant_name,

            "am":
                f"{amount:.2f}",

            "cu":
                "INR",

            "tn":
                payment["reference"],
        })
    )

    qr_image = qrcode.make(
        upi_uri
    )

    output = io.BytesIO()

    qr_image.save(
        output,
        format="PNG"
    )

    output.seek(0)

    return send_file(
        output,
        mimetype="image/png",
        download_name=(
            f"{reference}.png"
        )
    )


# ============================================================
# WHATSAPP PAYMENT
# ============================================================

@app.post("/api/payment/whatsapp")
def whatsapp_payment():

    data = request.get_json(
        silent=True
    ) or {}

    reference = data.get(
        "reference"
    )

    payment = next(

        (
            payment

            for payment
            in state["payments"]

            if payment["reference"]
            == reference
        ),

        None
    )

    if not payment:

        return jsonify({

            "error":
                "Payment session not found"

        }), 404

    phone = os.getenv(
        "CARETAKERS_WHATSAPP_NUMBER",
        "919876543210"
    )

    message = (

        "Hello Caretakers, I want to complete "
        "payment for reference "
        f"{payment['reference']} "
        f"for ₹{payment['amount']:.2f}."
    )

    url = whatsapp_url(
        phone,
        message
    )

    return jsonify({

        "success":
            True,

        "whatsapp_url":
            url,

        "reference":
            payment["reference"],

        "amount":
            payment["amount"],
    })


# ============================================================
# PAYMENT STATUS
# ============================================================

@app.post("/api/payment/<reference>/complete")
def complete_payment(reference):
    payment = next(
        (
            payment
            for payment in state["payments"]
            if payment["reference"] == reference
        ),
        None
    )

    if not payment:
        return jsonify({
            "error": "Payment session not found"
        }), 404

    # --------------------------------------------------------
    # Mark payment itself as PAID
    # --------------------------------------------------------

    payment["status"] = "Paid"

    data = request.get_json(
        silent=True
    ) or {}

    order_id = data.get("order_id")

    matched_order = None

    # --------------------------------------------------------
    # First choice: exact order ID
    # --------------------------------------------------------

    if order_id is not None:

        for order in state.get("orders", []):

            if str(order.get("id")) == str(order_id):

                order["status"] = "Paid"
                order["payment_reference"] = reference
                matched_order = order
                break

    # --------------------------------------------------------
    # Fallback: automatically match the newest pending order
    # having the same amount as this payment.
    # --------------------------------------------------------

    if matched_order is None:

        payment_amount = float(
            payment.get("amount", 0)
        )

        for order in state.get("orders", []):

            try:
                order_total = float(
                    order.get("total", 0)
                )
            except (
                TypeError,
                ValueError
            ):
                continue

            if (
                order.get("status") == "Payment pending"
                and abs(order_total - payment_amount) < 0.01
            ):

                order["status"] = "Paid"
                order["payment_reference"] = reference
                matched_order = order
                break

    # --------------------------------------------------------
    # Persist everything
    # --------------------------------------------------------

    try:
        save_state()
    except Exception as error:
        print(
            "Could not persist payment/order state:",
            error
        )

    return jsonify({
        "success": True,
        "payment": payment,
        "order": matched_order,
    })


# ============================================================
# UNIFIED CHAT / AI
# ============================================================

@app.post("/api/chat")
def chat():

    data = request.get_json(
        silent=True
    ) or {}

    message = (
        data.get("message")
        or ""
    ).strip()

    mode = (
        data.get("mode")
        or "ai"
    ).strip().lower()

    if not message:

        return jsonify({

            "error":
                "Message is required"

        }), 400

    # --------------------------------------------------------
    # AI MODE
    # --------------------------------------------------------

    if mode == "ai":

        reply = get_ai_reply(
            message
        )

    # --------------------------------------------------------
    # CARE TEAM MODE
    # --------------------------------------------------------

    elif mode == "care":

        reply = (
            "Your message has been added to the "
            "Caretakers Care Team queue. A care-team "
            "member can review it and respond."
        )

    else:

        reply = get_ai_reply(
            message
        )

    state["messages"].append({

        "user":
            message,

        "assistant":
            reply,

        "mode":
            mode,

        "time":
            now_time(),
    })

    save_state()

    return jsonify({

        "reply":
            reply,

        "mode":
            mode,
    })


# ============================================================
# CHAT HISTORY
# ============================================================

@app.get("/api/patient-messages")
def get_patient_messages():
    return jsonify({
        "messages": state.get("patient_messages", [])
    })


@app.post("/api/patient-messages")
def create_patient_message():
    data = request.get_json(silent=True) or {}
    message = (data.get("message") or "").strip()

    if not message:
        return jsonify({
            "error": "Message is required"
        }), 400

    item = {
        "id": new_id(),
        "from": "Doctor",
        "doctor": "Dr. Sarah Chen",
        "patient": "Deeptanshu",
        "message": message,
        "time": now_time()
    }

    if "patient_messages" not in state:
        state["patient_messages"] = []

    state["patient_messages"].insert(0, item)

    save_state()

    return jsonify(item), 201


@app.get("/api/chat/history")
def chat_history():

    return jsonify(
        state["messages"][-50:]
    )


# ============================================================
# CARETAKER DASHBOARD
# ============================================================

@app.get(
    "/api/caretaker/dashboard"
)
def caretaker_dashboard():

    h = state["health"]

    medication = medication_report()

    return jsonify({

        "role":
            "Caretaker",

        "patient": {

            "name":
                "Patient",

            "status":
                "Stable",

            "age":
                24,

            "care_plan":
                "Continuous wellness monitoring",
        },

        "health":
            h,

        "device":
            state["device"],

        "caretakers":
            state["caretakers"],

        "appointments":
            state["appointments"][:5],

        "alerts":
            state["alerts"][:5],

        "medication":
            medication,

        "medication_history":
            state["medication_log"][:20],

        "trends": {

            "heart_rate":
                "Stable",

            "activity":
                "+12% this week",

            "sleep":
                "Needs attention Tuesday",

            "oxygen":
                "Stable",
        },
    })


# ============================================================
# DOCTOR DASHBOARD
# ============================================================

@app.get(
    "/api/doctor/dashboard"
)
def doctor_dashboard():

    h = state["health"]

    medication = medication_report()

    return jsonify({

        "role":
            "Doctor",

        "doctor": {

            "name":
                "Dr. Sarah Chen",

            "specialty":
                "Cardiologist",

            "status":
                "Available",
        },

        "patient": {

            "name":
                "Patient",

            "age":
                24,

            "status":
                "Stable",

            "risk":
                "Low",

            "last_review":
                "Today, 10:15 AM",
        },

        "health":
            h,

        "appointments":
            state["appointments"][:8],

        "alerts":
            state["alerts"][:8],

        "medication":
            medication,

        "medication_history":
            state["medication_log"][:30],

        "clinical": {

            "heart_rate_trend":
                "Within baseline",

            "spo2_trend":
                "Stable",

            "activity_trend":
                "Improving",

            "follow_up":
                "Review in 7 days",
        },
    })


# ============================================================
# SYSTEM STATUS
# ============================================================

@app.get("/api/system")
def system_status():

    return jsonify({

        "app":
            "Caretakers",

        "status":
            "Online",

        "ai_provider":
            AI_PROVIDER,

        "device":
            state["device"],

        "medication":
            medication_report(),

        "appointments":
            len(state["appointments"]),

        "caretakers":
            len(state["caretakers"]),

        "alerts":
            len(state["alerts"]),

        "storage":
            "JSON backend persistence",

        "features": [
            "patient_dashboard",
            "medications",
            "medication_alerts",
            "adherence_report",
            "caretaker_dashboard",
            "doctor_dashboard",
            "unified_assist",
            "groq_nvidia_ai",
            "online_whatsapp_services",
            "appointment_booking",
            "dynamic_upi_qr",
            "ai_adherence_risk_visuals",
            "camera_prescription_upload",
            "doctor_caretaker_prescription_updates",
        ],
    })


# ============================================================
# START SERVER
# ============================================================

if __name__ == "__main__":

    app.run(

        debug=True,

        host="127.0.0.1",

        port=5000
    )
