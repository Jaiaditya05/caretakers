const connectButton = document.getElementById("connect-btn");

async function connectWatch() {

    try {

        // Browser Bluetooth
        if (navigator.bluetooth) {

            const device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: ['battery_service']
            });

            saveDevice({
                id: device.id,
                name: device.name || "Unknown Watch",
                battery: 100
            });

        } else {
            demoConnection();
        }

    } catch (err) {
        demoConnection();
    }

}


async function demoConnection() {

    const res = await fetch("/api/devices");
    const devices = await res.json();

    const device = devices[0];

    saveDevice(device);

}


async function saveDevice(device) {

    await fetch("/api/connect", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(device)
    });

    connectButton.innerHTML = "✓ Connected";
    connectButton.classList.remove("bg-primary-container");
    connectButton.classList.add("bg-green-600");

    document.getElementById("device-name").innerText =
        device.name;

}