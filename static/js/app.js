"use strict";

/* =========================================================
   CARETAKERS FRONTEND
   ========================================================= */

let currentHealth = {
    heart_rate: 78,
    steps: 6421,
    spo2: 98,
    calories: 342,
    hrv: 62,
    status: "Normal"
};

let deviceConnected = false;
let deviceName = null;
let currentCareRole = "caretaker";
let doctorsCache = [];
let selectedDoctor = null;


/* =========================================================
   BASIC HELPERS
   ========================================================= */

function $(id) {
    return document.getElementById(id);
}

function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = String(value ?? "");
    return div.innerHTML;
}

function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value;
}

function setAllText(id, value) {
    document.querySelectorAll("#" + id).forEach(el => {
        el.textContent = value;
    });
}

function showToast(message) {
    let toast = $("caretakers-toast");

    if (!toast) {
        toast = document.createElement("div");
        toast.id = "caretakers-toast";

        toast.style.cssText = `
            position:fixed;
            left:50%;
            bottom:100px;
            transform:translateX(-50%);
            background:#172033;
            color:#fff;
            padding:13px 18px;
            border-radius:12px;
            font-size:14px;
            font-weight:700;
            z-index:999999;
            box-shadow:0 10px 30px rgba(0,0,0,.2);
            max-width:90%;
            text-align:center;
            transition:opacity .25s ease;
        `;

        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.style.opacity = "1";

    clearTimeout(window.caretakersToastTimer);

    window.caretakersToastTimer = setTimeout(() => {
        toast.style.opacity = "0";
    }, 2500);
}


/* =========================================================
   API HELPER
   ========================================================= */

async function api(url, options = {}) {

    const response = await fetch(url, {
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        },
        ...options
    });

    if (!response.ok) {

        let message = "Request failed";

        try {
            const data = await response.json();
            message = data.error || data.message || message;
        } catch (_) {}

        throw new Error(message + " (" + response.status + ")");
    }

    return response.json();
}


/* =========================================================
   MODAL
   ========================================================= */

function injectModalStyles() {

    if ($("caretakers-modal-styles")) return;

    const style = document.createElement("style");

    style.id = "caretakers-modal-styles";

    style.textContent = `
        .caretakers-modal-overlay {
            position:fixed;
            inset:0;
            background:rgba(15,23,42,.55);
            backdrop-filter:blur(4px);
            z-index:99990;
            display:flex;
            align-items:center;
            justify-content:center;
            padding:18px;
        }

        .caretakers-modal {
            width:100%;
            max-width:480px;
            max-height:88vh;
            overflow:auto;
            background:#fff;
            border-radius:22px;
            box-shadow:0 24px 70px rgba(0,0,0,.25);
            padding:22px;
        }

        .caretakers-modal h3 {
            margin:0;
            font-size:22px;
            font-weight:800;
        }

        .caretakers-field {
            margin-top:14px;
        }

        .caretakers-field label {
            display:block;
            font-size:12px;
            font-weight:700;
            margin-bottom:6px;
            color:#64748b;
        }

        .caretakers-field input,
        .caretakers-field select,
        .caretakers-field textarea {
            width:100%;
            border:1px solid #d7dee9;
            border-radius:12px;
            padding:12px 13px;
            outline:none;
            font-size:14px;
            box-sizing:border-box;
            background:#fff;
        }

        .caretakers-field input:focus,
        .caretakers-field select:focus,
        .caretakers-field textarea:focus {
            border-color:#2563eb;
        }

        .caretakers-modal-actions {
            display:flex;
            gap:10px;
            margin-top:20px;
        }

        .caretakers-modal-actions button {
            flex:1;
            border:0;
            border-radius:12px;
            padding:12px;
            font-weight:800;
            cursor:pointer;
        }

        .v-primary {
            background:#2563eb;
            color:#fff;
        }

        .v-secondary {
            background:#eef2f7;
            color:#334155;
        }

        .v-danger {
            background:#fee2e2;
            color:#b91c1c;
        }

        .v-chip {
            display:inline-flex;
            align-items:center;
            gap:5px;
            padding:6px 10px;
            border-radius:999px;
            background:#eff6ff;
            color:#2563eb;
            font-size:11px;
            font-weight:800;
        }
    `;

    document.head.appendChild(style);
}

function openModal(html) {

    injectModalStyles();

    const old = $("caretakers-modal-overlay");

    if (old) old.remove();

    const overlay = document.createElement("div");

    overlay.id = "caretakers-modal-overlay";
    overlay.className = "caretakers-modal-overlay";

    overlay.innerHTML = `
        <div class="caretakers-modal">
            ${html}
        </div>
    `;

    overlay.addEventListener("click", event => {
        if (event.target === overlay) {
            closeModal();
        }
    });

    document.body.appendChild(overlay);

    return overlay;
}

function closeModal() {

    const overlay = $("caretakers-modal-overlay");

    if (overlay) {
        overlay.remove();
    }
}


/* =========================================================
   HEALTH
   ========================================================= */

async function loadHealth() {

    try {

        const data = await api("/api/health");

        currentHealth = {
            ...currentHealth,
            ...data
        };

        updateHealthUI();

    } catch (error) {

        console.warn("Health data unavailable:", error);
    }
}

function updateHealthUI() {

    setAllText(
        "heart-rate-value",
        currentHealth.heart_rate
    );

    setAllText(
        "steps-value",
        Number(currentHealth.steps).toLocaleString()
    );

    setAllText(
        "spo2-value",
        currentHealth.spo2
    );

    setAllText(
        "calories-value",
        currentHealth.calories
    );

    setAllText(
        "hrv-value",
        currentHealth.hrv
    );

    document.querySelectorAll(
        "[data-health='heart-rate']"
    ).forEach(el => {
        el.textContent = currentHealth.heart_rate;
    });

    document.querySelectorAll(
        "[data-health='spo2']"
    ).forEach(el => {
        el.textContent = currentHealth.spo2 + "%";
    });

    document.querySelectorAll(
        "[data-health='steps']"
    ).forEach(el => {
        el.textContent =
            Number(currentHealth.steps).toLocaleString();
    });

    document.querySelectorAll(
        "[data-health='hrv']"
    ).forEach(el => {
        el.textContent =
            currentHealth.hrv + " ms";
    });

    const stepsPercent =
        Math.min(
            100,
            Math.round(
                Number(currentHealth.steps) / 10000 * 100
            )
        );

    const caloriesPercent =
        Math.min(
            100,
            Math.round(
                Number(currentHealth.calories) / 500 * 100
            )
        );

    document.querySelectorAll(
        "[data-progress='steps']"
    ).forEach(el => {
        el.style.width = stepsPercent + "%";
    });

    document.querySelectorAll(
        "[data-progress='calories']"
    ).forEach(el => {
        el.style.width = caloriesPercent + "%";
    });
}


/* =========================================================
   MEDICATIONS
   ========================================================= */

/*
   THIS IS THE IMPORTANT PART.

   YES / NO:
   1. Sends response to Flask
   2. Gets fresh medication report
   3. Updates Taken
   4. Updates Missed
   5. Updates adherence %
   6. Updates progress bars
   7. Reloads medication cards
*/


