import requests
import time

def get_ai_advice(api_key, ai_model, mode, data_payload, context_data):
    """Send analysis prompt to Google Gemini AI"""
    if not api_key or api_key.strip() == "":
        return "Please enter a Google Gemini API Key for AI evaluation."

    temp = context_data.get("temp", "Unknown")
    cond = context_data.get("cond", "Unknown")
    hvac = context_data.get("hvac", "Normal")
    expected_km_per_1 = context_data.get("expected_km_per_1", 2.1)

    prompt = ""

    if mode == "weather" and data_payload:
        w_temp = data_payload.get('temp', temp)
        w_cond = data_payload.get('cond', cond)
        prompt = (
            f"EXTREME WEATHER ADVISORY: Outdoor temperature is {w_temp} degrees C, weather condition: {w_cond}. "
            f"Acting as the VinFast EV in-car AI co-pilot, write ONE very concise sentence in English (under 40 words) "
            "advising the driver how to set the climate control and drive safely and efficiently right now."
        )
    elif mode == "anomaly" and data_payload:
        dist = round(data_payload.get('dist', 0), 2)
        spd = round(data_payload.get('speed', 0), 1)
        prompt = (
            f"BATTERY DRAIN WARNING: The EV just dropped 1% battery after driving only {dist}km "
            f"(ideal manufacturer benchmark is {expected_km_per_1} km per 1%). "
            f"Current driving speed: {spd}km/h. Climate control load: {hvac}. "
            "Acting as the vehicle's AI advisor, write ONE concise sentence in English (under 40 words) "
            "identifying the likely cause of high consumption (speed vs. climate) and providing quick advice."
        )
    else: # Trip mode
        dist = data_payload.get('dist', 0) if data_payload else context_data.get("trip_dist", 0.0)
        drop = data_payload.get('drop', 0) if data_payload else 0
        
        if dist < 0.05: 
            return f"System waiting... Current trip ({dist}km) is too short to analyze."

        actual_km_per_1 = round(dist / drop, 2) if drop > 0 else dist
        spd = context_data.get("trip_avg_speed", 0)
        
        prompt = (
            f"Acting as an EV engineering analyst: A trip was just completed covering {round(dist,2)}km, consuming {round(drop,1)}% battery. "
            f"Actual efficiency achieved: {actual_km_per_1} km / 1% battery (Manufacturer standard: {expected_km_per_1} km / 1%). "
            f"Average speed: {spd}km/h. Ambient: {temp}°C, {cond}. Climate load: {hvac}. "
            "Write ONE brief paragraph in English (under 50 words) evaluating whether this trip's efficiency was excellent, average, or poor, "
            "and provide 1 recommendation."
        )

    clean_key = api_key.strip()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{ai_model}:generateContent"
    headers = {"Content-Type": "application/json", "x-goog-api-key": clean_key}
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    
    for attempt in range(3):
        try:
            res = requests.post(url, json=payload, headers=headers, timeout=30)
            if res.status_code == 200:
                ai_text = res.json().get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                return ai_text.replace("*", "").strip() if ai_text else "Google AI returned no content."
            elif res.status_code == 403: return "❌ Error 403: Invalid API key or Generative Language API is not enabled."
            elif res.status_code == 404: return f"❌ Error 404: Model '{ai_model}' does not exist or is locked."
            elif res.status_code == 400: return "❌ Error 400: Invalid API Key format."
            elif res.status_code in [503, 429]:
                if attempt < 2: 
                    time.sleep(3)
                    continue
                return f"⏳ Google AI is overloaded (Error {res.status_code})."
            else:
                return f"❌ Google returned error {res.status_code}"
        except requests.exceptions.RequestException:
            if attempt < 2:
                time.sleep(3)
                continue
            return "❌ Local network error: Cannot connect to Google AI."
            
    return "Unknown error contacting AI."