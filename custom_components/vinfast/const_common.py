# VIRTUAL SENSORS (Common across all vehicle models)
VIRTUAL_SENSORS = {
    "api_vehicle_status": ("Operating Status", None, "mdi:car-info", None),
    "api_current_address": ("Vehicle Location (Address)", None, "mdi:map-marker", None),
    "api_trip_distance": ("Trip Distance", "km", "mdi:map-marker-distance", "distance"),
    "api_trip_avg_speed": ("Trip Average Speed", "km/h", "mdi:speedometer-medium", "speed"),
    "api_trip_energy_used": ("Trip Energy Consumption", "kWh", "mdi:lightning-bolt", "energy"),
    "api_trip_efficiency": ("Trip Consumption Efficiency", "kWh/100km", "mdi:leaf-circle", None),
    "api_static_capacity": ("Design Battery Capacity", "kWh", "mdi:car-battery", "energy"),
    "api_static_range": ("Announced Range (Max)", "km", "mdi:map-marker-distance", "distance"),
    "api_soh_calculated": ("Battery State of Health (Calculated SOH)", "%", "mdi:heart-pulse", "battery"),
    "api_battery_degradation": ("Battery Degradation (by SOH)", "kWh", "mdi:battery-minus", "energy"),
    "api_est_range_degradation": ("Estimated Range Degradation (Reference)", "%", "mdi:battery-alert", None),
    "api_lifetime_efficiency": ("Average Consumption Efficiency", "kWh/100km", "mdi:leaf", None),
    "api_calc_max_range": ("Realistic Full Range (100% Battery)", "km", "mdi:map-marker-path", "distance"),
    "api_calc_remain_range": ("Remaining Range (by Efficiency)", "km", "mdi:map-marker-distance", "distance"),
    "api_calc_range_per_percent": ("Distance per 1% Battery", "km", "mdi:ruler", "distance"),
    "api_best_efficiency_band": ("Optimal Speed Range", None, "mdi:chart-bell-curve", None),
    "api_last_charge_start_soc": ("Battery % at Plug-in (Last Session)", "%", "mdi:battery-arrow-down", "battery"),
    "api_last_charge_end_soc": ("Battery % at Unplug (Last Session)", "%", "mdi:battery-arrow-up", "battery"),
    "api_last_charge_duration": ("Charging Duration (Last Session)", "min", "mdi:timer-sand", "duration"),
    "api_last_charge_energy": ("Grid Energy Consumed (Last Session)", "kWh", "mdi:flash", "energy"),
    "api_last_charge_efficiency": ("Real Charging Efficiency (Last Session)", "%", "mdi:car-electric-outline", None),
    "api_last_charge_power": ("Average Charging Power (Last Session)", "kW", "mdi:ev-plug-type2", "power"),
    "api_live_charge_power": ("Live Calculated Charging Power", "kW", "mdi:flash", "power"),
    "api_total_charge_cost_est": ("Estimated Total Charging Cost", "VND", "mdi:cash-fast", "monetary"),
    "api_trip_charge_cost": ("Trip Charging Cost", "VND", "mdi:cash-fast", "monetary"),
    "api_total_gas_cost": ("Equivalent Total Gasoline Cost", "VND", "mdi:gas-station", "monetary"),
    "api_trip_gas_cost": ("Trip Gasoline Cost", "VND", "mdi:gas-station", "monetary"),
    "api_total_charge_sessions": ("Total Charging Sessions", "sessions", "mdi:battery-charging-100", None),
    "api_public_charge_sessions": ("Public Station Charging Sessions", "sessions", "mdi:ev-station", None),
    "api_home_charge_sessions": ("Home Charging Sessions", "sessions", "mdi:home-lightning-bolt-outline", None),
    "api_home_charge_kwh": ("Home Charging Energy", "kWh", "mdi:home-battery", "energy"),
    "api_total_energy_charged": ("Total Energy Charged", "kWh", "mdi:lightning-bolt", "energy"),
    "api_vehicle_model": ("Vehicle Model", None, "mdi:car", None),
    "api_vehicle_name": ("Vehicle Identifier Name", None, "mdi:account-car", None),
    "api_outside_temp": ("Outside Temperature", "°C", "mdi:thermometer", "temperature"),
    "api_weather_condition": ("Current Weather", None, "mdi:weather-partly-cloudy", None),
    "api_hvac_load_estimate": ("Estimated HVAC Load", None, "mdi:air-conditioner", None),
    "api_ai_advisor": ("EV AI Advisor", None, "mdi:robot-outline", None),
    "api_vehicle_image": ("Vehicle Image URL", None, "mdi:image", None),
    "api_trip_route": ("GPS Route", None, "mdi:map-marker-path", None),
    "api_nearby_stations": ("Nearby Charging Stations", None, "mdi:ev-station", None),
    "api_security_warning": ("Security Warning", None, "mdi:shield-alert", None),
    "api_debug_raw": ("System Debug Raw", None, "mdi:bug", None)
}