async function respondMedication(id, response) {

    try {

        /* -----------------------------------------
           SAVE THE DOSE
           ----------------------------------------- */

        await api(
            "/api/medications/" + id + "/status",
            {
                method: "POST",
                body: JSON.stringify({
                    status:
                        response === "taken"
                            ? "Taken"
                            : response === "missed"
                                ? "Missed"
                                : "Pending"
                })
            }
        );


        /* -----------------------------------------
           GET FRESH REPORT
           ----------------------------------------- */

        const report =
            await api("/api/medications/report");


        /*
           Backend versions can return the numbers
           in slightly different structures.
           This handles all of them.
        */

        const source =
            report.summary ||
            report.report ||
            report.data ||
            report;


        let taken =
            Number(
                source.taken ??
                source.taken_count ??
                report.taken ??
                report.taken_count ??
                0
            );

        let missed =
            Number(
                source.missed ??
                source.missed_count ??
                report.missed ??
                report.missed_count ??
                0
            );

        let pending =
            Number(
                source.pending ??
                source.pending_count ??
                report.pending ??
                report.pending_count ??
                0
            );


        /* -----------------------------------------
           FIND ADHERENCE
           ----------------------------------------- */

        let adherence =
            source.adherence ??
            source.adherence_rate ??
            source.rate ??
            report.adherence ??
            report.adherence_rate ??
            report.rate;


        /*
           If backend doesn't directly return %
           calculate it ourselves.
        */

        if (
            adherence === undefined ||
            adherence === null ||
            adherence === ""
        ) {

            const total =
                taken + missed;

            if (total > 0) {
                adherence =
                    Math.round(
                        (taken / total) * 100
                    );
            } else {
                adherence = 0;
            }
        }


        adherence =
            Number(adherence);


        /*
           Some backends return 0.92 instead of 92.
        */

        if (
            adherence > 0 &&
            adherence <= 1
        ) {
            adherence =
                Math.round(adherence * 100);
        }


        adherence =
            Math.max(
                0,
                Math.min(
                    100,
                    Math.round(adherence)
                )
            );


        /* -----------------------------------------
           UPDATE TAKEN
           ----------------------------------------- */

        [
            "med-taken",
            "taken-count",
            "medication-taken",
            "report-taken"
        ].forEach(id => {
            setText(id, taken);
        });


        /*
           Also support cards using data attributes.
        */

        document.querySelectorAll(
            "[data-med-taken]"
        ).forEach(el => {
            el.textContent = taken;
        });


        /* -----------------------------------------
           UPDATE MISSED
           ----------------------------------------- */

        [
            "med-missed",
            "missed-count",
            "medication-missed",
            "report-missed"
        ].forEach(id => {
            setText(id, missed);
        });

        document.querySelectorAll(
            "[data-med-missed]"
        ).forEach(el => {
            el.textContent = missed;
        });


        /* -----------------------------------------
           UPDATE PENDING
           ----------------------------------------- */

        [
            "med-pending",
            "pending-count",
            "medication-pending"
        ].forEach(id => {
            setText(id, pending);
        });

        document.querySelectorAll(
            "[data-med-pending]"
        ).forEach(el => {
            el.textContent = pending;
        });


        /* -----------------------------------------
           UPDATE ADHERENCE %
           ----------------------------------------- */

        [
            "med-adherence",
            "adherence-value",
            "adherence-percent",
            "medication-adherence",
            "report-adherence"
        ].forEach(id => {
            setText(id, adherence + "%");
        });

        document.querySelectorAll(
            "[data-med-adherence]"
        ).forEach(el => {
            el.textContent =
                adherence + "%";
        });


        /* -----------------------------------------
           UPDATE PROGRESS BAR
           ----------------------------------------- */

        const progressSelectors = [
            "#adherence-bar",
            "#med-adherence-bar",
            "#medication-adherence-bar",
            "#adherence-progress",
            "[data-adherence-bar]"
        ];

        document.querySelectorAll(
            progressSelectors.join(",")
        ).forEach(bar => {

            bar.style.width =
                adherence + "%";

            bar.setAttribute(
                "aria-valuenow",
                adherence
            );
        });


        /* -----------------------------------------
           UPDATE STATUS MESSAGE
           ----------------------------------------- */

        document.querySelectorAll(
            "[data-adherence-status]"
        ).forEach(el => {

            if (adherence >= 90) {
                el.textContent =
                    "Great adherence — keep it up.";
            }
            else if (adherence >= 75) {
                el.textContent =
                    "Good adherence — keep improving.";
            }
            else {
                el.textContent =
                    "Your adherence needs attention.";
            }
        });


        /* -----------------------------------------
           UPDATE COMMON STATIC SUMMARY
           ----------------------------------------- */

        const summaryElements = [
            "med-summary",
            "medication-summary"
        ];

        summaryElements.forEach(id => {

            const el = $(id);

            if (!el) return;

            /*
               Don't destroy a large custom card.
               Only update if it is clearly a summary element.
            */

            if (
                el.dataset.dynamicSummary === "true" ||
                el.classList.contains("dynamic-med-summary")
            ) {

                el.innerHTML = `
                    <div>${taken} taken</div>
                    <div>${missed} missed</div>
                    <div>${adherence}% adherence</div>
                `;
            }
        });


        /* -----------------------------------------
           RELOAD MEDICATION CARDS
           ----------------------------------------- */

        await loadMedications();


        /* -----------------------------------------
           RELOAD REPORT
           ----------------------------------------- */

        await refreshMedicationReport();


        /* -----------------------------------------
           SUCCESS MESSAGE
           ----------------------------------------- */

        if (
            response === "taken" ||
            response === "yes"
        ) {

            showToast(
                "Dose recorded as taken ✓"
            );

        } else {

            showToast(
                "Dose recorded as missed"
            );
        }


    } catch (error) {

        console.error(
            "Medication response error:",
            error
        );

        showToast(
            "Could not save medication response"
        );
    }
}


/* =========================================================
   LOAD MEDICATIONS
   ========================================================= */

async function loadMedications() {
    try {
        const data = await api("/api/medications");

        let medications = [];

        if (Array.isArray(data)) {
            medications = data;
        } else if (Array.isArray(data.medications)) {
            medications = data.medications;
        } else if (Array.isArray(data.data)) {
            medications = data.data;
        }

        const list = $("medication-list");
        if (!list) return;

        if (!medications.length) {
            return;
        }

        /*
           The backend stores the latest Taken/Missed result
           in medication history. Merge that result into the
           medication before rendering its card.
        */
        const log =
            Array.isArray(data.log)
                ? data.log
                : [];

        medications = medications.map(medication => {
            const medicationId =
                Number(
                    medication.id ??
                    medication.medication_id ??
                    medication._id
                );

            const latest =
                log.find(
                    entry =>
                        Number(entry.medication_id) ===
                        medicationId
                );

            return {
                ...medication,
                status:
                    latest?.status ||
                    medication.status ||
                    "Scheduled"
            };
        });

        list.innerHTML =
            medications
                .map(medicationCardHtml)
                .join("");

        attachMedicationButtons();

    } catch (error) {
        console.warn(
            "Medication list unavailable:",
            error
        );
    }
}

function medicationCardHtml(med) {

    const id =
        med.id ??
        med.medication_id ??
        med._id;

    const name =
        med.name ||
        med.medicine ||
        med.medication ||
        "Medication";

    const dose =
        med.dosage ||
        med.dose ||
        med.strength ||
        "";

    const time =
        med.time ||
        med.scheduled_time ||
        med.schedule ||
        "";

    const status =
        med.status ||
        "Scheduled";


    return `
        <div class="medication-card"
             data-medication-id="${escapeHtml(id)}"
             style="
                background:#fff;
                border:1px solid #e4eaf1;
                border-radius:18px;
                padding:18px;
                margin-bottom:12px;
             ">

            <div style="
                display:flex;
                align-items:center;
                gap:12px;
            ">

                <div style="
                    width:50px;
                    height:50px;
                    border-radius:14px;
                    background:#fff7ed;
                    display:grid;
                    place-items:center;
                    font-size:24px;
                    flex-shrink:0;
                ">
                    💊
                </div>

                <div style="
                    flex:1;
                    min-width:0;
                ">

                    <div style="
                        font-size:16px;
                        font-weight:800;
                        color:#172033;
                    ">
                        ${escapeHtml(name)}
                    </div>

                    <div style="
                        font-size:13px;
                        color:#64748b;
                        margin-top:3px;
                    ">
                        ${escapeHtml(dose)}
                    </div>

                    <div style="
                        font-size:12px;
                        color:#94a3b8;
                        margin-top:3px;
                    ">
                        ${escapeHtml(time)}
                    </div>

                </div>

                <span style="
                    background:#eff6ff;
                    color:#2563eb;
                    border-radius:999px;
                    padding:7px 11px;
                    font-size:11px;
                    font-weight:800;
                ">
                    ${escapeHtml(status)}
                </span>

            </div>

            <div style="
                display:grid;
                grid-template-columns:1fr 1fr;
                gap:8px;
                margin-top:16px;
            ">

                <button
                    type="button"
                    class="med-response-btn med-yes-btn"
                    data-medication-id="${escapeHtml(id)}"
                    data-response="taken"
                    style="
                        border:0;
                        border-radius:12px;
                        padding:13px 8px;
                        background:#ecfdf3;
                        color:#15803d;
                        font-weight:800;
                        cursor:pointer;
                    "
                >
                    ✓ YES — Taken
                </button>

                <button
                    type="button"
                    class="med-response-btn med-no-btn"
                    data-medication-id="${escapeHtml(id)}"
                    data-response="missed"
                    style="
                        border:0;
                        border-radius:12px;
                        padding:13px 8px;
                        background:#fff1f2;
                        color:#dc2626;
                        font-weight:800;
                        cursor:pointer;
                    "
                >
                    × NO — Missed
                </button>

            </div>

        </div>
    `;
}


/* =========================================================
   MEDICATION BUTTON BINDING
   ========================================================= */

function attachMedicationButtons() {

    document.querySelectorAll(
        ".med-response-btn"
    ).forEach(button => {

        if (
            button.dataset.medReady === "true"
        ) {
            return;
        }

        button.dataset.medReady = "true";

        button.addEventListener(
            "click",
            async () => {

                const id =
                    button.dataset.medicationId;

                const response =
                    button.dataset.response;

                if (!id) {
                    showToast(
                        "Medication ID unavailable"
                    );
                    return;
                }

                /*
                   Prevent double clicking while
                   request is running.
                */

                const buttons =
                    button
                        .closest(".medication-card")
                        ?.querySelectorAll(
                            ".med-response-btn"
                        );

                buttons?.forEach(btn => {
                    btn.disabled = true;
                    btn.style.opacity = "0.65";
                });

                await respondMedication(
                    id,
                    response
                );

                buttons?.forEach(btn => {
                    btn.disabled = false;
                    btn.style.opacity = "1";
                });
            }
        );
    });
}


/* =========================================================
   MEDICATION REPORT
   ========================================================= */

async function refreshMedicationReport() {

    try {

        const report =
            await api("/api/medications/report");

        const source =
            report.summary ||
            report.report ||
            report.data ||
            report;


        const taken =
            Number(
                source.taken ??
                source.taken_count ??
                report.taken ??
                0
            );

        const missed =
            Number(
                source.missed ??
                source.missed_count ??
                report.missed ??
                0
            );

        let adherence =
            source.adherence ??
            source.adherence_rate ??
            source.rate ??
            report.adherence ??
            report.adherence_rate ??
            report.rate;


        if (
            adherence === undefined ||
            adherence === null
        ) {

            const total =
                taken + missed;

            adherence =
                total
                    ? Math.round(
                        taken / total * 100
                    )
                    : 0;
        }


        adherence = Number(adherence);

        if (
            adherence > 0 &&
            adherence <= 1
        ) {
            adherence =
                Math.round(
                    adherence * 100
                );
        }

        adherence =
            Math.max(
                0,
                Math.min(
                    100,
                    Math.round(adherence)
                )
            );


        updateMedicationNumbers(
            taken,
            missed,
            adherence
        );


    } catch (error) {

        console.warn(
            "Medication report unavailable:",
            error
        );
    }
}


