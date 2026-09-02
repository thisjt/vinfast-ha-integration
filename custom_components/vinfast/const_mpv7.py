from .const_vfe34 import SENSORS as BASE_SENSORS

# VinFast VF MPV 7 / Limo Green
# Specifications: 60.13 kWh LFP Battery, 450 km Range (NEDC), 201 hp / 280 Nm FWD
SPEC = {"capacity": 60.13, "range": 450, "ev_kwh_per_km": 0.14, "gas_km_per_liter": 13.8}

SENSORS = BASE_SENSORS.copy()
SENSORS.update({
    "34193_00001_00014": ("Mục tiêu sạc (Target)", "%", "mdi:battery-charging-100", "battery"),
})