# COMMON SENSORS (Present across all VF3, VF5, 6, 7, e34, VF8, VF9 models)
COMMON_SENSORS = {
    "00006_00001_00000": ("Latitude", "°", "mdi:crosshairs-gps", None),
    "00006_00001_00001": ("Longitude", "°", "mdi:crosshairs-gps", None),
    "00006_00001_00002": ("Altitude", "m", "mdi:elevation-rise", None),
    "00005_00001_00030": ("Software Version (FRP)", None, "mdi:update", None),
    "34196_00001_00004": ("T-Box Version", None, "mdi:cellphone-link", None),
    "34181_00001_00007": ("License Plate / Secondary Name", None, "mdi:card-text-outline", None),
    
    "34213_00001_00003": ("Central Lock", None, "mdi:lock", None),
    "34234_00001_00003": ("Security Status", None, "mdi:shield-car", None),
    "34186_00005_00004": ("Hazard Warning Lights", None, "mdi:car-light-alert", None),
    "34205_00001_00001": ("Valet Mode", None, "mdi:account-tie-hat", None),
    "34206_00001_00001": ("Camp Mode", None, "mdi:tent", None),
    "34207_00001_00001": ("Pet Mode", None, "mdi:paw", None),

    "10351_00002_00050": ("Driver Door", None, "mdi:car-door", None),
    "10351_00001_00050": ("Passenger Door", None, "mdi:car-door", None),
    "10351_00006_00050": ("Trunk", None, "mdi:car-door", None),
    "10351_00005_00050": ("Hood", None, "mdi:car-door", None),
    "34215_00002_00002": ("Driver Window", None, "mdi:window-open", None),
    "34215_00001_00002": ("Passenger Window", None, "mdi:window-open", None),
    
    "34213_00003_00003": ("Window Motor Status", None, "mdi:car-door-window", None),
    "34213_00002_00003": ("Trunk Motor Status", None, "mdi:car-back", None),

    "34213_00004_00003": ("Headlight Flash Status", None, "mdi:car-light-high", None),
    "34184_00001_00004": ("Climate Control Status", None, "mdi:air-conditioner", None),
    "34184_00001_00011": ("Air Intake Mode", None, "mdi:car-windshield-outline", None),
    "34184_00001_00012": ("Airflow Direction", None, "mdi:fan", None),
    "34184_00001_00009": ("Windshield Defroster", None, "mdi:car-defrost-front", None),
    "34184_00001_00025": ("Fan Speed Level", "Level", "mdi:fan-speed-1", None),
    "34184_00001_00041": ("Cooling Level", "Level", "mdi:snowflake", None),
}

# ADDITIONAL LAYER FOR 4-DOOR VEHICLES
REAR_DOORS_WINDOWS = {
    "10351_00004_00050": ("Rear Driver Door", None, "mdi:car-door", None),
    "10351_00003_00050": ("Rear Passenger Door", None, "mdi:car-door", None),
    "34215_00004_00002": ("Rear Driver Window", None, "mdi:window-open", None),
    "34215_00003_00002": ("Rear Passenger Window", None, "mdi:window-open", None),
}