function updateMedicationNumbers(
    taken,
    missed,
    adherence
) {
    /*
       Update every medication summary on the patient dashboard.
    */

    const reportBox =
        $("medication-report");

    if (reportBox) {
        reportBox.innerHTML = `
            <div class="grid grid-cols-3 gap-2">

                <div class="bg-gray-50 rounded-xl p-3">
                    <p class="text-xs text-gray-500">
                        Taken
                    </p>
                    <p class="font-extrabold text-xl">
                        ${taken}
                    </p>
                </div>

                <div class="bg-gray-50 rounded-xl p-3">
                    <p class="text-xs text-gray-500">
                        Missed
                    </p>
                    <p class="font-extrabold text-xl">
                        ${missed}
                    </p>
                </div>

                <div class="bg-gray-50 rounded-xl p-3">
                    <p class="text-xs text-gray-500">
                        Rate
                    </p>
                    <p class="font-extrabold text-xl">
                        ${adherence}%
                    </p>
                </div>

            </div>
        `;
    }

    const ids = {
        taken: [
            "med-taken",
            "taken-count",
            "medication-taken",
            "report-taken"
        ],
        missed: [
            "med-missed",
            "missed-count",
            "medication-missed",
            "report-missed"
        ],
        adherence: [
            "med-adherence",
            "adherence-value",
            "adherence-percent",
            "medication-adherence",
            "report-adherence"
        ]
    };

    ids.taken.forEach(id => {
        setText(id, taken);
    });

    ids.missed.forEach(id => {
        setText(id, missed);
    });

    ids.adherence.forEach(id => {
        setText(id, adherence + "%");
    });

    document.querySelectorAll(
        "[data-med-taken]"
    ).forEach(el => {
        el.textContent = taken;
    });

    document.querySelectorAll(
        "[data-med-missed]"
    ).forEach(el => {
        el.textContent = missed;
    });

    document.querySelectorAll(
        "[data-med-adherence]"
    ).forEach(el => {
        el.textContent = adherence + "%";
    });

    document.querySelectorAll(
        "#adherence-bar, " +
        "#med-adherence-bar, " +
        "#medication-adherence-bar, " +
        "#adherence-progress, " +
        "[data-adherence-bar]"
    ).forEach(bar => {
        bar.style.width = adherence + "%";
    });

    const adherenceStatus = (adherence >= 95)
        ? "Excellent adherence — stay consistent."
        : (adherence >= 90)
            ? "Very good adherence — keep following the schedule."
            : (adherence >= 80)
                ? "Good adherence — a little more consistency will help."
                : (adherence >= 75)
                    ? "Adherence is slipping — try not to miss your scheduled doses."
                    : (adherence >= 70)
                        ? "Low adherence — missed doses need attention. Review your schedule."
                        : "Very low adherence — please review missed doses with your doctor or caretaker.";

    document.querySelectorAll(
        "[data-adherence-status], #med-adherence-status"
    ).forEach(el => {
        el.textContent = adherenceStatus;
        el.classList.remove("text-green-600", "text-yellow-600", "text-orange-600", "text-red-600");
        el.classList.add(adherence >= 90 ? "text-green-600" : adherence >= 75 ? "text-yellow-600" : "text-red-600");
    });

    const icon = $("med-adherence-icon");
    if (icon) icon.textContent = adherence >= 75 ? "✓" : "!";

    if (typeof window.loadPatientAdherenceRisk === "function") {
        const medsView = $("meds-view");
        if (medsView && medsView.style.display !== "none") {
            window.loadPatientAdherenceRisk(adherence);
        }
    }
}

async function showMedicationReport() {

    try {

        const report =
            await api("/api/medications/report");

        const container =
            $("medication-report");

        if (!container) return;


        const source =
            report.summary ||
            report.report ||
            report.data ||
            report;


        const taken =
            Number(
                source.taken ??
                source.taken_count ??
                report.taken ??
                0
            );

        const missed =
            Number(
                source.missed ??
                source.missed_count ??
                report.missed ??
                0
            );

        let adherence =
            source.adherence ??
            source.adherence_rate ??
            source.rate ??
            report.adherence ??
            report.adherence_rate ??
            report.rate;


        if (
            adherence === undefined ||
            adherence === null
        ) {

            const total =
                taken + missed;

            adherence =
                total
                    ? Math.round(
                        taken / total * 100
                    )
                    : 0;
        }


        adherence = Number(adherence);

        if (
            adherence > 0 &&
            adherence <= 1
        ) {
            adherence =
                Math.round(
                    adherence * 100
                );
        }


        container.innerHTML = `
            <div style="
                display:grid;
                grid-template-columns:repeat(3,1fr);
                gap:10px;
            ">

                <div style="
                    background:#f8fafc;
                    border-radius:14px;
                    padding:14px;
                ">
                    <div style="
                        font-size:11px;
                        color:#64748b;
                    ">
                        Taken
                    </div>

                    <div style="
                        font-size:24px;
                        font-weight:800;
                        margin-top:4px;
                    ">
                        ${taken}
                    </div>
                </div>


                <div style="
                    background:#f8fafc;
                    border-radius:14px;
                    padding:14px;
                ">
                    <div style="
                        font-size:11px;
                        color:#64748b;
                    ">
                        Missed
                    </div>

                    <div style="
                        font-size:24px;
                        font-weight:800;
                        margin-top:4px;
                    ">
                        ${missed}
                    </div>
                </div>


                <div style="
                    background:#f8fafc;
                    border-radius:14px;
                    padding:14px;
                ">
                    <div style="
                        font-size:11px;
                        color:#64748b;
                    ">
                        Rate
                    </div>

                    <div style="
                        font-size:24px;
                        font-weight:800;
                        margin-top:4px;
                    ">
                        ${adherence}%
                    </div>
                </div>

            </div>
        `;


        updateMedicationNumbers(
            taken,
            missed,
            adherence
        );


    } catch (error) {

        console.warn(
            "Could not load medication report:",
            error
        );
    }
}


/* =========================================================
   DEVICE
   ========================================================= */

async function loadDeviceStatus() {

    try {

        const data =
            await api("/api/device");

        deviceConnected =
            Boolean(
                data.connected ??
                data.device_connected
            );

        deviceName =
            data.name ||
            data.device_name ||
            "Caretakers Wearable";

        updateDeviceUI();

    } catch (error) {

        console.warn(
            "Device status unavailable:",
            error
        );
    }
}


function updateDeviceUI() {

    document.querySelectorAll(
        "[data-device-status]"
    ).forEach(el => {

        el.textContent =
            deviceConnected
                ? "Connected"
                : "Not connected";
    });


    document.querySelectorAll(
        "[data-device-name]"
    ).forEach(el => {

        el.textContent =
            deviceConnected
                ? (deviceName || "Caretakers Wearable")
                : "No device connected";
    });


    const button =
        $("connect-device-btn");

    if (button) {

        button.textContent =
            deviceConnected
                ? "Disconnect Device"
                : "Connect Device";
    }
}


async function connectBluetooth() {

    const button =
        $("connect-device-btn");

    if (button) {

        button.disabled = true;
        button.textContent =
            "Connecting...";
    }


    showToast(
        "Scanning for wearable..."
    );


    try {

        /*
           Demo Bluetooth flow.
           Backend handles the connection state.
        */

        await new Promise(
            resolve =>
                setTimeout(resolve, 1200)
        );


        const data =
            await api(
                "/api/device/connect",
                {
                    method: "POST",
                    body: JSON.stringify({
                        device:
                            "Caretakers Wearable"
                    })
                }
            );


        deviceConnected = true;

        deviceName =
            data.name ||
            data.device_name ||
            "Caretakers Wearable";


        updateDeviceUI();


        showToast(
            "Wearable connected ✓"
        );


        await loadHealth();


    } catch (error) {

        console.error(error);

        showToast(
            "Could not connect device"
        );

    } finally {

        if (button) {
            button.disabled = false;
        }

        updateDeviceUI();
    }
}


async function disconnectDevice() {

    try {

        await api(
            "/api/device/disconnect",
            {
                method: "POST"
            }
        );

        deviceConnected = false;
        deviceName = null;

        updateDeviceUI();

        showToast(
            "Wearable disconnected"
        );

    } catch (error) {

        showToast(
            "Could not disconnect device"
        );
    }
}


/* =========================================================
   DOCTORS
   ========================================================= */

async function loadDoctors() {

    try {

        const data =
            await api("/api/doctors");

        if (Array.isArray(data)) {
            doctorsCache = data;
        }
        else if (Array.isArray(data.doctors)) {
            doctorsCache = data.doctors;
        }
        else if (Array.isArray(data.data)) {
            doctorsCache = data.data;
        }

    } catch (error) {

        console.warn(
            "Doctors unavailable:",
            error
        );
    }
}


function doctorByName(name) {

    return doctorsCache.find(
        doctor =>
            String(
                doctor.name
            ).toLowerCase() ===
            String(
                name
            ).toLowerCase()
    );
}


function doctorIdFromButton(button) {

    return (
        button.dataset.doctorId ||
        button.dataset.id ||
        button.closest(
            "[data-doctor-id]"
        )?.dataset.doctorId ||
        null
    );
}


