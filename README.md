# Caretakers Hackathon Prototype

Software-only prototype using HTML/CSS/JavaScript + Python Flask.

## Run

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Open https://caretakers.onrender.com/ in a browser.

## Demo flow

1. Click **Connect device**.
2. If Web Bluetooth is supported, choose a nearby device; otherwise the app falls back to a **Caretakers Demo Watch**.
3. Health cards update from the Flask API.
4. Use the AI tab to ask about trends, heart rate, medication, or alerts.
5. Click **SOS** to create a demo emergency alert.

Bluetooth support depends on the browser/device and the wearable's exposed Bluetooth services. The demo-device fallback keeps the hackathon presentation reliable.


## Caretakers full feature build

This version includes the requested hackathon flow:
- Patient health overview and wearable sync
- Medication tracking, dose reminders, taken/missed logging and adherence report
- Caretaker monitoring dashboard
- Doctor clinical dashboard
- Unified Assist with Caretakers AI and Care Team
- Groq / NVIDIA provider configuration
- Doubt support, medicine purchase, doctor consultation and hospital visit
- Online / WhatsApp service paths
- Appointment booking with date/time
- Payment sessions, WhatsApp payment and dynamic UPI QR
- Backend JSON persistence for demo data
- System feature/status endpoint

### AI environment variables

Set `AI_PROVIDER` to `demo`, `groq`, or `nvidia`.
For Groq: `GROQ_API_KEY` and optionally `GROQ_MODEL`.
For NVIDIA: `NVIDIA_API_KEY` and optionally `NVIDIA_MODEL`.

### Payment / WhatsApp environment variables

- `CARETAKERS_WHATSAPP_NUMBER`
- `CARETAKERS_UPI_ID`

The payment and WhatsApp flows are demonstration integrations; replace the demo merchant/contact values before production use.

### Medication notifications

Caretakers checks `/api/medications/today` while the patient web app is open. Browser notifications are requested when supported. For true background push/SMS/WhatsApp reminders, connect a production notification provider.


## Recent UI updates
- Brand logo now uses **C** for Caretakers.
- Patient Medicines tab shows the AI adherence-risk visual only when adherence is below 75%; the prescription center is restricted to Doctor and Caretaker dashboards.
- Patient, Doctor and Caretaker dashboards include a quick role switcher.
- Adherence messaging changes by percentage, with low adherence clearly flagged.
- Doctor and Caretaker medicine-entry panels are larger and easier to use.

## Medication AI visual

The Patient → Medicines page automatically calls `/api/adherence-risk` when adherence is below 75%. Below 70% is treated as urgent attention. If `OPENAI_API_KEY` is configured, the server requests an image from OpenAI using `OPENAI_IMAGE_MODEL` (default: `gpt-image-1`). If no key is configured or the AI request fails, the app creates an educational local fallback so the prototype still shows a visual during demos.

For a real AI-generated image, set your key before starting Flask:

```bash
export OPENAI_API_KEY="your_key_here"
export OPENAI_IMAGE_MODEL="gpt-image-1"
python3 app.py
```

The Patient → Medicines page also includes prescription upload with a mobile camera capture option (`capture="environment"`). Doctor and Caretaker prescription uploads remain available on their dashboards.

## v7 adaptive animation behavior
- Adherence risk now determines an attention band: emergency (<40%), urgent (40–49%), high (50–59%), moderate (60–74%), or low (75%+).
- When a NEW adherence/risk signature is detected, the educational animation starts automatically once.
- The animation advances through all stages and ends on a completion screen.
- It never automatically loops or restarts after completion. Replay requires the visible button.
- Refreshes with identical patient data do not restart the animation.
- The UI intentionally avoids displaying a fixed total duration such as “9 seconds”; it shows “Adaptive playback”.
