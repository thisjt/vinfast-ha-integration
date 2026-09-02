import logging
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import DOMAIN, CONF_EMAIL, CONF_PASSWORD, CONF_GEMINI_API_KEY, CONF_REGION, CONF_LANGUAGE
from .api import VinFastAPI

_LOGGER = logging.getLogger(__name__)

PLATFORMS = ["sensor", "button"]

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    hass.data.setdefault(DOMAIN, {})

    email = entry.data.get(CONF_EMAIL, entry.data.get("email"))
    password = entry.data.get(CONF_PASSWORD, entry.data.get("password"))
    
    region = entry.options.get(CONF_REGION, entry.data.get(CONF_REGION, "VN"))
    lang = entry.options.get(CONF_LANGUAGE, entry.data.get(CONF_LANGUAGE, "en"))
    gemini_key = entry.options.get(CONF_GEMINI_API_KEY, entry.data.get(CONF_GEMINI_API_KEY, ""))

    api = VinFastAPI(email, password, region=region, lang=lang, gemini_api_key=gemini_key, options=entry.options)
    api.hass = hass
    logged_in = await hass.async_add_executor_job(api.login)
    if not logged_in:
        _LOGGER.error("VinFast: Login failed.")
        return False
    
    vehicles = await hass.async_add_executor_job(api.get_vehicles)
    if not vehicles:
        _LOGGER.error("VinFast: No vehicles found.")
        return False

    hass.data[DOMAIN][entry.entry_id] = {"api": api}
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    def start_mqtt_thread():
        api.start_mqtt()
        
    await hass.async_add_executor_job(start_mqtt_thread)
    entry.async_on_unload(entry.add_update_listener(update_listener))
    
    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        domain_data = hass.data[DOMAIN].pop(entry.entry_id)
        api = domain_data.get("api")
        if api:
            await hass.async_add_executor_job(api.stop)
    return unload_ok

async def update_listener(hass: HomeAssistant, entry: ConfigEntry):
    _LOGGER.info("VinFast: Configuration updated, reloading...")
    await hass.config_entries.async_reload(entry.entry_id)