async function openDoctorProfile(doctorId) {

    try {

        const doctor =
            await api(
                "/api/doctors/" +
                doctorId
            );

        const d =
            doctor.doctor ||
            doctor.data ||
            doctor;


        openModal(`
            <div style="
                display:flex;
                gap:14px;
                align-items:center;
            ">

                <div style="
                    width:58px;
                    height:58px;
                    border-radius:16px;
                    background:#eaf2ff;
                    display:grid;
                    place-items:center;
                    font-size:28px;
                ">
                    👨‍⚕️
                </div>

                <div>
                    <h3>
                        ${escapeHtml(
                            d.name ||
                            "Doctor"
                        )}
                    </h3>

                    <div style="
                        color:#64748b;
                        margin-top:4px;
                    ">
                        ${escapeHtml(
                            d.specialty ||
                            d.specialisation ||
                            "Specialist"
                        )}
                    </div>
                </div>

            </div>


            <div style="
                margin-top:20px;
                display:grid;
                gap:10px;
            ">

                <div class="v-dashboard-card">
                    ⭐
                    ${escapeHtml(
                        d.rating ||
                        "4.9"
                    )}
                    rating
                </div>

                <div class="v-dashboard-card">
                    🩺
                    ${escapeHtml(
                        d.experience ||
                        "10+ years"
                    )}
                    experience
                </div>

                <div class="v-dashboard-card">
                    🏥
                    ${escapeHtml(
                        d.hospital ||
                        "Caretakers Partner Hospital"
                    )}
                </div>

                <div class="v-dashboard-card">
                    💬
                    ${escapeHtml(
                        d.about ||
                        "Experienced healthcare professional available for consultation."
                    )}
                </div>

            </div>


            <div class="caretakers-modal-actions">

                <button
                    class="v-secondary"
                    onclick="closeModal()"
                >
                    Close
                </button>

                <button
                    class="v-primary"
                    onclick="closeModal(); openBookingModalById('${escapeHtml(doctorId)}')"
                >
                    Book Now
                </button>

            </div>
        `);

    } catch (error) {

        showToast(
            "Doctor profile unavailable"
        );
    }
}


async function openBookingModalById(id) {

    const doctor =
        doctorsCache.find(
            d =>
                String(
                    d.id ??
                    d.doctor_id
                ) === String(id)
        );

    if (doctor) {
        await openBookingModal(doctor);
    }
}


async function openBookingModal(doctor) {

    if (!doctor) {
        showToast(
            "Doctor details unavailable"
        );
        return;
    }


    openModal(`

        <h3>
            Book Appointment
        </h3>

        <p style="
            color:#64748b;
            font-size:13px;
            margin-top:5px;
        ">
            ${escapeHtml(
                doctor.name ||
                "Doctor"
            )}
        </p>


        <div class="caretakers-field">

            <label>
                Date
            </label>

            <input
                id="booking-date"
                type="date"
            >

        </div>


        <div class="caretakers-field">

            <label>
                Time
            </label>

            <select id="booking-time">

                <option>
                    10:00 AM
                </option>

                <option>
                    10:30 AM
                </option>

                <option>
                    11:00 AM
                </option>

                <option>
                    12:00 PM
                </option>

                <option>
                    4:00 PM
                </option>

                <option>
                    5:00 PM
                </option>

                <option>
                    6:00 PM
                </option>

            </select>

        </div>


        <div class="caretakers-field">

            <label>
                Visit type
            </label>

            <select id="booking-type">

                <option>
                    Online
                </option>

                <option>
                    Offline
                </option>

            </select>

        </div>


        <div class="caretakers-modal-actions">

            <button
                class="v-secondary"
                onclick="closeModal()"
            >
                Cancel
            </button>

            <button
                class="v-primary"
                id="confirm-booking-btn"
            >
                Confirm Booking
            </button>

        </div>
    `);


    const dateInput =
        $("booking-date");

    if (dateInput) {

        const tomorrow =
            new Date();

        tomorrow.setDate(
            tomorrow.getDate() + 1
        );

        dateInput.value =
            tomorrow
                .toISOString()
                .split("T")[0];
    }


    $("confirm-booking-btn")
        ?.addEventListener(
            "click",
            async () => {

                const date =
                    $("booking-date")?.value;

                const time =
                    $("booking-time")?.value;

                const type =
                    $("booking-type")?.value;


                try {

                    await api(
                        "/api/appointments",
                        {
                            method: "POST",
                            body: JSON.stringify({
                                doctor_id:
                                    doctor.id ??
                                    doctor.doctor_id,

                                doctor:
                                    doctor.name,

                                specialty:
                                    doctor.specialty,

                                date:
                                    date,

                                time:
                                    time,

                                mode:
                                    type
                            })
                        }
                    );


                    closeModal();

                    showToast(
                        "Appointment booked successfully ✓"
                    );


                    await renderAppointments();

                } catch (error) {

                    console.error(error);

                    showToast(
                        "Could not book appointment"
                    );
                }
            }
        );
}


function appointmentHtml(appointment) {

    const doctor =
        appointment.doctor ||
        appointment.doctor_name ||
        "Doctor";

    const specialty =
        appointment.specialty ||
        "";

    const date =
        appointment.date ||
        "";

    const time =
        appointment.time ||
        "";

    const mode =
        appointment.mode ||
        appointment.type ||
        "";

    const status =
        appointment.status ||
        "Booked";

    const modeLower =
        String(mode).toLowerCase();

    const modeDisplay =
        (
            modeLower.includes("online") ||
            modeLower.includes("video") ||
            modeLower.includes("tele")
        )
            ? "💻 Online"
            : "🏥 Hospital";

    const statusLower =
        String(status).toLowerCase();

    let statusStyle =
        "background:#dcfce7;color:#15803d;";

    if (statusLower === "requested") {
        statusStyle =
            "background:#fef3c7;color:#a16207;";
    } else if (statusLower === "rejected") {
        statusStyle =
            "background:#fee2e2;color:#b91c1c;";
    }

    return `
        <div style="
            padding:14px;
            border:1px solid #e4eaf1;
            border-radius:14px;
            margin-top:10px;
        ">

            <div style="
                display:flex;
                justify-content:space-between;
                align-items:flex-start;
                gap:10px;
            ">

                <div>

                    <strong>
                        ${escapeHtml(doctor)}
                    </strong>

                    <div style="
                        color:#64748b;
                        font-size:12px;
                        margin-top:4px;
                    ">
                        ${escapeHtml(specialty)}
                    </div>

                </div>

                <span style="
                    ${statusStyle}
                    padding:5px 9px;
                    border-radius:999px;
                    font-size:10px;
                    font-weight:800;
                    white-space:nowrap;
                ">
                    ${escapeHtml(status)}
                </span>

            </div>

            <div style="
                color:#64748b;
                font-size:12px;
                margin-top:8px;
            ">

                📅
                ${escapeHtml(date)}

                &nbsp;

                🕐
                ${escapeHtml(time)}

                &nbsp;

                ${modeDisplay}

            </div>

        </div>
    `;
}

async function renderAppointments() {

    const bookView =
        $("book-view");

    if (!bookView) return;


    let section =
        $("caretakers-appointments");


    if (!section) {

        section =
            document.createElement("div");

        section.id =
            "caretakers-appointments";

        section.style.cssText = `
            background:#fff;
            border:1px solid #e4eaf1;
            border-radius:18px;
            padding:18px;
            margin-top:18px;
        `;

        bookView.appendChild(section);
    }


    try {

        const appointments =
            await api(
                "/api/appointments"
            );


        const list =
            Array.isArray(appointments)
                ? appointments
                : (
                    appointments.appointments ||
                    appointments.data ||
                    []
                );


        section.innerHTML = `

            <div style="
                display:flex;
                justify-content:space-between;
                align-items:center;
            ">

                <div>
                    <h3 style="
                        font-size:18px;
                        font-weight:800;
                    ">
                        My Appointments
                    </h3>

                    <p style="
                        font-size:11px;
                        color:#64748b;
                        margin-top:3px;
                    ">
                        Your upcoming doctor appointments
                    </p>
                </div>

                <span class="v-chip">
                    ${list.length} total
                </span>

            </div>


            <div>
                ${
                    list.length
                    ? list.map(
                        appointmentHtml
                    ).join("")
                    : `
                        <p style="
                            font-size:12px;
                            color:#64748b;
                            margin-top:14px;
                        ">
                            No appointments yet.
                        </p>
                    `
                }
            </div>
        `;

    } catch (error) {

        section.innerHTML = `
            <p style="
                color:#64748b;
                font-size:12px;
            ">
                Appointment data unavailable.
            </p>
        `;
    }
}


/* =========================================================
   DOCTOR DIRECTORY
   ========================================================= */

function createDoctorCard(doctor) {

    const id =
        doctor.id ??
        doctor.doctor_id ??
        "";

    return `
        <div
            class="doctor-card"
            data-doctor-id="${escapeHtml(id)}"
            style="
                background:#fff;
                border:1px solid #e4eaf1;
                border-radius:18px;
                padding:18px;
                margin-bottom:12px;
            "
        >

            <div style="
                display:flex;
                align-items:center;
                gap:13px;
            ">

                <div style="
                    width:52px;
                    height:52px;
                    border-radius:16px;
                    background:#eaf2ff;
                    display:grid;
                    place-items:center;
                    font-size:25px;
                    flex-shrink:0;
                ">
                    🩺
                </div>

                <div style="flex:1">

                    <div style="
                        font-size:16px;
                        font-weight:800;
                    ">
                        ${escapeHtml(
                            doctor.name ||
                            "Doctor"
                        )}
                    </div>

                    <div style="
                        color:#64748b;
                        font-size:13px;
                        margin-top:3px;
                    ">
                        ${escapeHtml(
                            doctor.specialty ||
                            doctor.specialisation ||
                            "Specialist"
                        )}
                    </div>

                    <div style="
                        color:#64748b;
                        font-size:12px;
                        margin-top:5px;
                    ">
                        ⭐
                        ${escapeHtml(
                            doctor.rating ||
                            "4.9"
                        )}
                        ·
                        ${escapeHtml(
                            doctor.experience ||
                            "10"
                        )} yrs experience
                    </div>

                </div>

            </div>


            <div style="
                display:grid;
                grid-template-columns:1fr 1fr;
                gap:8px;
                margin-top:16px;
            ">

                <button
                    type="button"
                    class="profile-btn appointment-btn"
                    data-doctor-id="${escapeHtml(id)}"
                    style="
                        border:1px solid #bfdbfe;
                        background:#fff;
                        color:#2563eb;
                        border-radius:12px;
                        padding:12px 6px;
                        font-weight:800;
                        cursor:pointer;
                    "
                >
                    View Profile
                </button>

                <button
                    type="button"
                    class="book-now-btn appointment-btn"
                    data-doctor-id="${escapeHtml(id)}"
                    style="
                        border:0;
                        background:#2563eb;
                        color:#fff;
                        border-radius:12px;
                        padding:12px 6px;
                        font-weight:800;
                        cursor:pointer;
                    "
                >
                    Book Now
                </button>

            </div>

        </div>
    `;
}


