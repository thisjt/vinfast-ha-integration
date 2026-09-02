import os

DOMAIN = "vinfast"
CONF_MAPBOX_TOKEN = "mapbox_token"
CONF_STADIA_TOKEN = "stadia_token"
CONF_EMAIL = "email"
CONF_PASSWORD = "password"
CONF_GEMINI_API_KEY = "gemini_api_key"
CONF_REGION = "region"
CONF_LANGUAGE = "language"

# ==========================================
# MULTI-REGION CONFIGURATION
# ==========================================
REGION_CONFIG = {
    "PH": {
        "AUTH0_DOMAIN": "vinfast-as-prod.jp.auth0.com",
        "AUTH0_CLIENT_ID": "QxeAC955IEDXBRcQGikSBAGXBUWKnstx",
        "AUTH0_AUDIENCE": "https://vinfast-as-prod.jp.auth0.com/api/v2/",
        "AUTH0_REALM": "Username-Password-Authentication",
        "API_BASE": "https://mobile.ccar-asia.vinfastauto.com",
        "AWS_REGION": "ap-southeast-1",
        "COGNITO_POOL_ID": "ap-southeast-1:728b6434-687b-4a27-8ed2-82a1e0a2f70d",
        "IOT_ENDPOINT": "iot.ccar-asia.vinfastauto.com",
        "CURRENCY": "PHP",
        "DEFAULT_COST_PER_KWH": 15.0,
        "DEFAULT_GAS_PRICE": 75.0
    },
    "VN": {
        "AUTH0_DOMAIN": "vin3s.au.auth0.com",
        "AUTH0_CLIENT_ID": "jE5xt50qC7oIh1f32qMzA6hGznIU5mgH",
        "API_BASE": "https://mobile.connected-car.vinfast.vn",
        "AWS_REGION": "ap-southeast-1",
        "COGNITO_POOL_ID": "ap-southeast-1:c6537cdf-92dd-4b1f-99a8-9826f153142a",
        "IOT_ENDPOINT": "prod.iot.connected-car.vinfast.vn",
        "CURRENCY": "VND",
        "DEFAULT_COST_PER_KWH": 4000.0,
        "DEFAULT_GAS_PRICE": 20000.0
    },
    "US": {
        "AUTH0_DOMAIN": "vin3s.us.auth0.com", 
        "AUTH0_CLIENT_ID": "jE5xt50qC7oIh1f32qMzA6hGznIU5mgH", 
        "API_BASE": "https://api.us.vinfastauto.com",
        "AWS_REGION": "us-east-1",
        "COGNITO_POOL_ID": "us-east-1:xxxxxx-xxxx-xxxx-xxxx",
        "IOT_ENDPOINT": "prod.iot.us.connected-car.vinfast.vn",
        "CURRENCY": "USD",
        "DEFAULT_COST_PER_KWH": 0.16,
        "DEFAULT_GAS_PRICE": 3.80
    },
    "EU": {
        "AUTH0_DOMAIN": "vin3s.eu.auth0.com",
        "AUTH0_CLIENT_ID": "jE5xt50qC7oIh1f32qMzA6hGznIU5mgH",
        "API_BASE": "https://api.eu.vinfastauto.com",
        "AWS_REGION": "eu-central-1",
        "COGNITO_POOL_ID": "eu-central-1:xxxxxx-xxxx-xxxx",
        "IOT_ENDPOINT": "prod.iot.eu.connected-car.vinfast.vn",
        "CURRENCY": "EUR",
        "DEFAULT_COST_PER_KWH": 0.35,
        "DEFAULT_GAS_PRICE": 1.85
    }
}

DEVICE_ID = "vfdashboard-community-edition"

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
HA_CONFIG_DIR = os.path.abspath(os.path.join(CURRENT_DIR, "..", ".."))
WWW_DIR = os.path.join(HA_CONFIG_DIR, "www")
MOCK_FILE = os.path.join(WWW_DIR, "mock_console_cmd.txt")

KNOWN_COMMANDS = {
    1: ("Lock Doors", "mdi:lock", "lock_doors"),
    2: ("Unlock Doors", "mdi:lock-open", "unlock_doors"),
    3: ("Honk Horn", "mdi:bullhorn", "honk_horn"),
    4: ("Flash Headlights", "mdi:car-light-high", "flash_headlights"),
    5: ("Turn On Climate", "mdi:fan", "turn_on_climate"),
    6: ("Turn Off Climate", "mdi:fan-off", "turn_off_climate"),
    7: ("Open Trunk", "mdi:car-back", "open_trunk"),
}