# PLATFORM A BASE (VF3, VF5, e34, VF6, VF7)
PLATFORM_A_BASE = COMMON_SENSORS.copy()
PLATFORM_A_BASE.update({
    "34183_00001_00009": ("Battery Percentage", "%", "mdi:battery", "battery"),
    "34183_00001_00011": ("Estimated Range", "km", "mdi:map-marker-distance", "distance"),
    "34183_00001_00001": ("Gear Position", None, "mdi:car-shift-pattern", None),
    "34183_00001_00002": ("Current Speed", "km/h", "mdi:speedometer", "speed"),
    "34183_00001_00003": ("Total Odometer", "km", "mdi:counter", "distance"),
    "34183_00001_00010": ("Drive Status (Ready)", None, "mdi:car-key", None), 
    
    "34183_00001_00029": ("Electronic Parking Brake", None, "mdi:car-brake-parking", None),
    "34183_00001_00035": ("Foot Brake Switch", None, "mdi:car-brake-fluid-level", None),
    
    "34183_00001_00005": ("12V Battery", "%", "mdi:car-battery", "battery"),
    "34220_00001_00001": ("Battery State of Health (SOH)", "%", "mdi:heart-pulse", "battery"),
    
    "34193_00001_00031": ("Charging Cable (Plug)", None, "mdi:ev-plug-type2", None),
    "34193_00001_00005": ("Charging Status", None, "mdi:ev-station", None), 
    "34193_00001_00007": ("Remaining Charge Time", "min", "mdi:timer-outline", "duration"),
    
    "34193_00001_00026": ("Estimated Charging Time", "min", "mdi:timer-sand", "duration"),
    "34193_00001_00013": ("Estimated Charge Completion Time", None, "mdi:clock-check-outline", None),
    "34193_00001_00032": ("Charging System Relay", None, "mdi:electric-switch", None),
    "34193_00001_00016": ("Charging Session ID", None, "mdi:identifier", None),
    
    "34183_00001_00007": ("Outside Temperature", "°C", "mdi:thermometer", "temperature"),
    "34183_00001_00015": ("Inside Temperature", "°C", "mdi:thermometer", "temperature"),
    "34224_00001_00005": ("HVAC Set Temperature", "°C", "mdi:thermostat", "temperature"),
})

# SPECIALIZED CODE SET FOR PLATFORM A (VF5, VF6, VF7, VF e34)
PLATFORM_VF567_SENSORS = PLATFORM_A_BASE.copy()
PLATFORM_VF567_SENSORS.update(REAR_DOORS_WINDOWS)

# Fix duplicate Central Lock sensor issue on VF6
if "34213_00001_00003" in PLATFORM_VF567_SENSORS:
    del PLATFORM_VF567_SENSORS["34213_00001_00003"]

PLATFORM_VF567_SENSORS.update({
    "56789_00001_00005": ("Headlight Status", None, "mdi:car-light-high", None),
    "34206_00001_00001": ("Central Lock", None, "mdi:lock", None), 
})

# PLATFORM B BASE (VF8, VF9)
PLATFORM_B_BASE = COMMON_SENSORS.copy()
PLATFORM_B_BASE.update(REAR_DOORS_WINDOWS) 
PLATFORM_B_BASE.update({
    "34180_00001_00011": ("Battery Percentage", "%", "mdi:battery", "battery"),
    "34180_00001_00007": ("Estimated Range", "km", "mdi:map-marker-distance", "distance"),
    "34187_00000_00000": ("Gear Position", None, "mdi:car-shift-pattern", None),
    "34188_00000_00000": ("Current Speed", "km/h", "mdi:speedometer", "speed"),
    "34199_00000_00000": ("Total Odometer", "km", "mdi:counter", "distance"),
    "34180_00001_00010": ("Drive Status (Ready)", None, "mdi:car-key", None),
    "34181_00000_00000": ("12V Battery", "%", "mdi:car-battery", "battery"),
    
    "34183_00000_00001": ("Charging Status", None, "mdi:ev-station", None),
    "34183_00000_00004": ("Charging Cable (Plug)", None, "mdi:ev-plug-type2", None),
    "34183_00000_00009": ("Remaining Charge Time", "min", "mdi:timer-outline", "duration"),
    "34183_00000_00012": ("Charging Power (Station)", "kW", "mdi:flash", "power"),
    
    "34189_00000_00000": ("Outside Temperature", "°C", "mdi:thermometer", "temperature"),
    "34190_00000_00000": ("Inside Temperature", "°C", "mdi:thermometer", "temperature"),
})