async function renderDoctorDirectory() {

    const grid =
        $("doctor-grid");

    if (!grid) return;


    if (!doctorsCache.length) {
        await loadDoctors();
    }


    if (!doctorsCache.length) return;


    grid.innerHTML =
        doctorsCache
            .map(createDoctorCard)
            .join("");


    setupBookingButtonsOnly();
}


function setupBookingButtonsOnly() {

    document.querySelectorAll(
        ".profile-btn, .book-now-btn, .appointment-btn"
    ).forEach(button => {

        if (
            button.dataset.bookingReady === "true"
        ) {
            return;
        }

        button.dataset.bookingReady =
            "true";


        button.addEventListener(
            "click",
            async event => {

                event.preventDefault();

                const id =
                    doctorIdFromButton(button);

                const doctor =
                    doctorsCache.find(
                        d =>
                            String(
                                d.id ??
                                d.doctor_id
                            ) === String(id)
                    );


                if (!doctor) {

                    showToast(
                        "Doctor details unavailable"
                    );

                    return;
                }


                if (
                    button.classList.contains(
                        "profile-btn"
                    ) ||
                    button.textContent
                        .toLowerCase()
                        .includes(
                            "view profile"
                        )
                ) {

                    await openDoctorProfile(
                        id
                    );

                } else {

                    await openBookingModal(
                        doctor
                    );
                }
            }
        );
    });
}


function setupDoctorSearch() {

    const search =
        $("doctor-search");

    if (!search) return;

    if (
        search.dataset.ready === "true"
    ) {
        return;
    }

    search.dataset.ready =
        "true";


    search.addEventListener(
        "input",
        () => {

            const query =
                search.value
                    .toLowerCase()
                    .trim();


            document.querySelectorAll(
                ".doctor-card"
            ).forEach(card => {

                card.style.display =
                    card.textContent
                        .toLowerCase()
                        .includes(query)
                        ? ""
                        : "none";
            });
        }
    );
}


async function setupBooking() {

    await loadDoctors();

    await renderDoctorDirectory();

    setupBookingButtonsOnly();

    setupDoctorSearch();

    await renderAppointments();
}


/* =========================================================
   AI
   ========================================================= */

async function sendAIMessage() {

    const input =
        $("ai-input") ||
        $("assistant-input") ||
        $("caretakers-ai-input");

    if (!input) return;


    const message =
        input.value.trim();

    if (!message) return;


    input.value = "";


    try {

        const data =
            await api(
                "/api/chat",
                {
                    method: "POST",
                    body: JSON.stringify({
                        message: message,
                        mode: "ai"
                    })
                }
            );


        const reply =
            data.reply ||
            data.message ||
            data.response ||
            "I'm here to help.";


        addAIMessage(
            message,
            reply
        );


    } catch (error) {

        console.error(error);

        addAIMessage(
            message,
            "I'm unable to connect right now. Please try again."
        );
    }
}


