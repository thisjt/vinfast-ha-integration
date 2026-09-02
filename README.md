# 🚗 VinFast Smart Integration for Home Assistant

A powerful, full-featured integration bringing your VinFast electric vehicle into the Home Assistant ecosystem.
Far beyond simple data pulling, this component is equipped with advanced data science and telemetry algorithms to turn Home Assistant into a real-time vehicle monitoring hub operating 24/7 without needing the official mobile app open.

---

## ✨ Core Features

- **🚀 Real-Time Telemetry (MQTT & WebSockets)**:
  Connects directly to VinFast's AWS IoT Core via WebSockets with automatic bypass mechanisms to maintain a persistent 24/7 data stream. Automatically responds to ping packets from the vehicle's onboard T-Box.

- **🧠 Smart Dynamic Efficiency Profiling**:
  Features intelligent frequency sampling algorithms. Automatically filters out red light stops and idling, accurately determining the vehicle's "Optimal Speed Band" for every 1% battery dropped.

- **🔋 Instant Smart Charging Management**:
  Detects charger plug-in and unplug events within seconds via MQTT. Automatically runs background threads to retrieve charging history (kWh added, efficiency, session duration) upon session completion.

- **⏱️ Intelligent Trip Management**:
  Automatically detects new driving trips when wheels begin moving. Closes and archives trip logs (distance, estimated electric vs. petrol cost, average speed) once the vehicle has been parked for 30 minutes.

- **🗺️ Anti-Flicker GPS Tracking**:
  Utilizes 11-meter satellite drift filtering and OpenStreetMap reverse geocoding to keep the `device_tracker` entity rock solid when parked in garages, saving Home Assistant database resources.

- **🎮 Dynamic Remote Commands**:
  Provides button entities for Door Lock/Unlock, Climate Control, Horn, and Headlights. Standardizes entity IDs in `[model]_[vin]_[sensor_name]` format to seamlessly support multi-vehicle garages without collision.

- **🤖 EV AI Advisor (Optional Google Gemini Integration)**:
  Analyzes weather anomalies, trip consumption spikes, and driving habits to provide real-time proactive recommendations.

---

## 📥 Installation via HACS (Recommended)

The easiest way to install and receive automatic updates is through HACS (Home Assistant Community Store):

1. Open Home Assistant and navigate to **HACS** in the left sidebar.
2. Select **Integrations**.
3. Click the three dots (menu) in the top-right corner and select **Custom repositories**.
4. Fill in the following:
   - **Repository**: `https://github.com/thangnd85/vinfast-connected-car`
   - **Category**: `Integration`
5. Click **Add**.
6. Close the dialog. You will now see **VinFast** listed. Click it and select **Download**.
7. ⚠️ **Important**: Restart your Home Assistant instance.

---

## ⚙️ Configuration

Once installed and restarted:

1. Navigate to **Settings** -> **Devices & Services**.
2. Click **Add Integration** in the lower-right corner.
3. Search for **VinFast** and select it.
4. Enter your VinFast App credentials (Email, Password, Region, and Language). All credentials are saved locally in your Home Assistant instance.

Home Assistant will automatically authenticate, retrieve your VIN(s), and generate all sensors and buttons with standard naming:
```
sensor.[model]_[vin]_[sensor_name] (e.g., sensor.vf8_abcd1234_battery_percentage)
```

---

## 🛠️ Options & Cost Calculation

This integration allows you to calculate charging costs and compare them against equivalent petrol consumption in real-time.
Under **Devices & Services** -> **VinFast**, click **Configure** to adjust:

- **Electricity Price**: Default 4,000 VND/kWh (or local equivalent).
- **Petrol Fuel Price**: Default 20,000 VND/L (or local equivalent).
- **EV Reference Consumption**: (kWh/100km).
- **Petrol Reference Consumption**: (km/L).
- **Gemini API Key & Model**: For the EV AI Advisor.

---

## 🎨 Dashboard / Digital Twin Card

This repository contains the backend core integration.
For a luxury 3D Digital Twin vehicle dashboard, interactive Leaflet route map, and animated telemetry indicators, install our custom Lovelace card:

👉 [VinFast Digital Twin Card](https://github.com/thangnd85/vinfast-digital-twin-card)

<img width="484" alt="Digital Twin Overview" src="https://github.com/user-attachments/assets/cd5410a9-936f-459e-ba8f-a7628413b85c" />
<img width="484" alt="Battery & Efficiency Gauges" src="https://github.com/user-attachments/assets/ca1d18dc-8d4d-46f9-a87e-57c492bffb17" />
<img width="485" alt="Speed Band Efficiency" src="https://github.com/user-attachments/assets/9c972cde-e56d-49d9-b7f9-f9e1ec05fba3" />
<img width="484" alt="Interactive Leaflet GPS Map" src="https://github.com/user-attachments/assets/fd32dc0c-70e1-4619-977c-49c19a3a2424" />
<img width="484" alt="Charging History" src="https://github.com/user-attachments/assets/11f68c2d-4bdc-4003-8bdf-63b0e54c0600" />
<img width="484" alt="Security & Tire Pressure" src="https://github.com/user-attachments/assets/a2f4a13a-4609-4833-9838-a163d9ff4b3f" />

---

## 🛡️ Disclaimer

This project is developed by the open-source community and is **NOT** an official product of, nor certified or affiliated with VinFast Auto Ltd.

All telematics queries, data retrieval, and remote commands (Lock/Unlock, Climate, etc.) communicate via the reverse-engineered APIs of the VinFast mobile app. Users assume all responsibility and risk when using this integration with their vehicle.

This integration does not transmit credentials or vehicle telemetry to any third party beyond the official VinFast cloud infrastructure and your chosen local Home Assistant installation.
