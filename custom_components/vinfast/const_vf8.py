from .const_common import COMMON_SENSORS, VIRTUAL_SENSORS, REAR_DOORS_WINDOWS

SPEC = {"capacity": 87.7, "range": 471, "ev_kwh_per_km": 0.19, "gas_km_per_liter": 11.1}
SENSORS = COMMON_SENSORS.copy()
SENSORS.update(VIRTUAL_SENSORS)
SENSORS.update(REAR_DOORS_WINDOWS)

# Exclusive VF8 architecture codes
SENSORS.update({
    "34183_00001_00005": ("12V Battery", "%", "mdi:car-battery", "battery"),
    "34220_00001_00001": ("Battery State of Health (SOH)", "%", "mdi:heart-pulse", "battery"),
    "34183_00001_00007": ("Outside Temperature", "°C", "mdi:thermometer", "temperature"),
    "34183_00001_00015": ("Inside Temperature", "°C", "mdi:thermometer", "temperature"),
    
    "34180_00001_00010": ("Vehicle Identifier Name (MQTT)", None, "mdi:badge-account", None),
    "34180_00001_00011": ("Battery Percentage", "%", "mdi:battery", "battery"),
    "34180_00001_00007": ("Estimated Range", "km", "mdi:map-marker-distance", "distance"),
    
    "34183_00000_00001": ("Charging Status", None, "mdi:ev-station", None),
    "34183_00000_00004": ("Remaining Charge Time", "min", "mdi:timer-outline", "duration"),
    "34183_00000_00012": ("Charging Power", "kW", "mdi:flash", "power"),
    "34183_00000_00015": ("Charging Voltage", "V", "mdi:flash-outline", "voltage"),
    "34183_00000_00016": ("Charging Current", "A", "mdi:current-ac", "current"),
    "34193_00001_00012": ("Charge Target", "%", "mdi:battery-charging-100", "battery"),
    
    "34187_00000_00000": ("Gear Position", None, "mdi:car-shift-pattern", None),
    "34188_00000_00000": ("Current Speed", "km/h", "mdi:speedometer", "speed"),
    "34199_00000_00000": ("Total Odometer", "km", "mdi:counter", "distance"),
    "34183_00001_00029": ("Electronic Parking Brake", None, "mdi:car-brake-parking", None),
    
    "34190_00000_00001": ("Tire Pressure Front Left", "bar", "mdi:tire", "pressure"),
    "34190_00001_00001": ("Tire Pressure Front Right", "bar", "mdi:tire", "pressure"),
    "34190_00002_00001": ("Tire Pressure Rear Left", "bar", "mdi:tire", "pressure"),
    "34190_00003_00001": ("Tire Pressure Rear Right", "bar", "mdi:tire", "pressure"),
})