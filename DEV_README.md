# 🚘 Developer Guide: VinFast EV Custom Integration

The **VinFast EV Custom Integration** is a Python-based Home Assistant integration core that connects Home Assistant directly to VinFast's AWS IoT Cloud infrastructure.
Unlike slow polling API integrations, this system utilizes MQTT over WebSockets for real-time telemetry streaming and features a proprietary Cold Boot State Persistence engine to handle T-Box deep sleep states on vehicles.

This guide provides architectural details and step-by-step instructions for developers looking to add features, decode new vehicle sensors, or modify the data pipeline.

---

## 📂 1. Core Codebase Architecture

- **`api.py` / `api_auth.py` / `api_mqtt.py` / `api_helpers.py`**:
  The heart of the integration. Manages Auth0 OAuth2 flows, AWS Cognito Identity Pools, AWS IoT certificate signing, WebSocket MQTT connection lifecycle, live trip processing, geocoding, and JSON state persistence.

- **`const.py` & `const_common.py`**:
  The telemetry dictionaries. Contains API endpoint configurations, command definitions, and dictionary tables mapping raw OMA-LWM2M codes to Home Assistant sensor specifications.

- **`model_registry.py`**:
  Vehicle model dispatcher and fallback handler. Resolves VIN and marketing name patterns (VF3, VF5, VFe34, VF6, VF7, VF8, VF9, MPV 7) to their respective platform constants.

- **`sensor.py`**:
  Instantiates Sensor entities. Translates raw telemetry values (e.g. 0/1, discrete modes) into human-readable states while managing Home Assistant character limits.

- **`button.py` / `device_tracker.py`**:
  Implements actionable remote controls (Lock, Unlock, Horn, Lights, Climate) and GPS map tracking.

- **`ai_gemini.py`**:
  EV AI Advisor powered by Google Gemini (flash / pro models) for driving analysis, anomaly detection, and route weather suggestions.

- **`map_matching.py`**:
  Multi-stage GPS map-matching pipeline utilizing OpenStreetMap Overpass API, heading vectors, speed profiles, and perpendicular snapping.

---

## 🧠 2. Core Concepts

### A. OMA-LWM2M Telemetry Standard
VinFast vehicles use the OMA-LWM2M IoT standard. Telemetry sent via MQTT arrives as JSON objects:
```json
{"objectId": "34183", "instanceId": "1", "resourceId": "9", "value": "85"}
```
The integration concatenates these fields into standardized string keys:
`34183_00001_00009` (which corresponds to Battery Percentage SOC).

### B. Central Data Bus (`self._last_data`)
Every packet received from MQTT is unpacked and updated into a central dictionary named `self._last_data` inside `VinFastAPI` (`api.py`). Sensor entities subscribe to this data bus and automatically dispatch state updates via callbacks.

---

## 🛠 3. Step-by-Step Development Guide

### Adding a Newly Discovered Sensor
Suppose network sniffing reveals that code `34210_00001_00002` represents "Infotainment Screen Brightness" (0–100%). To expose it in Home Assistant:

#### Step 1: Register in the appropriate constants file
Locate the relevant vehicle dictionary (e.g., in `const_common.py` or a specific model file like `const_vf8.py`) and append the definition:
```python
# Format: "Raw_Code": ("Display Name", "Unit", "MDI Icon", "Device Class")
"34210_00001_00002": ("Screen Brightness", "%", "mdi:brightness-6", None),
```

#### Step 2: (Optional) Value formatting in `sensor.py`
If the raw value requires discrete string conversion, edit `_process_update` in `sensor.py`:
```python
elif self._device_key == "34210_00001_00002":
    self._attr_native_value = "Maximum" if str(val) == "100" else f"{val}%"
```

### Handling Home Assistant's 255-Character State Limit
Home Assistant state strings are capped at 255 characters. Values exceeding this limit (such as full GPS route JSON strings or debug logs) must be placed in `extra_state_attributes`:
```python
elif self._device_key == "api_trip_route":
    self._attr_native_value = "Map Data"
    self._attr_extra_state_attributes = {"route_json": val if isinstance(val, str) else json.dumps(val)}
```

### Adding Background Computational Logic
To compute derived metrics (e.g. Battery SOH degradation, trip efficiency, predictive maintenance):
1. **Event-driven computations**: Hook into `_on_message` in `api_mqtt.py` when matching telemetry arrives.
2. **Periodic timers**: Hook into the background maintenance loop in `_api_polling_loop` in `api.py`.

---

## 💾 4. State Persistence (Cold Boot Recovery)

When vehicles are parked and enter deep sleep, the onboard T-Box ceases transmitting MQTT packets. To ensure Home Assistant displays accurate data after restarts:
- State snapshots are cached locally to `/config/www/vinfast_state_[vin].json` every 60 seconds and on shutdown.
- When creating new internal tracking variables (e.g., `self._climate_start_time`), register them in both:
  - `_save_state(self)`: Include the variable in the persistence dictionary.
  - `_load_state(self)`: Restore the variable from disk on initialization.

---

## 🔍 5. Telemetry Debugging & Reverse Engineering

The integration includes a built-in diagnostic sensor: `sensor.[model]_[vin]_debug_raw_data`.
- All incoming raw OMA-LWM2M packets are stored in the attributes of this sensor.
- Developers can open Home Assistant's **Developer Tools -> States** to inspect incoming telemetry codes in real time without external sniffing tools.
- A complementary frontend diagnostic card (`vinfast-debug-card.js`) is provided for visual inspection and changelog filtering.

---

## 🤝 Contributing

If you decode new OMA-LWM2M codes (e.g., ADAS alerts, heated seat states, door lock codes for new platforms), please submit a Pull Request or open an issue!