function formatAIReply(reply) {
    let text = String(reply || "")
        .replace(/\r/g, "")
        .trim();

    // Put one-line Markdown bullets onto separate lines.
    text = text.replace(
        /\s+-\s+(?=\*\*)/g,
        "\n- "
    );

    const lines = text.split(/\n+/);

    function renderInline(value) {
        const parts = value.split("**");
        let result = "";

        parts.forEach((part, index) => {
            const safe = escapeHtml(part);

            if (index % 2 === 1) {
                result += "<strong>" + safe + "</strong>";
            } else {
                result += safe;
            }
        });

        return result.replace(
            /`([^`]+)`/g,
            "<code>$1</code>"
        );
    }

    return lines
        .map(line => {
            let value = line.trim();

            if (!value) {
                return "<div style='height:6px'></div>";
            }

            const isBullet = /^-\s+/.test(value);

            if (isBullet) {
                value = value.replace(/^-\s+/, "");

                return `
                    <div style="
                        display:flex;
                        gap:8px;
                        margin:5px 0;
                        line-height:1.5;
                    ">
                        <span style="
                            font-weight:700;
                            flex-shrink:0;
                        ">•</span>
                        <span>
                            ${renderInline(value)}
                        </span>
                    </div>
                `;
            }

            return `
                <div style="
                    margin-bottom:7px;
                    line-height:1.5;
                ">
                    ${renderInline(value)}
                </div>
            `;
        })
        .join("");
}


function addAIMessage(
    userMessage,
    reply
) {

    const container =
        $("ai-chat-box") ||
        $("ai-messages") ||
        $("assistant-messages");


    if (!container) {

        showToast(reply);

        return;
    }


    container.insertAdjacentHTML(
        "beforeend",
        `
            <div style="
                margin-top:10px;
                text-align:right;
            ">
                <span style="
                    display:inline-block;
                    background:#2563eb;
                    color:#fff;
                    padding:10px 13px;
                    border-radius:14px;
                    font-size:13px;
                ">
                    ${escapeHtml(
                        userMessage
                    )}
                </span>
            </div>

            <div style="
                margin-top:10px;
            ">
                <span style="
                    display:inline-block;
                    background:#eef2f7;
                    color:#172033;
                    padding:11px 14px;
                    border-radius:14px;
                    font-size:13px;
                    max-width:90%;
                ">
                    ${formatAIReply(reply)}
                </span>
            </div>
        `
    );


    container.scrollTop =
        container.scrollHeight;
}


function setupAI() {

    const input =
        $("ai-input") ||
        $("assistant-input") ||
        $("caretakers-ai-input");

    if (!input) return;


    if (
        input.dataset.ready === "true"
    ) {
        return;
    }

    input.dataset.ready =
        "true";


    input.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                sendAIMessage();
            }
        }
    );


    document.querySelectorAll(
        "#ai-send-btn, " +
        "#assistant-send-btn, " +
        "[data-action='send-ai']"
    ).forEach(button => {

        button.addEventListener(
            "click",
            sendAIMessage
        );
    });
}


/* =========================================================
   CARE TEAM CHAT
   ========================================================= */

async function sendCareMessage() {

    const input =
        $("care-chat-input") ||
        $("care-input");

    if (!input) return;


    const message =
        input.value.trim();

    if (!message) return;


    input.value = "";


    try {

        const data =
            await api(
                "/api/chat",
                {
                    method: "POST",
                    body: JSON.stringify({
                        message: message,
                        mode: "care"
                    })
                }
            );


        const reply =
            data.reply ||
            data.message ||
            data.response ||
            "Your care team will get back to you.";


        const container =
            $("care-chat-messages") ||
            $("care-messages");


        if (!container) {

            showToast(
                "Message sent to care team"
            );

            return;
        }


        container.insertAdjacentHTML(
            "beforeend",
            `
                <div style="
                    text-align:right;
                    margin-top:10px;
                ">
                    <span style="
                        display:inline-block;
                        background:#2563eb;
                        color:#fff;
                        padding:10px 13px;
                        border-radius:14px;
                        font-size:13px;
                    ">
                        ${escapeHtml(
                            message
                        )}
                    </span>
                </div>

                <div style="
                    margin-top:10px;
                ">
                    <span style="
                        display:inline-block;
                        background:#eef2f7;
                        color:#172033;
                        padding:11px 14px;
                        border-radius:14px;
                        font-size:13px;
                    ">
                        ${escapeHtml(
                            reply
                        )}
                    </span>
                </div>
            `
        );


        container.scrollTop =
            container.scrollHeight;


    } catch (error) {

        showToast(
            "Could not send message"
        );
    }
}


function setupCareChat() {

    const input =
        $("care-chat-input") ||
        $("care-input");

    if (!input) return;


    if (
        input.dataset.ready === "true"
    ) {
        return;
    }

    input.dataset.ready =
        "true";


    input.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                sendCareMessage();
            }
        }
    );


    document.querySelectorAll(
        "#care-chat-send, " +
        "#care-send-btn, " +
        "[data-action='send-care']"
    ).forEach(button => {

        button.addEventListener(
            "click",
            sendCareMessage
        );
    });
}


/* =========================================================
   MEDICATION ALERTS / REMINDERS
   ========================================================= */

let medicationReminderTimer = null;
const reminderShown = new Set();

async function loadMedicationAlerts() {
    try {
        const data = await api("/api/medications/today");
        const alerts = data.alerts || [];
        const banner = $("medication-alert-banner");
        if (banner) {
            if (alerts.length) {
                banner.innerHTML = `
                    <div style="display:flex;gap:12px;align-items:flex-start">
                        <span style="font-size:24px">⏰</span>
                        <div style="flex:1">
                            <strong style="font-size:14px">Medication reminder</strong>
                            <div style="font-size:12px;color:#92400e;margin-top:3px">
                                ${alerts.map(a => escapeHtml(a.title)).join(" · ")}
                            </div>
                        </div>
                        <button class="btn-secondary" onclick="navTo('meds')">View</button>
                    </div>`;
                banner.style.display = "block";
            } else {
                banner.style.display = "none";
            }
        }

        // Browser notifications work while the app is open.
        for (const alert of alerts) {
            const key = `${data.date}:${alert.medication_id}`;
            if (!reminderShown.has(key)) {
                reminderShown.add(key);
                showToast(alert.title);
                if ("Notification" in window && Notification.permission === "granted") {
                    new Notification("Caretakers Medication Reminder", { body: alert.message });
                }
            }
        }
    } catch (error) {
        console.warn("Medication alerts unavailable:", error);
    }
}

function requestMedicationNotifications() {
    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
    }
    loadMedicationAlerts();
    if (!medicationReminderTimer) {
        medicationReminderTimer = setInterval(loadMedicationAlerts, 60000);
    }
}

/* =========================================================
   CARETAKERS
   ========================================================= */

async function loadCaretakers() {

    try {

        const data =
            await api(
                "/api/caretakers"
            );

        const caretakers =
            Array.isArray(data)
                ? data
                : (
                    data.caretakers ||
                    data.data ||
                    []
                );


        const list =
            $("patient-caretaker-list");

        if (!list) return;


        if (!caretakers.length) {

            list.innerHTML = `
                <div style="
                    color:#64748b;
                    font-size:13px;
                ">
                    No caretakers connected yet.
                </div>
            `;

            return;
        }


        list.innerHTML =
            caretakers
                .map(caretaker => `
                    <div style="
                        display:flex;
                        align-items:center;
                        gap:12px;
                        padding:12px 0;
                        border-bottom:1px solid #edf0f4;
                    ">

                        <div style="
                            width:42px;
                            height:42px;
                            border-radius:50%;
                            background:#eaf2ff;
                            display:grid;
                            place-items:center;
                        ">
                            👤
                        </div>

                        <div style="flex:1">

                            <strong style="
                                display:block;
                                font-size:13px;
                            ">
                                ${escapeHtml(
                                    caretaker.name ||
                                    "Caretaker"
                                )}
                            </strong>

                            <span style="
                                color:#64748b;
                                font-size:11px;
                            ">
                                ${escapeHtml(
                                    caretaker.relation ||
                                    "Caretaker"
                                )}
                            </span>

                        </div>

                        <span style="
                            background:#ecfdf3;
                            color:#16a05d;
                            border-radius:999px;
                            padding:6px 9px;
                            font-size:10px;
                            font-weight:800;
                        ">
                            Active
                        </span>

                    </div>
                `)
                .join("");

    } catch (error) {

        console.warn(
            "Caretakers unavailable:",
            error
        );
    }
}


/* =========================================================
   ALERTS
   ========================================================= */

async function loadAlerts() {

    try {

        const data =
            await api("/api/alerts");

        const alerts =
            Array.isArray(data)
                ? data
                : (
                    data.alerts ||
                    data.data ||
                    []
                );


        const list =
            $("alert-list") ||
            $("alerts-list");


        if (!list) return;


        if (!alerts.length) {

            list.innerHTML = `
                <div style="
                    color:#64748b;
                    font-size:12px;
                ">
                    No critical alerts.
                    Patient is currently stable.
                </div>
            `;

            return;
        }


        list.innerHTML =
            alerts
                .map(alert => `
                    <div style="
                        padding:12px;
                        border-radius:12px;
                        background:#fff7ed;
                        margin-top:8px;
                    ">
                        <strong>
                            ${escapeHtml(
                                alert.title ||
                                "Care alert"
                            )}
                        </strong>

                        <div style="
                            font-size:12px;
                            color:#64748b;
                            margin-top:4px;
                        ">
                            ${escapeHtml(
                                alert.message ||
                                alert.description ||
                                ""
                            )}
                        </div>
                    </div>
                `)
                .join("");

    } catch (error) {

        console.warn(
            "Alerts unavailable:",
            error
        );
    }
}


/* =========================================================
   PAYMENT / SERVICE OPTIONS
   ========================================================= */

function openServiceOptions(service) {

    openModal(`

        <h3>
            ${escapeHtml(
                service ||
                "Service"
            )}
        </h3>

        <p style="
            color:#64748b;
            font-size:13px;
            margin-top:5px;
        ">
            Choose how you want to continue.
        </p>


        <div style="
            display:grid;
            gap:10px;
            margin-top:18px;
        ">

            <button
                class="v-primary"
                style="
                    border:0;
                    border-radius:14px;
                    padding:15px;
                    font-weight:800;
                    cursor:pointer;
                "
                onclick="startOnlineService('${escapeHtml(service)}')"
            >
                Online
            </button>


            <button
                class="v-secondary"
                style="
                    border:0;
                    border-radius:14px;
                    padding:15px;
                    font-weight:800;
                    cursor:pointer;
                "
                onclick="startWhatsAppService('${escapeHtml(service)}')"
            >
                WhatsApp
            </button>

        </div>


        <div class="caretakers-modal-actions">

            <button
                class="v-secondary"
                onclick="closeModal()"
            >
                Cancel
            </button>

        </div>
    `);
}


async function startOnlineService(service) {
    const serviceNames = {
        doubt: "Doubt Support",
        medicine: "Medicine Purchase",
        doctor: "Doctor Consultation",
        consultation: "Doctor Consultation",
        hospital: "Hospital Visit",
        support: "Care Team Support"
    };
    const label = serviceNames[service] || "Caretakers Service";
    // Demo prices can be replaced by a real pricing table later.
    const prices = { doubt: 199, medicine: 120, doctor: 800, consultation: 800, hospital: 500, support: 199 };
    const amount = prices[service] || 199;

    try {
        const session = await api("/api/payment/create", {
            method: "POST",
            body: JSON.stringify({ amount: amount, service: service })
        });
        const payment = session.payment || {};
        closeModal();

        openModal(`
            <div style="text-align:center">
                <div style="font-size:36px">💳</div>
                <h3 style="font-size:20px;font-weight:800;margin-top:8px">
                    ${escapeHtml(label)}
                </h3>
                <p style="color:#64748b;font-size:13px;margin-top:5px">
                    Payment reference: ${escapeHtml(payment.reference || "")}
                </p>
                <div style="margin:18px auto 10px;padding:14px;background:#f8fafc;border-radius:16px">
                    <div style="font-size:12px;color:#64748b">Amount</div>
                    <div style="font-size:28px;font-weight:900">₹${Number(payment.amount || amount).toFixed(2)}</div>
                </div>
                <img id="payment-qr-image"
                     alt="Dynamic UPI payment QR"
                     style="width:230px;height:230px;object-fit:contain;border:1px solid #e5e9f0;border-radius:14px">
                <p style="font-size:11px;color:#94a3b8;margin-top:8px">
                    Scan with a UPI app. This is a hackathon payment flow.
                </p>
                <div class="caretakers-modal-actions" style="display:grid;gap:8px;margin-top:15px">
                    <button class="v-primary" onclick="completePayment('${escapeHtml(payment.reference || "")}')">
                        Mark payment as completed
                    </button>
                    <button class="v-secondary" onclick="payThroughWhatsApp('${escapeHtml(payment.reference || "")}')">
                        Pay via WhatsApp
                    </button>
                    <button class="v-secondary" onclick="closeModal()">Close</button>
                </div>
            </div>
        `);

        if (payment.reference) {
            const img = document.getElementById("payment-qr-image");
            if (img) img.src = `/api/payment/${encodeURIComponent(payment.reference)}/qr`;
        }
    } catch (error) {
        console.error(error);
        showToast("Could not start online service");
    }
}

async function payThroughWhatsApp(reference) {
    try {
        const data = await api("/api/payment/whatsapp", {
            method: "POST",
            body: JSON.stringify({ reference })
        });
        if (data.whatsapp_url) window.open(data.whatsapp_url, "_blank");
    } catch (error) {
        showToast("Could not open WhatsApp payment");
    }
}

async function completePayment(reference) {
    if (!reference) return;
    try {
        const data = await api(`/api/payment/${encodeURIComponent(reference)}/complete`, {
            method: "POST"
        });
        closeModal();
        showToast(`Payment ${data.payment?.status || "completed"} ✓`);
    } catch (error) {
        showToast("Could not update payment");
    }
}

function startWhatsAppService(service) {

    const number =
        window.CARETAKERS_WHATSAPP_NUMBER ||
        "919999999999";


    const message =
        "Hello Caretakers, I need help with: " +
        service;


    const url =
        "https://wa.me/" +
        number +
        "?text=" +
        encodeURIComponent(message);


    window.open(
        url,
        "_blank"
    );


    closeModal();
}


/* =========================================================
   SOS
   ========================================================= */

async function triggerSOS() {

    try {

        await api(
            "/api/sos",
            {
                method: "POST",
                body: JSON.stringify({
                    message:
                        "Emergency SOS triggered from Caretakers"
                })
            }
        );


        showToast(
            "SOS alert sent to your care team"
        );

    } catch (error) {

        showToast(
            "SOS could not be sent"
        );
    }
}


/* =========================================================
   NAVIGATION
   ========================================================= */

function getScreen(name) {

    const aliases = {
        ai: [
            "ai-view",
            "assistant-view"
        ],

        assistant: [
            "assistant-view",
            "ai-view"
        ],

        care: [
            "care-view",
            "switch-view"
        ],

        switch: [
            "switch-view",
            "care-view"
        ],

        meds: [
            "meds-view",
            "medications-view"
        ],

        medications: [
            "medications-view",
            "meds-view"
        ],

        doctors: [
            "doctors-view",
            "book-view"
        ],

        book: [
            "book-view",
            "doctors-view"
        ]
    };


    const possible =
        aliases[name] ||
        [name + "-view"];


    for (
        const id of possible
    ) {

        const element = $(id);

        if (element) {
            return element;
        }
    }


    return null;
}


function navTo(tab) {

    tab =
        String(tab || "")
            .replace("#", "")
            .replace("-view", "")
            .trim();


    /*
       Map the visible bottom navigation names
       to the existing page IDs.
    */

    if (tab === "assistant") {
        tab = "ai";
    }

    if (tab === "care") {
        tab = "switch";
    }

    if (tab === "medications") {
        tab = "meds";
    }

    if (tab === "doctors") {
        tab = "book";
    }


    const allViews =
        document.querySelectorAll(
            ".tab-content, " +
            ".page-view, " +
            ".caretakers-view"
        );


    allViews.forEach(view => {

        view.classList.remove(
            "active"
        );

        view.style.display =
            "none";
    });


    const target =
        getScreen(tab);


    if (!target) {

        console.warn(
            "Navigation target not found:",
            tab
        );

        return;
    }


    target.classList.add(
        "active"
    );

    target.style.display =
        "block";


    document.querySelectorAll(
        ".nav-btn"
    ).forEach(button => {

        button.classList.remove(
            "active",
            "text-blue-600",
            "text-primary"
        );
    });


    const navId =
        "nav-" + tab;


    const navButton =
        $(navId) ||
        Array.from(
            document.querySelectorAll(
                ".nav-btn"
            )
        ).find(button => {

            const onclick =
                button.getAttribute(
                    "onclick"
                ) || "";

            return (
                onclick.includes(
                    "'" + tab + "'"
                ) ||
                onclick.includes(
                    '"' + tab + '"'
                )
            );
        });


    if (navButton) {

        navButton.classList.add(
            "active",
            "text-blue-600"
        );
    }


    /*
       Load data when entering screens.
    */

    if (tab === "home") {

        loadHealth();
        loadDeviceStatus();
    }


    if (tab === "meds") {

        loadMedications();
        refreshMedicationReport();
    }


    if (tab === "book") {

        setupBooking();
    }


    if (tab === "switch") {

        loadCaretakers();
        loadAlerts();
        refreshMedicationReport();
    }


    if (tab === "ai") {

        setupAI();
    }


    if (tab === "chat") {

        setTimeout(
            () =>
                $("care-chat-input")
                    ?.focus(),
            50
        );
    }


    target.scrollTop = 0;

    window.scrollTo({
        top:0,
        behavior:"smooth"
    });
}


window.navTo =
    navTo;

window.showToast =
    showToast;

window.respondMedication =
    respondMedication;

window.showMedicationReport =
    showMedicationReport;

window.refreshMedicationReport =
    refreshMedicationReport;

window.openDoctorProfile =
    openDoctorProfile;

window.openBookingModal =
    openBookingModal;

window.openBookingModalById =
    openBookingModalById;

window.openModal =
    openModal;

window.closeModal =
    closeModal;

window.openServiceOptions =
    openServiceOptions;

window.startOnlineService =
    startOnlineService;

window.startWhatsAppService =
    startWhatsAppService;


/* =========================================================
   NAVIGATION SETUP
   ========================================================= */

function setupNavigation() {

    document.querySelectorAll(
        ".nav-btn"
    ).forEach(button => {

        if (
            button.dataset.navReady ===
            "true"
        ) {
            return;
        }

        button.dataset.navReady =
            "true";


        button.addEventListener(
            "click",
            event => {

                event.preventDefault();


                const onclick =
                    button.getAttribute(
                        "onclick"
                    ) || "";


                const match =
                    onclick.match(
                        /navTo\(['"]([^'"]+)['"]\)/
                    );


                const tab =
                    button.dataset.nav ||
                    (
                        match
                            ? match[1]
                            : null
                    );


                if (tab) {
                    navTo(tab);
                }
            }
        );
    });
}


/* =========================================================
   DEVICE BUTTON
   ========================================================= */

function setupDeviceButton() {

    const button =
        $("connect-device-btn");

    if (!button) return;


    if (
        button.dataset.ready ===
        "true"
    ) {
        return;
    }


    button.dataset.ready =
        "true";


    button.addEventListener(
        "click",
        async () => {

            if (deviceConnected) {

                await disconnectDevice();

            } else {

                await connectBluetooth();
            }
        }
    );
}


/* =========================================================
   SOS BUTTON
   ========================================================= */

function setupSOSButton() {

    let button =
        $("sos-btn");


    if (!button) {

        button =
            Array.from(
                document.querySelectorAll(
                    "button"
                )
            ).find(
                candidate =>
                    candidate
                        .textContent
                        .trim()
                        .toUpperCase() ===
                    "SOS"
            );
    }


    if (!button) return;


    if (
        button.dataset.ready ===
        "true"
    ) {
        return;
    }


    button.dataset.ready =
        "true";


    button.addEventListener(
        "click",
        triggerSOS
    );
}


/* =========================================================
   QUICK ACTIONS
   ========================================================= */

function setupQuickActions() {

    document.querySelectorAll(
        "[data-action='book'], " +
        "#book-doctor-btn"
    ).forEach(button => {

        button.addEventListener(
            "click",
            () => navTo("book")
        );
    });


    document.querySelectorAll(
        "[data-action='care'], " +
        "#care-team-btn"
    ).forEach(button => {

        button.addEventListener(
            "click",
            () => navTo("switch")
        );
    });


    document.querySelectorAll(
        "[data-action='ai'], " +
        "#ai-health-btn"
    ).forEach(button => {

        button.addEventListener(
            "click",
            () => navTo("ai")
        );
    });


    document.querySelectorAll(
        "[data-action='chat'], " +
        "#chat-team-btn"
    ).forEach(button => {

        button.addEventListener(
            "click",
            () => navTo("chat")
        );
    });


    document.querySelectorAll(
        "[data-action='meds'], " +
        "#medications-btn, " +
        "#view-medications-btn"
    ).forEach(button => {

        button.addEventListener(
            "click",
            () => navTo("meds")
        );
    });
}


/* =========================================================
   GLOBAL CLICK SUPPORT FOR OLD STITCH BUTTONS
   ========================================================= */

function setupDynamicButtons() {

    document.addEventListener(
        "click",
        event => {

            const target =
                event.target.closest(
                    "button"
                );

            if (!target) return;


            /*
               Medication buttons created by
               HTML/JavaScript.
            */

            const medicationId =
                target.dataset
                    ?.medicationId;

            const response =
                target.dataset
                    ?.response;


            if (
                medicationId &&
                response &&
                target.classList.contains(
                    "med-response-btn"
                )
            ) {
                return;
            }


            /*
               Generic "View Profile"
               support for old Stitch cards.
            */

            if (
                target.textContent
                    .trim()
                    .toLowerCase() ===
                "view profile"
            ) {

                const id =
                    doctorIdFromButton(
                        target
                    );

                if (id) {

                    openDoctorProfile(
                        id
                    );
                }
            }
        }
    );
}


/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {
        console.log(
            "Caretakers frontend initialized"
        );

        // -------------------------------------------------
        // IMPORTANT:
        // Show Home FIRST. Never make the UI wait for
        // backend/API calls during startup.
        // -------------------------------------------------

        try {
            injectModalStyles();

            setupNavigation();
            setupDeviceButton();
            setupSOSButton();
            setupAI();
            setupCareChat();
            setupQuickActions();
            setupDynamicButtons();

            attachMedicationButtons();

            // Home becomes visible immediately.
            navTo("home");
        } catch (error) {
            console.error(
                "Caretakers UI initialization error:",
                error
            );
        }

        // -------------------------------------------------
        // Load backend data in the background.
        // A failure in one request must NOT blank the app.
        // -------------------------------------------------

        const backgroundTasks = [
            ["health", loadHealth],
            ["device", loadDeviceStatus],
            ["medications", loadMedications],
            ["medication report", refreshMedicationReport],
            ["medication notifications", requestMedicationNotifications],
            ["doctors", loadDoctors],
            ["doctor directory", renderDoctorDirectory],
            ["appointments", renderAppointments]
        ];

        backgroundTasks.forEach(
            ([name, task]) => {
                Promise.resolve()
                    .then(() => task())
                    .catch(error => {
                        console.warn(
                            `Caretakers ${name} loading failed:`,
                            error
                        );
                    });
            }
        );

        // -------------------------------------------------
        // Keep health + medication data synchronized.
        // -------------------------------------------------

        setInterval(
            async () => {
                try {
                    await loadHealth();
                } catch (error) {
                    console.warn(
                        "Health refresh failed:",
                        error
                    );
                }

                try {
                    await refreshMedicationReport();
                } catch (error) {
                    console.warn(
                        "Medication report refresh failed:",
                        error
                    );
                }
            },
            5000
        );

        // Medication buttons can be generated later.
        setTimeout(
            () => {
                try {
                    attachMedicationButtons();
                } catch (error) {
                    console.warn(
                        "Medication button binding failed:",
                        error
                    );
                }
            },
            500
        );
    }
);
/* ============================================================
   CARETAKERS MEDICINE PURCHASE
   ============================================================ */

async function openMedicinePurchase() {
    try {
        const response = await fetch("/api/medicine-catalog");

        if (!response.ok) {
            throw new Error("Could not load medicine catalog");
        }

        const medicines = await response.json();

        openModal(
            "Purchase Medicines",
            `
            <div class="space-y-3">

                <p class="text-sm text-gray-500 mb-4">
                    Select a medicine to purchase.
                </p>

                ${medicines.map(medicine => `
                    <div class="service-card">
                        <div class="flex items-center gap-3">

                            <div class="w-12 h-12 rounded-xl bg-blue-50
                                        flex items-center justify-center text-xl">
                                💊
                            </div>

                            <div class="flex-1">
                                <p class="font-extrabold">
                                    ${escapeHtml(medicine.name)}
                                </p>

                                <p class="text-sm text-gray-500">
                                    ${escapeHtml(medicine.strength)}
                                    · ${escapeHtml(medicine.pack)}
                                </p>

                                <p class="font-extrabold text-blue-600 mt-1">
                                    ₹${Number(medicine.price).toFixed(2)}
                                </p>
                            </div>

                            <button
                                class="btn-primary"
                                onclick="purchaseMedicine('${escapeHtml(medicine.id)}')">
                                Buy
                            </button>

                        </div>
                    </div>
                `).join("")}

            </div>
            `
        );

    } catch (error) {
        console.error("Medicine purchase error:", error);
        showToast("Could not load medicines");
    }
}


async function purchaseMedicine(medicineId) {
    try {
        const quantity = 1;

        const response = await fetch("/api/medicine-orders", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                medicine_id: medicineId,
                quantity: quantity
            })
        });

        const order = await response.json();

        if (!response.ok) {
            throw new Error(
                order.error || "Could not create medicine order"
            );
        }

        openMedicinePayment(order);

    } catch (error) {
        console.error("Medicine order error:", error);
        showToast(error.message || "Could not create order");
    }
}


async function openMedicinePayment(order) {
    try {
        const session = await api("/api/payment/create", {
            method: "POST",
            body: JSON.stringify({
                amount: order.total
            })
        });

        const payment = session.payment || {};

        openModal(
            "Medicine Payment",
            `
            <div class="text-center">

                <p class="text-sm text-gray-500">
                    ${escapeHtml(order.medicine)}
                    · ${escapeHtml(order.strength)}
                </p>

                <p class="text-sm text-gray-500 mt-1">
                    Quantity: ${order.quantity}
                </p>

                <div class="text-3xl font-extrabold mt-4">
                    ₹${Number(payment.amount || order.total).toFixed(2)}
                </div>

                <p class="text-xs text-gray-500 mt-2">
                    Payment reference:
                    ${escapeHtml(payment.reference || "")}
                </p>

                <div class="mt-5 flex justify-center">
                    <img
                        id="medicine-payment-qr"
                        alt="Medicine payment QR"
                        style="width:240px;height:240px;object-fit:contain;border-radius:16px;border:1px solid #eee;">
                </div>

                <p class="text-sm text-gray-500 mt-3">
                    Scan this QR with your UPI app.
                </p>

                <button
                    class="btn-primary w-full mt-4"
                    onclick="completeMedicinePayment(
                        '${escapeHtml(payment.reference || "")}',
                        ${order.id}
                    )">
                    Mark payment as completed
                </button>

                <button
                    class="btn-secondary w-full mt-2"
                    onclick="payMedicineThroughWhatsApp(
                        '${escapeHtml(payment.reference || "")}'
                    )">
                    Pay through WhatsApp
                </button>

            </div>
            `
        );

        if (payment.reference) {
            const img =
                document.getElementById("medicine-payment-qr");

            if (img) {
                img.src =
                    `/api/payment/${encodeURIComponent(payment.reference)}/qr`;
            }
        }

    } catch (error) {
        console.error("Medicine payment error:", error);
        showToast("Could not start payment");
    }
}


async function completeMedicinePayment(
    reference,
    orderId
) {
    try {
        const response = await fetch(
            `/api/payment/${encodeURIComponent(reference)}/complete`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    order_id: orderId || null
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.error || "Payment completion failed"
            );
        }

        console.log(
            "Payment successfully marked as Paid:",
            reference
        );

        // Close the QR/payment popup.
        if (typeof closeModal === "function") {
            closeModal();
        }

        // Show a fresh Paid confirmation popup.
        if (typeof openModal === "function") {
            openModal(`
                <div style="
                    text-align:center;
                    padding:28px 20px;
                ">
                    <div style="
                        font-size:64px;
                        line-height:1;
                        margin-bottom:18px;
                    ">✓</div>

                    <h2 style="
                        margin:0 0 10px;
                    ">
                        Payment Successful
                    </h2>

                    <p style="
                        margin:0 0 20px;
                        color:#667085;
                    ">
                        Your payment has been marked as paid.
                    </p>

                    <div style="
                        padding:14px;
                        border-radius:12px;
                        background:#ecfdf3;
                        margin-bottom:20px;
                    ">
                        <strong style="color:#067647;">
                            PAYMENT STATUS: PAID
                        </strong>
                        <br>
                        <small style="color:#667085;">
                            ${reference}
                        </small>
                    </div>

                    <button
                        class="primary-btn"
                        onclick="
                            closeModal();
                            if (typeof openMedicineOrders === 'function') {
                                openMedicineOrders();
                            }
                        "
                        style="width:100%;"
                    >
                        View My Orders
                    </button>
                </div>
            `);
        } else {
            alert(
                "Payment marked as Paid successfully."
            );
        }

    } catch (error) {
        console.error(
            "Medicine payment completion error:",
            error
        );

        alert(
            error.message ||
            "Could not mark payment as completed."
        );
    }
}


async function payMedicineThroughWhatsApp(reference) {
    try {
        const data = await api("/api/payment/whatsapp", {
            method: "POST",
            body: JSON.stringify({
                reference: reference
            })
        });

        if (data.whatsapp_url) {
            window.open(data.whatsapp_url, "_blank");
        }

    } catch (error) {
        console.error("WhatsApp medicine payment error:", error);
        showToast("Could not open WhatsApp payment");
    }
}

window.openMedicinePurchase = openMedicinePurchase;
window.purchaseMedicine = purchaseMedicine;
window.completeMedicinePayment = completeMedicinePayment;
window.payMedicineThroughWhatsApp = payMedicineThroughWhatsApp;


/* ============================================================
   MEDICINE ORDERS - FINAL WORKING VIEW
   ============================================================ */

async function openMedicineOrders() {
    try {
        const response = await fetch(
            "/api/medicine-orders"
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.error || "Could not load orders."
            );
        }

        const orders =
            data.orders || [];

        if (!orders.length) {
            openModal(
                "My Orders",
                `
                <div style="
                    text-align:center;
                    padding:30px 15px;
                ">
                    <div style="
                        font-size:42px;
                        margin-bottom:12px;
                    ">
                        📦
                    </div>

                    <h3>
                        No orders yet
                    </h3>

                    <p style="
                        color:#64748b;
                        font-size:13px;
                    ">
                        Your medicine purchases will
                        appear here.
                    </p>
                </div>
                `
            );
            return;
        }

        const orderHtml =
            orders.map(order => {

                const status =
                    String(
                        order.status ||
                        "Payment pending"
                    );

                const paid =
                    status.toLowerCase() === "paid";

                return `
                    <div style="
                        border:1px solid #e2e8f0;
                        border-radius:14px;
                        padding:16px;
                        margin-bottom:12px;
                        background:#fff;
                    ">

                        <div style="
                            display:flex;
                            justify-content:space-between;
                            gap:12px;
                            align-items:flex-start;
                        ">

                            <div>
                                <div style="
                                    font-weight:800;
                                    font-size:15px;
                                ">
                                    ${escapeHtml(
                                        order.medicine ||
                                        "Medicine"
                                    )}
                                </div>

                                <div style="
                                    color:#64748b;
                                    font-size:12px;
                                    margin-top:4px;
                                ">
                                    ${escapeHtml(
                                        order.strength ||
                                        ""
                                    )}
                                </div>
                            </div>

                            <div style="
                                font-weight:800;
                                color:#0f172a;
                            ">
                                ₹${Number(
                                    order.total || 0
                                ).toFixed(2)}
                            </div>

                        </div>

                        <div style="
                            display:grid;
                            grid-template-columns:
                                1fr 1fr;
                            gap:8px;
                            margin-top:14px;
                            font-size:12px;
                        ">

                            <div>
                                <span style="
                                    color:#64748b;
                                ">
                                    Quantity
                                </span>
                                <br>
                                <strong>
                                    ${order.quantity || 1}
                                </strong>
                            </div>

                            <div>
                                <span style="
                                    color:#64748b;
                                ">
                                    Payment
                                </span>
                                <br>
                                <strong style="
                                    color:${paid
                                        ? "#15803d"
                                        : "#b45309"};
                                ">
                                    ${escapeHtml(status)}
                                </strong>
                            </div>

                        </div>

                        ${
                            order.payment_reference
                            ? `
                            <div style="
                                margin-top:10px;
                                font-size:10px;
                                color:#94a3b8;
                            ">
                                Ref:
                                ${escapeHtml(
                                    order.payment_reference
                                )}
                            </div>
                            `
                            : ""
                        }

                        <div style="
                            margin-top:8px;
                            font-size:10px;
                            color:#94a3b8;
                        ">
                            ${escapeHtml(
                                order.created_at ||
                                ""
                            )}
                        </div>

                    </div>
                `;

            }).join("");

        openModal(
            "My Orders",
            `
            <div>
                <div style="
                    margin-bottom:16px;
                    color:#64748b;
                    font-size:12px;
                ">
                    Your medicine purchase history
                </div>

                ${orderHtml}
            </div>
            `
        );

    } catch (error) {

        console.error(
            "Could not load medicine orders:",
            error
        );

        alert(
            error.message ||
            "Could not load My Orders."
        );
    }
}

window.openMedicineOrders =
    openMedicineOrders;

