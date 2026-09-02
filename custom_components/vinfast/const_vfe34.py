from .const_vf5 import SENSORS as BASE_SENSORS

SPEC = {"capacity": 42.0, "range": 285, "ev_kwh_per_km": 0.15, "gas_km_per_liter": 14.0}
SENSORS = BASE_SENSORS.copy()
SENSORS.update({
    "34183_00001_00016": ("Tire Pressure Front Left", "bar", "mdi:tire", "pressure"),
    "34183_00001_00017": ("Tire Pressure Front Right", "bar", "mdi:tire", "pressure"),
    "34183_00001_00018": ("Tire Pressure Rear Left", "bar", "mdi:tire", "pressure"),
    "34183_00001_00019": ("Tire Pressure Rear Right", "bar", "mdi:tire", "pressure"),
})