class VinFastDigitalTwin extends HTMLElement {
  setConfig(config) {
    this.config = config || {};
    this._map = null;
    this._polyline = null;
    this._marker = null;
    this._stationLayer = null;
    this._leafletLoaded = false;
    this._lastLat = null;
    this._lastLon = null;
    
    this._lastHeadingLat = null;
    this._lastHeadingLon = null;
    this._currentAngle = undefined; 
    
    this._isReplaying = false;
    this._isPaused = false;
    this._currentReplayIdx = 0;
    this._animationFrameId = null;
    
    this._tripHistory = []; 
    this._rawRouteCoords = []; 
    this._smoothedRouteCoords = []; 

    this._stationFilter = 'ALL'; 
    this._currentStations = []; 
    this._prevStationStr = null;
    this._chargeHistoryData = [];
    
    this._effToggleTimer = null;
    this._effToggleState = false;
    this._entityPrefix = null; 
    this._lastAiMessage = ""; 
  }

  safeParseJSON(str) {
      if (!str) return [];
      if (typeof str !== 'string') return str;
      try { return JSON.parse(str); }
      catch(e) {
          try { 
              let fixedStr = str.replace(/'/g, '"').replace(/True/g, 'true').replace(/False/g, 'false').replace(/None/g, 'null');
              return JSON.parse(fixedStr); 
          }
          catch(e2) { return []; }
      }
  }

  loadLeaflet() {
    if (this._leafletLoaded) return;
    this._leafletLoaded = true;
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => { setTimeout(() => this.initMap(), 200); };
    document.head.appendChild(script);
  }

  async fetchChargeHistory(vin) {
      if (!vin) return;
      try {
          const res = await fetch(`/local/vinfast_charge_history_${vin.toLowerCase()}.json?v=${new Date().getTime()}`);
          if (res.ok) {
              this._chargeHistoryData = await res.json();
              const box = this.querySelector('#box-charge');
              if (box && box.classList.contains('active-box')) this.renderChargeHistory();
          }
      } catch(e) {}
  }

  async fetchTripHistory(vin) {
    if (!vin) return;
    try {
        const res = await fetch(`/local/vinfast_trips_${vin.toLowerCase()}.json?v=${new Date().getTime()}`);
        if (res.ok) {
            this._tripHistory = await res.json();
            this.renderTripSelector();
        }
    } catch(e) {}
  }

  cleanRouteData(points) {
      if (!points || !Array.isArray(points) || points.length === 0) return [];
      return points.map(p => [p[0], p[1], p[2] || 0]); 
  }

  _smoothRouteData(points) {
      if (!points || points.length < 2) return points;
      let filtered = [points[0]];
      for (let i = 1; i < points.length; i++) {
          let prev = filtered[filtered.length - 1];
          let curr = points[i];
          let dist = this.getDistanceFromLatLonInM(prev[0], prev[1], curr[0], curr[1]);
          if (dist > 2.0 || curr[2] > 0) { 
              filtered.push(curr); 
          }
      }
      return filtered;
  }

  getDistanceFromLatLonInM(lat1, lon1, lat2, lon2) {
      var R = 6371000; 
      var dLat = (lat2-lat1) * Math.PI / 180;
      var dLon = (lon2-lon1) * Math.PI / 180; 
      var a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2); 
      var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
      return R * c;
  }

  renderEmptyTripSelector() {
      const selectEl = this.querySelector('#trip-selector');
      if (selectEl) selectEl.innerHTML = `<option value="current">📍 Recording Trip...</option>`;
  }

  renderTripSelector() {
      const selectEl = this.querySelector('#trip-selector');
      if (!selectEl || this._tripHistory.length === 0) { this.renderEmptyTripSelector(); return; }
      let options = `<option value="current">📍 Current Trip (Live)</option>`;
      this._tripHistory.forEach((trip, index) => {
          let shortStart = (trip.start_address || "").split(',')[0].substring(0, 15);
          options += `<option value="${index}">🗓 ${trip.date} ${trip.start_time} - ${trip.distance}km (${shortStart}...)</option>`;
      });
      selectEl.innerHTML = options;
  }

  getBearing(startLat, startLng, destLat, destLng) {
      startLat = startLat * Math.PI / 180; startLng = startLng * Math.PI / 180;
      destLat = destLat * Math.PI / 180; destLng = destLng * Math.PI / 180;
      const y = Math.sin(destLng - startLng) * Math.cos(destLat);
      const x = Math.cos(startLat) * Math.sin(destLat) - Math.sin(startLat) * Math.cos(destLat) * Math.cos(destLng - startLng);
      let brng = Math.atan2(y, x);
      return (brng * 180 / Math.PI + 360) % 360;
  }

  _smoothRotation(targetAngle) {
      if (this._currentAngle === undefined) { this._currentAngle = targetAngle; return targetAngle; }
      let diff = targetAngle - (this._currentAngle % 360);
      diff = ((diff + 540) % 360) - 180;
      this._currentAngle += diff;
      return this._currentAngle;
  }

  getCarIcon(angle = 0, speed = null) {
      if(typeof L === 'undefined') return null;
      const arrowSvg = `<svg class="car-dir-svg" viewBox="0 0 24 24" fill="#2563eb" stroke="white" stroke-width="2" style="position: absolute; top: 0; left: 0; transform: rotate(${angle}deg); transform-origin: center; transition: transform 0.1s linear; width: 28px; height: 28px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)); z-index: 1000;"><path d="M12 2L22 20L12 17L2 20L12 2Z"/></svg>`;
      let speedDisplay = speed !== null && speed > 0 ? 'block' : 'none';
      let speedVal = speed !== null ? Math.round(speed) : 0;
      const speedBadge = `<div class="car-speed-badge" style="position: absolute; bottom: 32px; left: 50%; transform: translateX(-50%); background: #10b981; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold; border: 1px solid white; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.3); z-index: 1001; display: ${speedDisplay}; transition: all 0.2s;">${speedVal} km/h</div>`;
      return L.divIcon({ className: '', html: `<div style="position: relative; width: 28px; height: 28px;">${arrowSvg}${speedBadge}</div>`, iconSize: [28, 28], iconAnchor: [14, 14] });
  }

  checkAndShowSmartSuggestion(soc, heading) {
      const suggestCard = this.querySelector('#vf-smart-suggestion');
      if (!suggestCard || !this._currentStations || this._currentStations.length === 0) return;
      if (soc > 30 || heading === null) { suggestCard.style.display = 'none'; return; }
      
      const modelState = this._hass && this._entityPrefix ? this._hass.states[`sensor.${this._entityPrefix}_ten_dong_xe`] : null;
      const carModel = modelState ? (modelState.state || "").toUpperCase() : "";

      let validStations = this._currentStations;
      if (carModel.includes("VF3") || carModel.includes("VF 3")) {
          validStations = validStations.filter(st => st.power >= 20); 
      }

      let bestStation = null;
      for (let st of validStations) {
          if (st.avail > 0 && st.dist < 20) {
              let stationBearing = this.getBearing(this._lastLat, this._lastLon, st.lat, st.lng);
              let diff = Math.abs(stationBearing - heading);
              if (diff > 180) diff = 360 - diff;
              if (diff < 45 || st.dist < 3.0) {
                  if (!bestStation || st.dist < bestStation.dist) bestStation = st;
              }
          }
      }
      
      if (bestStation) {
          this.querySelector('#vf-suggest-name').innerText = bestStation.name;
          let exactDist = bestStation.dist;
          if (this._lastLat && this._lastLon && this._map) {
              let distMeters = this._map.distance([this._lastLat, this._lastLon], [bestStation.lat, bestStation.lng]);
              exactDist = (distMeters / 1000).toFixed(1);
          }

          this.querySelector('#vf-suggest-dist').innerText = exactDist;
          this.querySelector('#vf-suggest-power').innerText = bestStation.power;
          this.querySelector('#vf-suggest-avail').innerText = `${bestStation.avail}/${bestStation.total}`;
          const mapDomain = 'https://www.google.com/maps/dir/?api=1';
          const navUrl = `${mapDomain}&origin=${this._lastLat},${this._lastLon}&destination=${bestStation.lat},${bestStation.lng}&travelmode=driving`;
          const btnNav = this.querySelector('#btn-suggest-nav');
          if (btnNav) btnNav.onclick = () => window.open(navUrl, '_blank');
          suggestCard.style.display = 'block';
      } else {
          suggestCard.style.display = 'none';
      }
  }

  renderStations() {
      if (!this._stationLayer || !this._map || typeof L === 'undefined') return;
      this._stationLayer.clearLayers();
      if (!Array.isArray(this._currentStations)) return;

      const modelState = this._hass && this._entityPrefix ? this._hass.states[`sensor.${this._entityPrefix}_ten_dong_xe`] : null;
      const carModel = modelState ? (modelState.state || "").toUpperCase() : "";

      let validStations = this._currentStations;
      if (carModel.includes("VF3") || carModel.includes("VF 3")) {
          validStations = validStations.filter(st => st.power >= 20); 
      }

      validStations.forEach(st => {
          const isDC = st.power >= 20;
          if (this._stationFilter === 'DC' && !isDC) return;
          if (this._stationFilter === 'AC' && isDC) return;

          if (st.lat && st.lng) {
              let exactDist = st.dist; 
              if (this._lastLat && this._lastLon) {
                  let distMeters = this._map.distance([this._lastLat, this._lastLon], [st.lat, st.lng]);
                  exactDist = (distMeters / 1000).toFixed(1); 
              }

              let ratio = st.total > 0 ? (st.avail / st.total) * 100 : 0;
              let pinColor = '', statusText = '';
              if (st.total === 0 || st.avail === 0) { pinColor = '#dc2626'; statusText = 'Full'; }
              else if (ratio < 30) { pinColor = '#f97316'; statusText = 'Almost Full'; }
              else if (ratio < 50) { pinColor = '#eab308'; statusText = 'Busy'; }
              else if (ratio < 80) { pinColor = '#0ea5e9'; statusText = 'Available'; }
              else { pinColor = '#16a34a'; statusText = 'Empty'; }

              let boltCount = st.power >= 120 ? 3 : (st.power >= 20 ? 2 : 1);
              let boltsHtml = Array(boltCount).fill(`<ha-icon icon="mdi:flash" style="--mdc-icon-size: 16px; margin: 0 -2px;"></ha-icon>`).join('');
              const pinWidth = boltCount === 1 ? 30 : (boltCount === 2 ? 42 : 54);

              const stationIcon = L.divIcon({ 
                  className: 'custom-station-marker', 
                  html: `<div style="background-color: ${pinColor}; border: 2px solid white; border-radius: 14px; padding: 2px; display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 3px 6px rgba(0,0,0,0.3); height: 26px; width: ${pinWidth}px;">${boltsHtml}</div>`, 
                  iconSize: [pinWidth, 26], iconAnchor: [pinWidth / 2, 13] 
              });

              const mapDomain = 'https://www.google.com/maps/dir/?api=1';
              let originParam = (this._lastLat && this._lastLon) ? `&origin=${this._lastLat},${this._lastLon}` : '';
              const navUrl = `${mapDomain}${originParam}&destination=${st.lat},${st.lng}&travelmode=driving`;

              const popupContent = `
                  <div style="font-family:sans-serif; min-width: 170px;">
                      <b style="font-size: 13px; color: #1e3a8a;">${st.name}</b><br>
                      <div style="margin-top: 6px; font-size: 12px;">
                          🚗 Distance: <b style="color: #ef4444;">${exactDist} km</b><br>
                          ⚡ Power: <b>${st.power} kW</b><br>
                          🔌 Available: <b style="color:${pinColor}; font-size:14px;">${st.avail} / ${st.total}</b>
                      </div>
                      <a href="${navUrl}" target="_blank" style="display: flex; align-items: center; justify-content: center; gap: 4px; margin-top: 10px; background: #2563eb; color: white; padding: 8px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 12px; transition: background 0.2s;">
                          Directions
                      </a>
                  </div>
              `;
              L.marker([st.lat, st.lng], {icon: stationIcon}).bindPopup(popupContent).addTo(this._stationLayer);
          }
      });
  }

  initMap() {
    const mapEl = this.querySelector('#vf-map-canvas');
    if (!mapEl || typeof L === 'undefined' || this._map) return;
    
    this._map = L.map(mapEl, { zoomControl: false });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(this._map);
    this._marker = L.marker([0, 0], {icon: this.getCarIcon(0, 0), opacity: 0}).addTo(this._map);
    
    this._polyline = L.polyline([], { color: '#2563eb', weight: 6, opacity: 0.85, lineCap: 'round', lineJoin: 'round', smoothFactor: 2.5 }).addTo(this._map);
    this._stationLayer = L.layerGroup().addTo(this._map);
    
    new IntersectionObserver((entries) => { 
        if (entries[0].isIntersecting && this._map) setTimeout(() => this._map.invalidateSize(), 100); 
    }).observe(mapEl);
  }

  set hass(hass) {
    this._hass = hass;

    if (!this._entityPrefix) {
        for (let key in hass.states) {
            if (key.startsWith('sensor.') && (key.endsWith('_operating_status') || (key.endsWith('_operating_status') || key.endsWith('_trang_thai_hoat_dong')))) {
                this._entityPrefix = key.replace('sensor.', '').replace('_operating_status', '').replace('_trang_thai_hoat_dong', '');
                break;
            }
        }
    }
    const p = this._entityPrefix;
    if (!p) return; 
    
    const vinStr = p.includes('_') ? p.split('_')[1] : p;

    const SLUG_ALIASES = {
        'operating_status': ['operating_status', 'trang_thai_hoat_dong'],
        'trang_thai_hoat_dong': ['operating_status', 'trang_thai_hoat_dong'],
        'battery_percentage': ['battery_percentage', 'phan_tram_pin'],
        'phan_tram_pin': ['battery_percentage', 'phan_tram_pin'],
        'estimated_range': ['estimated_range', 'quang_duong_du_kien'],
        'quang_duong_du_kien': ['estimated_range', 'quang_duong_du_kien'],
        'gear_position': ['gear_position', 'vi_tri_can_so'],
        'vi_tri_can_so': ['gear_position', 'vi_tri_can_so'],
        'current_speed': ['current_speed', 'toc_do_hien_tai'],
        'toc_do_hien_tai': ['current_speed', 'toc_do_hien_tai'],
        'total_odometer': ['total_odometer', 'tong_odo', 'tong_odo_mqtt'],
        'tong_odo': ['total_odometer', 'tong_odo', 'tong_odo_mqtt'],
        'driver_door': ['driver_door', 'cua_tai_xe'],
        'passenger_door': ['passenger_door', 'cua_phu'],
        'rear_driver_door': ['rear_driver_door', 'cua_sau_tai_xe', 'cua_sau_trai'],
        'rear_passenger_door': ['rear_passenger_door', 'cua_sau_phu', 'cua_sau_phai'],
        'driver_window': ['driver_window', 'kinh_tai_xe', 'cua_so_tai_xe'],
        'passenger_window': ['passenger_window', 'kinh_phu', 'cua_so_phu'],
        'trunk': ['trunk', 'cop_sau'],
        'hood': ['hood', 'nap_capo'],
        'central_lock': ['central_lock', 'khoa_tong'],
        'khoa_tong': ['central_lock', 'khoa_tong'],
        'tire_pressure_front_left': ['tire_pressure_front_left', 'ap_suat_lop_truoc_trai'],
        'ap_suat_lop_truoc_trai': ['tire_pressure_front_left', 'ap_suat_lop_truoc_trai'],
        'tire_pressure_front_right': ['tire_pressure_front_right', 'ap_suat_lop_truoc_phai'],
        'ap_suat_lop_truoc_phai': ['tire_pressure_front_right', 'ap_suat_lop_truoc_phai'],
        'tire_pressure_rear_left': ['tire_pressure_rear_left', 'ap_suat_lop_sau_trai'],
        'ap_suat_lop_sau_trai': ['tire_pressure_rear_left', 'ap_suat_lop_sau_trai'],
        'tire_pressure_rear_right': ['tire_pressure_rear_right', 'ap_suat_lop_sau_phai'],
        'ap_suat_lop_sau_phai': ['tire_pressure_rear_right', 'ap_suat_lop_sau_phai'],
        'vehicle_location_address': ['vehicle_location_address', 'vi_tri_xe_dia_chi'],
        'trip_distance': ['trip_distance', 'quang_duong_chuyen_di_trip'],
        'trip_energy_consumption': ['trip_energy_consumption', 'dien_nang_tieu_thu_trip'],
        'trip_consumption_efficiency': ['trip_consumption_efficiency', 'hieu_suat_tieu_thu_trip'],
        'design_battery_capacity': ['design_battery_capacity', 'dung_luong_pin_thiet_ke'],
        'announced_range_max': ['announced_range_max', 'quang_duong_cong_bo_max'],
        'ev_ai_advisor': ['ev_ai_advisor', 'co_van_xe_dien_ai'],
        'co_van_xe_dien_ai': ['ev_ai_advisor', 'co_van_xe_dien_ai'],
        '12v_battery': ['12v_battery', 'pin_12v_ac_quy', 'pin_12v'],
        'pin_12v_ac_quy': ['12v_battery', 'pin_12v_ac_quy', 'pin_12v'],
        'security_status': ['security_status', 'trang_thai_an_ninh'],
        'trang_thai_an_ninh': ['security_status', 'trang_thai_an_ninh'],
        'hazard_warning_lights': ['hazard_warning_lights', 'den_nhay_canh_bao'],
        'den_nhay_canh_bao': ['hazard_warning_lights', 'den_nhay_canh_bao'],
        'climate_control_status': ['climate_control_status', 'trang_thai_dieu_hoa'],
        'trang_thai_dieu_hoa': ['climate_control_status', 'trang_thai_dieu_hoa'],
        'camp_mode': ['camp_mode', 'che_do_cam_trai_camp'],
        'che_do_cam_trai_camp': ['camp_mode', 'che_do_cam_trai_camp'],
        'pet_mode': ['pet_mode', 'che_do_thu_cung_pet'],
        'che_do_thu_cung_pet': ['pet_mode', 'che_do_thu_cung_pet'],
        'valet_mode': ['valet_mode', 'che_do_giao_xe_valet'],
        'che_do_giao_xe_valet': ['valet_mode', 'che_do_giao_xe_valet'],
        'charge_target': ['charge_target', 'muc_tieu_sac_target'],
        'muc_tieu_sac_target': ['charge_target', 'muc_tieu_sac_target'],
        'remaining_charge_time': ['remaining_charge_time', 'thoi_gian_sac_con_lai'],
        'thoi_gian_sac_con_lai': ['remaining_charge_time', 'thoi_gian_sac_con_lai'],
        'live_calculated_charging_power': ['live_calculated_charging_power', 'cong_suat_sac_tinh_toan_live', 'cong_suat_sac_trung_binh_lan_cuoi', 'cong_suat_sac_tram', 'cong_suat_sac'],
        'cong_suat_sac_tinh_toan_live': ['live_calculated_charging_power', 'cong_suat_sac_tinh_toan_live', 'cong_suat_sac_trung_binh_lan_cuoi', 'cong_suat_sac_tram', 'cong_suat_sac'],
        'total_charging_sessions': ['total_charging_sessions', 'tong_so_lan_sac'],
        'tong_so_lan_sac': ['total_charging_sessions', 'tong_so_lan_sac'],
        'public_station_charging_sessions': ['public_station_charging_sessions', 'so_lan_sac_tai_tram'],
        'so_lan_sac_tai_tram': ['public_station_charging_sessions', 'so_lan_sac_tai_tram'],
        'home_charging_sessions': ['home_charging_sessions', 'so_lan_sac_tai_nha'],
        'so_lan_sac_tai_nha': ['home_charging_sessions', 'so_lan_sac_tai_nha'],
        'home_charging_energy': ['home_charging_energy', 'dien_nang_sac_tai_nha'],
        'dien_nang_sac_tai_nha': ['home_charging_energy', 'dien_nang_sac_tai_nha'],
        'total_energy_charged': ['total_energy_charged', 'tong_dien_nang_da_sac'],
        'tong_dien_nang_da_sac': ['total_energy_charged', 'tong_dien_nang_da_sac'],
        'estimated_total_charging_cost': ['estimated_total_charging_cost', 'tong_chi_phi_sac_quy_doi'],
        'tong_chi_phi_sac_quy_doi': ['estimated_total_charging_cost', 'tong_chi_phi_sac_quy_doi'],
        'realistic_full_range_100_battery': ['realistic_full_range_100_battery', 'quang_duong_thuc_te_day_100_pin'],
        'remaining_range_by_efficiency': ['remaining_range_by_efficiency', 'quang_duong_con_lai_theo_hieu_suat'],
        'quang_duong_con_lai_theo_hieu_suat': ['remaining_range_by_efficiency', 'quang_duong_con_lai_theo_hieu_suat'],
        'distance_per_1_battery': ['distance_per_1_battery', 'quang_duong_di_duoc_moi_1_pin'],
        'quang_duong_di_duoc_moi_1_pin': ['distance_per_1_battery', 'quang_duong_di_duoc_moi_1_pin'],
        'average_consumption_efficiency': ['average_consumption_efficiency', 'hieu_suat_tieu_thu_trung_binh_xe'],
        'hieu_suat_tieu_thu_trung_binh_xe': ['average_consumption_efficiency', 'hieu_suat_tieu_thu_trung_binh_xe'],
        'vehicle_model': ['vehicle_model', 'ten_dong_xe'],
        'ten_dong_xe': ['vehicle_model', 'ten_dong_xe'],
        'vehicle_identifier_name': ['vehicle_identifier_name', 'ten_dinh_danh_xe'],
        'ten_dinh_danh_xe': ['vehicle_identifier_name', 'ten_dinh_danh_xe'],
        'license_plate_secondary_name': ['license_plate_secondary_name', 'bien_so_ten_xe_phu'],
        'bien_so_ten_xe_phu': ['license_plate_secondary_name', 'bien_so_ten_xe_phu'],
        'current_weather': ['current_weather', 'thoi_tiet_hien_tai'],
        'thoi_tiet_hien_tai': ['current_weather', 'thoi_tiet_hien_tai'],
        'outside_temperature': ['outside_temperature', 'nhiet_do_ngoai_troi_gps', 'nhiet_do_ngoai_troi'],
        'nhiet_do_ngoai_troi_gps': ['outside_temperature', 'nhiet_do_ngoai_troi_gps', 'nhiet_do_ngoai_troi'],
        'vehicle_image_url': ['vehicle_image_url', 'hinh_anh_xe_url'],
        'hinh_anh_xe_url': ['vehicle_image_url', 'hinh_anh_xe_url'],
        'phanh_tay': ['electronic_parking_brake', 'phanh_tay', 'phanh_tay_dien_tu'],
        'phanh_tay_dien_tu': ['electronic_parking_brake', 'phanh_tay', 'phanh_tay_dien_tu'],
        'dung_luong_pin_thiet_ke': ['design_battery_capacity', 'dung_luong_pin_thiet_ke'],
        'quang_duong_cong_bo_max': ['announced_range_max', 'quang_duong_cong_bo_max'],
        'hieu_suat_tieu_thu_trip': ['trip_consumption_efficiency', 'hieu_suat_tieu_thu_trip'],
        'quang_duong_chuyen_di_trip': ['trip_distance', 'quang_duong_chuyen_di_trip'],
        'dien_nang_tieu_thu_trip': ['trip_energy_consumption', 'dien_nang_tieu_thu_trip'],
        'kha_nang_chai_pin_theo_range_tham_khao': ['estimated_range_degradation_reference', 'kha_nang_chai_pin_theo_range_tham_khao']
    };

    const getValidState = (suffix) => {
        const candidates = SLUG_ALIASES[suffix] || [suffix];
        for (const c of candidates) {
            const s = hass.states[`sensor.${p}_${c}`];
            if (s && s.state !== 'unavailable' && s.state !== 'unknown' && s.state !== '') {
                return s.state;
            }
        }
        return null;
    };
    
    const getAttr = (suffix, attrKey) => {
        const s = hass.states[`sensor.${p}_${suffix}`];
        return (s && s.attributes && s.attributes[attrKey]) ? s.attributes[attrKey] : null;
    };

    const formatTimeSince = (dateString) => {
        if (!dateString) return "";
        const s = Math.floor((new Date() - new Date(dateString)) / 1000);
        if (s < 60) return "just now";
        const m = Math.floor(s / 60); if (m < 60) return `${m} mins ago`;
        const h = Math.floor(m / 60); if (h < 24) return `${h} hours ago`;
        return `${Math.floor(h / 24)} days ago`;
    };

    if (!this.content) {
      this.loadLeaflet();
      this.fetchTripHistory(vinStr);
      this.fetchChargeHistory(vinStr); 
      
      this.innerHTML = `
        <ha-card class="vf-card">
          <div class="vf-card-container">
            <div class="vf-header">
              <div class="vf-title">
                <svg viewBox="0 0 512 512" fill="currentColor"><path d="M560 3586 c-132 -28 -185 -75 -359 -321 -208 -291 -201 -268 -201 -701 0 -361 3 -383 69 -470 58 -77 133 -109 311 -134 202 -29 185 -21 199 -84 14 -62 66 -155 119 -209 110 -113 277 -165 430 -133 141 29 269 125 328 246 l29 59 1115 0 1115 0 29 -59 c60 -123 201 -226 345 -250 253 -43 499 137 543 397 34 203 -77 409 -268 500 -69 33 -89 38 -172 41 -116 5 -198 -15 -280 -67 -116 -76 -195 -193 -214 -321 -6 -36 -12 -71 -14 -77 -5 -19 -2163 -19 -2168 0 -2 6 -8 41 -14 77 -19 128 -98 245 -214 321 -82 52 -164 72 -280 67 -82 -3 -103 -8 -168 -40 -41 -19 -94 -52 -117 -72 -55 -48 -115 -139 -137 -209 -21 -68 -13 -66 -196 -37 -69 11 -128 20 -132 20 -17 0 -82 67 -94 97 -10 23 -14 86 -14 228 l0 195 60 0 c48 0 63 4 80 22 24 26 58 10 88 -12 22 -61 40 -111 40 l-39 0 0 43 c1 23 9 65 18 93 20 58 264 406 317 453 43 37 120 61 198 61 52 0 58 -2 53 -17 -4 -10 -48 -89 -98 -177 -70 -122 -92 -170 -95 -205 -5 -56 19 -106 67 -138 l33 -23 1511 0 c867 0 1583 -4 1680 -10 308 -18 581 -60 788 -121 109 -32 268 -103 268 -119 0 -6 -27 -10 -60 -10 -68 0 -100 -21 -100 -66 0 -63 40 -84 161 -84 l79 0 0 -214 c0 -200 -1 -215 -20 -239 -13 -16 -35 -29 -58 -33 -88 -16 -113 -102 -41 -140 81 -41 228 49 259 160 8 29 11 119 8 292 l-3 249 -32 67 c-45 96 -101 152 -197 197 -235 112 -604 187 -1027 209 l-156 9 -319 203 c-176 112 -359 223 -409 246 -116 56 -239 91 -366 104 -149 15 -1977 12 -2049 -4z m800 -341 l0 -205 -335 0 -336 0 12 23 c7 12 59 104 116 205 l105 182 219 0 219 0 0 -205z m842 15 c14 -102 27 -193 27 -202 1 -17 -23 -18 -359 -18 l-360 0 0 198 c0 109 3 202 7 205 4 4 153 6 332 5 l326 -3 27 -185z m528 157 c52 -14 125 -38 161 -55 54 -24 351 -206 489 -299 l35 -23 -516 0 -516 0 -26 188 c-15 103 -27 196 -27 206 0 18 7 19 153 13 112 -5 177 -12 247 -30z m-1541 -1132 c115 -63 176 -174 169 -305 -16 -272 -334 -402 -541 -221 -20 18 -51 63 -69 99 -28 57 -33 77 -33 142 0 65 5 85 33 142 37 76 93 128 169 159 75 30 200 23 272 -16z m3091 16 c110 -42 192 -149 207 -269 18 -159 -101 -319 -264 -352 -134 -28 -285 47 -350 174 -37 72 -43 180 -14 257 35 91 107 162 200 195 55 20 162 17 221 -5z"></path></svg>
                <span id="vf-name">Loading...</span>
              </div>
              <div class="vf-odo"><div class="vf-odo-label">ODOMETER</div><div class="vf-odo-value"><span id="vf-odo-int"></span> <span class="vf-odo-unit">km</span></div></div>
            </div>

            <div class="vf-car-stage" id="vf-car-stage">
              <div id="vf-status-badge" class="vf-status-badge"></div>
              <img id="vf-car-img" src="" alt="VinFast Car" onerror="this.src='https://shop.vinfastauto.com/on/demandware.static/-/Sites-app_vinfast_vn-Library/default/dw15d3dc68/images/PDP/vf9/M/M.png'">
              <div class="vf-tire vf-tire-fl" id="tire-fl" style="display:none;"><ha-icon icon="mdi:tire"></ha-icon><br><span></span> <span class="tire-unit">bar</span></div>
              <div class="vf-tire vf-tire-fr" id="tire-fr" style="display:none;"><ha-icon icon="mdi:tire"></ha-icon><br><span></span> <span class="tire-unit">bar</span></div>
              <div class="vf-tire vf-tire-rl" id="tire-rl" style="display:none;"><ha-icon icon="mdi:tire"></ha-icon><br><span></span> <span class="tire-unit">bar</span></div>
              <div class="vf-tire vf-tire-rr" id="tire-rr" style="display:none;"><ha-icon icon="mdi:tire"></ha-icon><br><span></span> <span class="tire-unit">bar</span></div>
            </div>

            <div class="vf-controls-area">
              <div class="vf-gears"><span class="gear" id="gear-P">P</span><span class="gear" id="gear-R">R</span><span class="gear" id="gear-N">N</span><span class="gear" id="gear-D">D</span></div>
              <div class="vf-speed" id="vf-speed-container"><span id="vf-speed"></span><span class="vf-speed-unit">km/h</span></div>
            </div>
            
            <div class="vf-doors-status" id="vf-doors-container"></div>
            
            <div class="vf-charging-banner" id="vf-charging-banner" style="display: none;">
                <div class="charging-left">
                    <div class="charging-title"><ha-icon icon="mdi:ev-plug-type2"></ha-icon><span id="vf-charge-status-text">Charging System Active</span></div>
                    <div class="charging-details">Limit: <span id="vf-charge-limit" style="font-weight:bold; margin-left:4px;">--%</span><span style="margin:0 8px;opacity:0.5;">|</span>Power: <span id="vf-charge-power" style="font-weight:bold; margin-left:4px;">-- kW</span></div>
                </div>
                <div class="charging-right">
                    <span id="vf-charge-time" class="charging-time">--</span>
                    <div class="charging-time-label"><span>mins</span><span>remaining</span></div>
                </div>
            </div>

            <div class="vf-remote-bar" id="vf-remote-controls">
                <div class="remote-btn" id="btn-rc-lock" title="Lock Doors"><ha-icon icon="mdi:lock"></ha-icon></div>
                <div class="remote-btn" id="btn-rc-unlock" title="Unlock Doors"><ha-icon icon="mdi:lock-open"></ha-icon></div>
                <div class="remote-btn" id="btn-rc-horn" title="Honk Horn"><ha-icon icon="mdi:bullhorn"></ha-icon></div>
                <div class="remote-btn" id="btn-rc-lights" title="Flash Headlights"><ha-icon icon="mdi:car-light-high"></ha-icon></div>
            </div>

            <div class="vf-stats-grid">
              
              <div class="stat-box clickable" id="box-batt-range">
                <div class="box-main">
                  <ha-icon id="icon-batt-range" icon="mdi:battery-charging-60" style="color: #10b981;"></ha-icon>
                  <div class="stat-info"><div class="stat-label" id="lbl-batt-range">BATTERY</div><div class="stat-val" id="vf-stat-batt-range">--</div></div>
                </div>
              </div>
              
              <div class="stat-box clickable" id="box-sensors">
                <div class="box-main">
                  <ha-icon icon="mdi:car-cog" style="color: #8b5cf6;"></ha-icon>
                  <div class="stat-info"><div class="stat-label">SENSORS</div><div class="stat-val" id="vf-stat-sensors" style="font-size: 13px;">--</div></div>
                </div>
              </div>

              <div class="stat-detail-container" id="detail-container-1">
                  <div class="stat-detail-content" id="detail-batt-range">
                      <div class="detail-row"><span>Battery Health (SOH):</span> <b id="dt-soh" style="color:#10b981;">--</b></div>
                      <div class="detail-row"><span>Last Charge Efficiency:</span> <b id="dt-charge-eff" style="color:#f59e0b;">--</b></div>
                      <div class="detail-row"><span>Realistic Full Range (100%):</span> <b id="dt-range-ai" style="color:#3b82f6;">--</b></div>
                      <div class="detail-row" style="border-bottom:none; padding-bottom:0;">
                          <div style="display:flex; flex-direction:column; gap:8px; width:100%; margin-top:5px;">
                              <div style="display:flex; justify-content:space-between; align-items:center; background:var(--primary-background-color, white); padding:8px 12px; border-radius:8px; border:1px solid var(--divider-color, #e2e8f0);">
                                  <div style="display:flex; align-items:center; gap:6px; color:var(--secondary-text-color, #475569);"><ha-icon icon="mdi:leaf-off" style="color:#ef4444; --mdc-icon-size:16px;"></ha-icon>Estimated Degradation:</div>
                                  <b id="dt-range-drop-trip" style="font-size:13px; color:#ef4444;">--</b>
                              </div>
                              <div style="display:flex; gap:6px;">
                                  <div style="flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center; background:var(--primary-background-color, white); padding:6px; border-radius:8px; border:1px solid var(--divider-color, #e2e8f0);">
                                      <div style="font-size:10px; color:var(--secondary-text-color, #475569);">PLUGGED IN AT</div>
                                      <b id="dt-charge-soc-start" style="font-size:13px; color:#3b82f6;">--%</b>
                                  </div>
                                  <div style="flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center; background:var(--primary-background-color, white); padding:6px; border-radius:8px; border:1px solid var(--divider-color, #e2e8f0);">
                                      <div style="font-size:10px; color:var(--secondary-text-color, #475569);">UNPLUGGED AT</div>
                                      <b id="dt-charge-soc-end" style="font-size:13px; color:#10b981;">--%</b>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>
                  
                  <div class="stat-detail-content" id="detail-sensors" style="padding:10px;">
                      <div id="sensor-list-container" style="max-height: 180px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px;">
                      </div>
                  </div>
              </div>

              <div class="stat-box clickable" id="box-eff">
                <div class="box-main">
                  <ha-icon icon="mdi:leaf" style="color: #10b981;"></ha-icon>
                  <div class="stat-info"><div class="stat-label" id="lbl-eff">AVG EFFICIENCY</div><div class="stat-val" id="vf-stat-eff">--</div></div>
                </div>
              </div>
              <div class="stat-box clickable" id="box-speed">
                <div class="box-main">
                  <ha-icon icon="mdi:chart-bell-curve" style="color: #eab308;"></ha-icon>
                  <div class="stat-info"><div class="stat-label">OPTIMAL SPEED</div><div class="stat-val" id="vf-stat-speed">--</div></div>
                </div>
              </div>

              <div class="stat-detail-container" id="detail-container-2">
                  <div class="stat-detail-content" id="detail-eff">
                      <div class="detail-row"><span>Lifetime Energy:</span> <b id="dt-total-kwh" style="color:#f59e0b;">--</b></div>
                      <div class="detail-row"><span>Total Charge Cost:</span> <b id="dt-total-cost">--</b></div>
                  </div>
                  <div class="stat-detail-content" id="detail-speed">
                      <div style="font-size:10px; color:var(--secondary-text-color, #64748b); margin-bottom:6px;">Speed band breakdown:</div>
                      <div id="dt-speed-chart" style="display:flex; flex-direction:column; gap:4px;">Not enough AI data</div>
                  </div>
              </div>

              <div class="stat-box clickable" id="box-trip">
                <div class="box-main">
                  <ha-icon icon="mdi:map-marker-path" style="color: #8b5cf6;"></ha-icon>
                  <div class="stat-info"><div class="stat-label">CURRENT TRIP</div><div class="stat-val" id="vf-stat-trip">--</div></div>
                </div>
              </div>
              
              <div class="stat-box clickable" id="box-charge">
                <div class="box-main">
                  <ha-icon icon="mdi:ev-station" style="color: #f59e0b;"></ha-icon>
                  <div class="stat-info"><div class="stat-label">CHARGE SESSIONS</div><div class="stat-val" id="vf-stat-charge-count">--</div></div>
                </div>
              </div>

              <div class="stat-detail-container" id="detail-container-3">
                  <div class="stat-detail-content" id="detail-trip">
                      <div class="detail-row"><span>Average Speed:</span> <b id="dt-trip-avg-speed">--</b></div>
                      <div class="detail-row"><span>Trip Energy:</span> <b id="dt-trip-energy" style="color:#eab308;">--</b></div>
                  </div>
                  <div class="stat-detail-content" id="detail-charge" style="padding:0; overflow:hidden;">
                      <div style="padding:15px; border-bottom:1px solid var(--divider-color, #e2e8f0); display:flex; gap:10px; background:var(--secondary-background-color, #f8fafc);">
                          <div style="flex:1; background:var(--primary-background-color, white); padding:10px; border-radius:8px; border:1px solid var(--divider-color, #e2e8f0); text-align:center;">
                              <div style="font-size:10px; color:var(--secondary-text-color, #64748b); font-weight:bold;">STATION</div>
                              <div style="font-size:18px; font-weight:900; color:#2563eb;" id="inline-pub-sessions">--</div>
                          </div>
                          <div style="flex:1; background:var(--primary-background-color, white); padding:10px; border-radius:8px; border:1px solid var(--divider-color, #e2e8f0); text-align:center;">
                              <div style="font-size:10px; color:var(--secondary-text-color, #64748b); font-weight:bold;">HOME</div>
                              <div style="font-size:18px; font-weight:900; color:#10b981;"><span id="inline-home-sessions">--</span><span style="font-size:11px; font-weight:normal; color:var(--secondary-text-color, #64748b);"> sessions</span></div>
                              <div style="font-size:10px; color:#10b981; font-weight:bold; margin-top:2px;"><span id="inline-home-kwh">--</span> kWh</div>
                          </div>
                      </div>
                      <div style="padding:10px 15px; font-size:11px; font-weight:bold; color:var(--secondary-text-color, #94a3b8); text-transform:uppercase; background:var(--primary-background-color, white);">Latest Charge Session</div>
                      <div id="vf-inline-charge-list" style="max-height: 200px; overflow-y: auto; background:var(--primary-background-color, white); padding:0 15px 10px 15px;"></div>
                  </div>
              </div>
            </div> 
            
            <div id="vf-ai-advisor-container" style="display: none; background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); border-radius: 16px; padding: 15px; margin-bottom: 15px; color: white; box-shadow: 0 4px 15px rgba(37,99,235,0.2); transition: all 0.3s ease;">
                <div id="vf-ai-header" style="display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
                    <div style="display: flex; align-items: center; gap: 8px; font-weight: bold; font-size: 14px;">
                        <ha-icon icon="mdi:robot-outline" style="color: #60a5fa;"></ha-icon>
                        EV AI Advisor Review
                    </div>
                    <ha-icon id="vf-ai-chevron" icon="mdi:chevron-up" style="transition: transform 0.3s ease;"></ha-icon>
                </div>
                <div id="vf-ai-content" style="max-height: 200px; margin-top: 8px; overflow: hidden; transition: all 0.3s ease;">
                    <div id="vf-ai-text" style="font-size: 12px; line-height: 1.5; color: #e2e8f0; font-style: italic;">
                        Waiting for trip analysis...
                    </div>
                </div>
            </div>

            <div id="vf-smart-suggestion" style="display:none; position:absolute; bottom:60px; left:50%; transform:translateX(-50%); background:var(--card-background-color, rgba(255,255,255,0.95)); backdrop-filter:blur(10px); padding:12px; border-radius:16px; box-shadow:0 10px 25px rgba(0,0,0,0.2); width:85%; z-index:1000; border:2px solid #f59e0b;">
               <div style="font-size:11px; color:#f59e0b; font-weight:800; margin-bottom:4px; display:flex; align-items:center; gap:4px;"><ha-icon icon="mdi:alert" style="--mdc-icon-size:14px;"></ha-icon> LOW BATTERY - CHARGER SUGGESTION EN ROUTE</div>
               <div id="vf-suggest-name" style="font-size:14px; font-weight:bold; color:var(--primary-text-color, #1e3a8a); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">--</div>
               <div style="font-size:12px; color:var(--secondary-text-color, #475569); margin-top:2px;">Ahead <b id="vf-suggest-dist">--</b> km • <b id="vf-suggest-power">--</b> kW • Available: <b id="vf-suggest-avail" style="color:#16a34a;">--</b></div>
               <button id="btn-suggest-nav" style="margin-top:8px; width:100%; background:#2563eb; color:white; border:none; border-radius:8px; padding:6px; font-weight:bold; cursor:pointer;">Navigate Now</button>
            </div>

            <div class="vf-map-container" style="position:relative; border-radius:16px; overflow:hidden; margin-top:10px; border:1px solid var(--divider-color, #e5e7eb); display:flex; flex-direction:column;">
              <div style="position:absolute; top:12px; left:12px; z-index:400; width: 70%; max-width: 300px;">
                  <select id="trip-selector" style="width:100%; background:var(--card-background-color, rgba(255,255,255,0.95)); backdrop-filter:blur(4px); border:2px solid #2563eb; border-radius:8px; padding:8px; font-size:12px; font-weight:bold; color:var(--primary-text-color, #1e3a8a); cursor:pointer;"><option value="current">Loading...</option></select>
              </div>
              <div id="vf-map-canvas" style="width:100%; height:350px; background:var(--secondary-background-color, #e5e7eb); z-index:1;"></div>
              
              <style>
                .leaflet-control-attribution { display: none !important; }
              </style>
              
              <div class="vf-address-bar" id="vf-address-container"><ha-icon icon="mdi:map-marker-radius"></ha-icon><span id="vf-current-address" style="color:var(--primary-text-color, #475569);">Loading data...</span></div>
              <div class="map-controls">
                <button class="map-btn" id="btn-locate"><ha-icon icon="mdi:crosshairs-gps"></ha-icon></button>
                <div style="height:1px;background:var(--divider-color, #ccc);margin:4px 0;"></div>
                <button class="map-btn" id="btn-stations"><ha-icon icon="mdi:ev-station" style="color:#2563eb;"></ha-icon></button>
                <button class="map-btn" id="btn-filter-station" style="font-weight:900; font-size:11px; color:#f59e0b;">ALL</button>
                <div style="height:1px;background:var(--divider-color, #ccc);margin:4px 0;"></div>
                <button class="map-btn" id="btn-replay"><ha-icon id="icon-replay" icon="mdi:play-circle" style="color:#2563eb;"></ha-icon></button>
              </div>
            </div>

          </div>
        </ha-card>
      `;

      const style = document.createElement('style');
      style.textContent = `
        @import url('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
        .vf-card { isolation: isolate; border-radius: 24px; overflow: hidden; background: var(--card-background-color, #ffffff); box-shadow: 0 4px 20px rgba(0,0,0,0.05); font-family: -apple-system, sans-serif;}
        .vf-card-container { padding: 20px; }
        .vf-header { display: flex; justify-content: space-between; margin-bottom: 10px; }
        .vf-title { display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: 700; color: var(--primary-text-color, #1f2937);} .vf-title svg {width: 24px; color: #2563eb;}
        .vf-odo { text-align: right; } .vf-odo-label {font-size: 10px; font-weight: 800; color: #2563eb;} .vf-odo-value {font-size: 24px; font-weight: 800; color: var(--primary-text-color, #1f2937);}
        .vf-car-stage { position: relative; height: 220px; display: flex; justify-content: center; align-items: center; margin-bottom: 5px; transition: filter 0.3s;}
        .vf-car-stage.low-battery { filter: drop-shadow(0 0 15px rgba(239,68,68,0.3)); }
        .vf-car-stage img { max-width: 90%; max-height: 100%; filter: drop-shadow(0 20px 20px rgba(0,0,0,0.2)); z-index: 1;}
        .vf-status-badge { position: absolute; top: -10px; right: 0; background: #2563eb; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; z-index: 5;}
        .vf-tire { position: absolute; background: var(--card-background-color, rgba(255,255,255,0.85)); backdrop-filter: blur(8px); padding: 4px 8px; border-radius: 12px; border: 1px solid var(--divider-color, #e5e7eb); font-size: 11px; font-weight: 800; color: var(--primary-text-color, #1f2937); text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.05); z-index: 5; }
        .vf-tire ha-icon { --mdc-icon-size: 14px; color: var(--secondary-text-color, #6b7280); } .tire-unit { font-size: 9px; font-weight: 600; color: var(--secondary-text-color, #6b7280); }
        .vf-tire-fl { bottom: 10%; left: 0; } .vf-tire-fr { top: 15%; left: 0; } .vf-tire-rl { bottom: 10%; right: 0; } .vf-tire-rr { top: 15%; right: 0; }
        .vf-controls-area { display: flex; justify-content: center; gap: 16px; margin-bottom: 12px; align-items: center;}
        .vf-gears { display: flex; background: var(--secondary-background-color, rgba(243,244,246,0.8)); padding: 8px 20px; border-radius: 30px; gap: 20px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);}
        .gear { font-size: 16px; font-weight: 800; color: var(--secondary-text-color, #9ca3af); transition: all 0.3s; position: relative;} 
        .gear.active {color: #2563eb; transform: scale(1.2);} .gear.active::after { content: ''; position: absolute; bottom: -4px; left: 50%; transform: translateX(-50%); width: 4px; height: 4px; background: #2563eb; border-radius: 50%; }
        .vf-speed { display: flex; align-items: baseline; background: rgba(37,99,235,0.1); border: 2px solid rgba(37,99,235,0.3); padding: 6px 20px; border-radius: 30px;}
        .vf-speed span:first-child { font-size: 28px; font-weight: 900; color: #2563eb; } .vf-speed-unit { font-size: 11px; font-weight: bold; color: #2563eb; margin-left: 4px;}
        .vf-doors-status { display: flex; gap: 8px; justify-content: center; width: 100%; flex-wrap: wrap; margin-bottom: 15px;}
        .door-badge { display: flex; align-items: center; gap: 4px; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: bold; background: var(--card-background-color, rgba(255,255,255,0.95)); border: 1px solid var(--divider-color, #e5e7eb); box-shadow: 0 2px 6px rgba(0,0,0,0.1); color: var(--primary-text-color, #374151);}
        .door-badge.open { background: rgba(239, 68, 68, 0.1); border-color: #ef4444; color: #ef4444; animation: pulseRed 1.5s infinite; }
        .door-badge.open.warning { background: rgba(245, 158, 11, 0.1); border-color: #f59e0b; color: #f59e0b; animation: pulseOrange 2s infinite; }
        .door-badge ha-icon { --mdc-icon-size: 15px; }
        @keyframes pulseRed { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); } 70% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }
        @keyframes pulseOrange { 0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); } 70% { box-shadow: 0 0 0 6px rgba(245, 158, 11, 0); } 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); } }
        
        .vf-charging-banner { display: flex; align-items: center; justify-content: space-between; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 15px 20px; border-radius: 16px; margin-bottom: 16px; animation: pulseChargeGlow 2.5s infinite; }
        .charging-left { display: flex; flex-direction: column; gap: 4px; }
        .charging-title { font-size: 15px; font-weight: 800; display:flex; align-items:center; gap:8px; line-height: 1.2;}
        .charging-title ha-icon { --mdc-icon-size: 20px; }
        .charging-details { font-size: 12px; display:flex; align-items:center; opacity: 0.9;}
        .charging-right { display: flex; align-items: baseline; gap: 4px; text-align: right;}
        .charging-time { font-size: 28px; font-weight: 900; line-height: 1;}
        .charging-time-label { font-size: 11px; display: flex; flex-direction: column; text-align: left; line-height: 1.2; opacity: 0.9;}
        
        @keyframes pulseChargeGlow { 0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.5); } 70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); } 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); } }
        .vf-remote-bar { display: flex; justify-content: center; gap: 15px; margin-bottom: 20px; padding: 10px; background: var(--secondary-background-color, rgba(243,244,246,0.5)); border-radius: 16px;}
        .remote-btn { display: flex; align-items: center; justify-content: center; width: 45px; height: 45px; background: var(--card-background-color, white); border: 1px solid var(--divider-color, #e5e7eb); border-radius: 50%; color: var(--primary-text-color, #4b5563); cursor: pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.05); transition: all 0.2s ease;}
        .remote-btn ha-icon { --mdc-icon-size: 22px; } .remote-btn:hover { background: rgba(37,99,235,0.1); color: #2563eb; transform: translateY(-2px);}
        
        .vf-stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px; }
        
        .stat-box { display: flex; align-items: center; gap: 8px; background: var(--secondary-background-color, rgba(243, 244, 246, 0.6)); padding: 10px; border-radius: 12px; border: 1px solid var(--divider-color, rgba(229, 231, 235, 0.8)); transition: all 0.2s; cursor: pointer; height: 60px; box-sizing: border-box; }
        .stat-box:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); background: var(--card-background-color, white); }
        .stat-box.active-box { border-color: #2563eb; background: var(--card-background-color, white); box-shadow: 0 4px 12px rgba(37,99,235,0.15); transform: translateY(-2px); }
        
        .box-main { display: flex; align-items: center; gap: 8px; width: 100%; }
        .box-main ha-icon { flex-shrink: 0; --mdc-icon-size: 22px; }
        .stat-info { display: flex; flex-direction: column; min-width: 0; width: 100%; justify-content: center; overflow: hidden; height: 40px; }
        .stat-label { font-size: 10px; font-weight: 700; color: var(--secondary-text-color, #6b7280); text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px; transition: color 0.3s;}
        .stat-val { font-size: 14px; font-weight: 800; color: var(--primary-text-color, #1f2937); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: opacity 0.3s ease-in-out; line-height: 1.2; display: block; }
        .stat-unit { font-size: 0.7em; font-weight: 600; color: var(--secondary-text-color, #6b7280); margin-left: 3px; }
        
        .stat-detail-container { grid-column: 1 / -1; display: none; animation: slideDown 0.2s ease-out; transform-origin: top; margin-top: -5px; }
        .stat-detail-content { background: var(--secondary-background-color, #f8fafc); border-radius: 12px; padding: 15px; border: 1px solid var(--divider-color, #93c5fd); box-shadow: inset 0 2px 4px rgba(0,0,0,0.02); display: none; color: var(--primary-text-color, #1f2937);}
        
        .detail-row { display: flex; justify-content: space-between; font-size: 12px; color: var(--primary-text-color, #475569); padding: 6px 0; border-bottom: 1px dashed var(--divider-color, #e2e8f0); }
        .detail-row:last-child { border-bottom: none; padding-bottom: 0; }
        @keyframes slideDown { from { opacity: 0; transform: scaleY(0.95); } to { opacity: 1; transform: scaleY(1); } }
        
        .vf-address-bar { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 12px; font-size: 13px; font-weight: 600; color: var(--primary-text-color, #475569);}
        .vf-address-bar ha-icon { color: #ef4444; animation: bouncePin 2s infinite;}
        @keyframes bouncePin { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        .map-controls { position: absolute; top: 12px; right: 12px; z-index: 400; display: flex; flex-direction: column; gap: 6px; }
        .map-btn { width: 32px; height: 32px; background: var(--card-background-color, white); border: 1px solid var(--divider-color, rgba(0,0,0,0.1)); border-radius: 6px; cursor: pointer; display:flex; align-items:center; justify-content:center; color: var(--primary-text-color, #1f2937);}
      `;
      this.appendChild(style);
      this.content = true;

      const aiHeader = this.querySelector('#vf-ai-header');
      const aiContent = this.querySelector('#vf-ai-content');
      const aiChevron = this.querySelector('#vf-ai-chevron');

      if (aiHeader) {
          aiHeader.onclick = () => {
              const isCollapsed = aiContent.style.maxHeight === '0px';
              if (isCollapsed) {
                  aiContent.style.maxHeight = '200px'; 
                  aiContent.style.marginTop = '8px';
                  aiChevron.style.transform = 'rotate(0deg)';
              } else {
                  aiContent.style.maxHeight = '0px';
                  aiContent.style.marginTop = '0px';
                  aiChevron.style.transform = 'rotate(180deg)';
              }
          };
      }

      this.toggleExpand = (boxId, detailId, containerId) => {
          const box = this.querySelector(boxId);
          const detail = this.querySelector(detailId);
          const container = this.querySelector(containerId);
          
          if (!box || !detail || !container) return;
          
          const isExpanded = box.classList.contains('active-box');
          
          this.querySelectorAll('.stat-box').forEach(el => el.classList.remove('active-box'));
          this.querySelectorAll('.stat-detail-container').forEach(el => el.style.display = 'none');
          this.querySelectorAll('.stat-detail-content').forEach(el => el.style.display = 'none');
          
          if (!isExpanded) {
              box.classList.add('active-box');
              container.style.display = 'block';
              detail.style.display = 'block';
              if (boxId === '#box-charge') this.renderChargeHistory();
          }
      };

      this.renderChargeHistory = () => {
          const listEl = this.querySelector('#vf-inline-charge-list');
          if (!listEl) return;
          let html = '';
          if (this._chargeHistoryData && this._chargeHistoryData.length > 0) {
              this._chargeHistoryData.forEach(c => {
                  html += `
                  <div style="padding:8px 0; border-bottom:1px solid var(--divider-color, #e5e7eb);">
                      <div style="font-weight:bold; font-size:11px; color:var(--primary-text-color, #1e3a8a); margin-bottom:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${c.address}</div>
                      <div style="display:flex; justify-content:space-between; font-size:10px; color:var(--secondary-text-color, #475569);">
                          <span>${c.date}</span>
                          <span style="color:#d97706; font-weight:bold;">${c.kwh} kWh</span>
                          <span>${c.duration}p</span>
                      </div>
                  </div>`;
              });
          } else {
              html = `<div style="padding:10px; text-align:center; color:var(--secondary-text-color, #6b7280); font-size:11px;">No public charging data available.</div>`;
          }
          
          const pSessions = this.querySelector('#inline-pub-sessions');
          const hSessions = this.querySelector('#inline-home-sessions');
          const hKwh = this.querySelector('#inline-home-kwh');
          
          if(pSessions) pSessions.innerText = getValidState('so_lan_sac_tai_tram') || 0;
          if(hSessions) hSessions.innerText = getValidState('so_lan_sac_tai_nha') || 0;
          if(hKwh) hKwh.innerText = getValidState('dien_nang_sac_tai_nha') || 0;
          
          listEl.innerHTML = html;
      };

      const attachClick = (boxId, detailId, containerId) => {
          const el = this.querySelector(boxId);
          if (el) el.onclick = () => this.toggleExpand(boxId, detailId, containerId);
      };
      
      attachClick('#box-batt-range', '#detail-batt-range', '#detail-container-1');
      attachClick('#box-sensors', '#detail-sensors', '#detail-container-1');
      attachClick('#box-eff', '#detail-eff', '#detail-container-2');
      attachClick('#box-speed', '#detail-speed', '#detail-container-2'); 
      attachClick('#box-trip', '#detail-trip', '#detail-container-3');
      attachClick('#box-charge', '#detail-charge', '#detail-container-3'); 

      const btnLocate = this.querySelector('#btn-locate');
      if (btnLocate) btnLocate.onclick = () => { 
        if(this._map && this._lastLat) this._map.setView([this._lastLat, this._lastLon], 15, {animate: true});
      };

      const btnStations = this.querySelector('#btn-stations');
      if (btnStations) {
          btnStations.onclick = () => {
              this.renderStations();
              if (this._map && this._currentStations && this._currentStations.length > 0) {
                  const lats = this._currentStations.map(s => s.lat);
                  const lngs = this._currentStations.map(s => s.lng);
                  if (this._lastLat && this._lastLon) {
                      lats.push(this._lastLat);
                      lngs.push(this._lastLon);
                  }
                  const bounds = [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]];
                  this._map.fitBounds(bounds, {padding: [40, 40], maxZoom: 15});
              }
          };
      }
      
      const btnFilter = this.querySelector('#btn-filter-station');
      if(btnFilter) {
          btnFilter.onclick = () => {
              if (this._stationFilter === 'ALL') { this._stationFilter = 'DC'; btnFilter.innerText = 'DC'; btnFilter.style.color = '#dc2626'; }
              else if (this._stationFilter === 'DC') { this._stationFilter = 'AC'; btnFilter.innerText = 'AC'; btnFilter.style.color = '#16a34a'; }
              else { this._stationFilter = 'ALL'; btnFilter.innerText = 'ALL'; btnFilter.style.color = '#f59e0b'; }
              this.renderStations();
          };
      }

      const callServiceBtn = (btnId, domain, service, entityId) => {
          const btn = this.querySelector(btnId);
          if(btn) btn.onclick = () => {
              if(this._hass.states[entityId]) this._hass.callService(domain, service, { entity_id: entityId });
          };
      };
      callServiceBtn('#btn-rc-lock', 'button', 'press', `button.${p}_khoa_cua`);
      callServiceBtn('#btn-rc-unlock', 'button', 'press', `button.${p}_mo_cua`);
      callServiceBtn('#btn-rc-horn', 'button', 'press', `button.${p}_bam_coi`);
      callServiceBtn('#btn-rc-lights', 'button', 'press', `button.${p}_nhay_den`);

      const selectEl = this.querySelector('#trip-selector');
      if(selectEl) {
          selectEl.onchange = (e) => {
              const val = e.target.value;
              let rawPoints = [];
              if (val === "current") {
                  const routeJsonStr = getAttr('lo_trinh_gps', 'route_json');
                  rawPoints = this.safeParseJSON(routeJsonStr);
              } else {
                  rawPoints = this._tripHistory[parseInt(val)]?.route || [];
              }
              
              this._rawRouteCoords = this.cleanRouteData(rawPoints);
              this._smoothedRouteCoords = this._smoothRouteData(this._rawRouteCoords);
              
              if(this._polyline) {
                  const latLngsOnly = this._smoothedRouteCoords.map(p => [p[0], p[1]]);
                  this._polyline.setLatLngs(latLngsOnly);
                  if (latLngsOnly.length > 1) this._map.fitBounds(this._polyline.getBounds(), {padding: [30, 30]});
              }
          };
      }

      const btnReplay = this.querySelector('#btn-replay');
      const iconReplay = this.querySelector('#icon-replay');
      
      if(btnReplay && iconReplay) {
          btnReplay.onclick = () => {
              if (!this._map || !this._marker || !this._polyline) return;
              if (this._smoothedRouteCoords.length < 2) return alert("Current route is too short to replay!");

              if (this._isReplaying && !this._isPaused) {
                  this._isPaused = true;
                  cancelAnimationFrame(this._animationFrameId);
                  iconReplay.setAttribute('icon', 'mdi:play-circle');
              } else if (this._isReplaying && this._isPaused) {
                  this._isPaused = false;
                  iconReplay.setAttribute('icon', 'mdi:pause-circle');
                  this._lastReplayTime = performance.now();
                  this._animationFrameId = requestAnimationFrame(this._runAnimation);
              } else {
                  this._isReplaying = true;
                  this._isPaused = false;
                  this._currentReplayIdx = 0;
                  this._replayProgress = 0.0;
                  iconReplay.setAttribute('icon', 'mdi:pause-circle');
                  if(this._smoothedRouteCoords[0]) {
                      this._map.setView([this._smoothedRouteCoords[0][0], this._smoothedRouteCoords[0][1]], 15);
                  }
                  this._lastReplayTime = performance.now();
                  this._animationFrameId = requestAnimationFrame(this._runAnimation);
              }
          };
      }
      
      this._runAnimation = (timestamp) => {
          if (!this._isReplaying || this._isPaused) return;
          let dt = (timestamp - this._lastReplayTime) / 1000.0; 
          this._lastReplayTime = timestamp;
          if (dt > 0.1) dt = 0.1; 

          if (this._currentReplayIdx >= this._smoothedRouteCoords.length - 1) {
              this._isReplaying = false;
              this._isPaused = false;
              iconReplay.setAttribute('icon', 'mdi:play-circle');
              return;
          }

          let ptA = this._smoothedRouteCoords[this._currentReplayIdx];
          let ptB = this._smoothedRouteCoords[this._currentReplayIdx + 1];

          let distAB = this.getDistanceFromLatLonInM(ptA[0], ptA[1], ptB[0], ptB[1]);
          let speedKmh = ptA[2] || 15; 
          if (speedKmh < 15) speedKmh = 15;
          let playbackMultiplier = 15.0; 
          let moveDist = (speedKmh / 3.6) * playbackMultiplier * dt;

          if (distAB > 0) this._replayProgress += moveDist / distAB;
          else this._replayProgress = 1.1; 

          while (this._replayProgress >= 1.0) {
              this._currentReplayIdx++;
              this._replayProgress -= 1.0;
              
              if (this._currentReplayIdx >= this._smoothedRouteCoords.length - 1) {
                  this._replayProgress = 0;
                  break;
              }
              ptA = this._smoothedRouteCoords[this._currentReplayIdx];
              ptB = this._smoothedRouteCoords[this._currentReplayIdx + 1];
              distAB = this.getDistanceFromLatLonInM(ptA[0], ptA[1], ptB[0], ptB[1]);
              speedKmh = ptA[2] || 15;
              if (speedKmh < 15) speedKmh = 15;
              moveDist = (speedKmh / 3.6) * playbackMultiplier * dt;
              if (distAB === 0) this._replayProgress += 1.0; 
          }

          if (this._currentReplayIdx >= this._smoothedRouteCoords.length - 1) {
              let finalPt = this._smoothedRouteCoords[this._smoothedRouteCoords.length - 1];
              this._marker.setLatLng([finalPt[0], finalPt[1]]);
              this._isReplaying = false;
              this._isPaused = false;
              iconReplay.setAttribute('icon', 'mdi:play-circle');
              return;
          }

          let currentLat = ptA[0] + (ptB[0] - ptA[0]) * this._replayProgress;
          let currentLon = ptA[1] + (ptB[1] - ptA[1]) * this._replayProgress;
          let currentSpeed = ptA[2] + (ptB[2] - ptA[2]) * this._replayProgress;
          let targetAngle = this.getBearing(ptA[0], ptA[1], ptB[0], ptB[1]);
          let smoothedAngle = this._smoothRotation(targetAngle);

          this._marker.setIcon(this.getCarIcon(smoothedAngle, currentSpeed));
          this._marker.setLatLng([currentLat, currentLon]);
          this._map.panTo([currentLat, currentLon], { animate: false }); 

          this._animationFrameId = requestAnimationFrame(this._runAnimation);
      };
    }

    const lat = parseFloat(getValidState('vi_do_latitude') || 0);
    const lon = parseFloat(getValidState('kinh_do_longitude') || 0);

    // --- PATCH: Filter out invalid vehicle names ---
    let name = getValidState('bien_so_ten_xe_phu');
    if (!name || name === "0" || name === "1" || name.toLowerCase() === "unknown" || name === "none" || name.toLowerCase() === "vinfast") {
        name = getValidState('ten_dinh_danh_xe');
    }
    if (!name || name === "0" || name === "1" || name.toLowerCase() === "unknown" || name === "none" || name.toLowerCase() === "vinfast") {
        name = getValidState('ten_dinh_danh_xe_mqtt');
    }
    if (!name || name === "0" || name === "1" || name.toLowerCase() === "unknown" || name === "none" || name.toLowerCase() === "vinfast") {
        name = getValidState('ten_dong_xe');
    }
    if (!name || name === "0" || name === "1" || name.toLowerCase() === "unknown" || name === "none" || name.toLowerCase() === "vinfast") {
        name = 'Xe VinFast';
    }

    const statusObj = hass.states[`sensor.${p}_trang_thai_hoat_dong`];
    let statusTextRaw = statusObj ? statusObj.state : 'N/A';
    let statusText = statusTextRaw;
    
    if (statusObj && statusObj.last_changed) {
        statusText += ` ${formatTimeSince(statusObj.last_changed)}`;
    }
    
    const aiAdvisor = getValidState('co_van_xe_dien_ai');
    const aiContainer = this.querySelector('#vf-ai-advisor-container');
    const aiTextEl = this.querySelector('#vf-ai-text');
    const aiContentEl = this.querySelector('#vf-ai-content');
    const aiChevron = this.querySelector('#vf-ai-chevron');
    
    if (aiContainer && aiTextEl) {
        if (!aiAdvisor || aiAdvisor === 'DISABLED' || aiAdvisor === 'unavailable') {
            aiContainer.style.display = 'none'; 
        } 
        else if (!aiAdvisor.toLowerCase().includes('waiting') && !aiAdvisor.toLowerCase().includes('please enter')) {
            aiTextEl.innerText = aiAdvisor;
            aiContainer.style.display = 'block'; 
            if (this._lastAiMessage !== aiAdvisor) {
                this._lastAiMessage = aiAdvisor;
                if (aiContentEl) {
                    aiContentEl.style.maxHeight = '200px';
                    aiContentEl.style.marginTop = '8px';
                    if (aiChevron) aiChevron.style.transform = 'rotate(0deg)';
                }
            }
        } else {
            aiContainer.style.display = 'none'; 
        }
    }
    
    const gear = getValidState('vi_tri_can_so') || 'P';
    const speed = getValidState('toc_do_hien_tai') || '0';
    const speedNum = Math.round(Number(speed));
    const carModel = getValidState('ten_dong_xe') || "";
    
    const nameEl = this.querySelector('#vf-name');
    const weatherCondition = getValidState('thoi_tiet_hien_tai');
    const outsideTemp = getValidState('nhiet_do_ngoai_troi_gps');

    if(nameEl) {
        if (weatherCondition && outsideTemp && outsideTemp !== '--') {
            nameEl.innerHTML = `<div style="display: flex; align-items: center; gap: 6px; font-size: 15px; font-weight: bold; color: var(--secondary-text-color, #64748b);">
                <ha-icon icon="mdi:weather-partly-cloudy" style="--mdc-icon-size: 20px; color: #00bcd4;"></ha-icon>
                <span>${outsideTemp}°C | ${weatherCondition}</span>
            </div>`;
        } else {
            nameEl.innerText = name;
        }
    }

    const statBadgeEl = this.querySelector('#vf-status-badge');
    if(statBadgeEl) statBadgeEl.innerText = statusText;
    
    const odoRaw = getValidState('tong_odo_mqtt') || getValidState('tong_odo');
    const odoEl = this.querySelector('#vf-odo-int');
    if(odoEl) odoEl.innerText = (odoRaw && !isNaN(odoRaw)) ? Math.floor(parseFloat(odoRaw)).toString() : '--';

    let rawImage = getValidState('hinh_anh_xe_url');
    const imgEl = this.querySelector('#vf-car-img');
    if (imgEl && rawImage && rawImage !== 'unknown') imgEl.src = rawImage;

    const updateTire = (id, val) => {
      const el = this.querySelector(id);
      if(el) {
        if (val !== null && val !== 'unknown' && val !== '') { el.style.display = 'block'; el.querySelector('span').innerText = val; }
        else { el.style.display = 'none'; }
      }
    };
    updateTire('#tire-fl', getValidState('ap_suat_lop_truoc_trai')); 
    updateTire('#tire-fr', getValidState('ap_suat_lop_truoc_phai')); 
    updateTire('#tire-rl', getValidState('ap_suat_lop_sau_trai')); 
    updateTire('#tire-rr', getValidState('ap_suat_lop_sau_phai'));

    ['P','R','N','D'].forEach(g => {
      const el = this.querySelector(`#gear-${g}`);
      if(el) { if (gear.includes(g)) el.classList.add('active'); else el.classList.remove('active'); }
    });
    
    const speedEl = this.querySelector('#vf-speed-container');
    if (!this._isReplaying && speedEl) {
        const speedDisplayEl = this.querySelector('#vf-speed');
        if (gear.includes('P') || speedNum === 0) {
            speedEl.style.display = 'none';
        } else { 
            speedEl.style.display = 'flex'; 
            if (speedDisplayEl) speedDisplayEl.innerText = speedNum; 
        }
    }

    const checkSensorState = (slugList, targetVal) => {
        for (let s of slugList) {
            const val = getValidState(s);
            if (val && val.toLowerCase().includes(targetVal)) return true;
        }
        return false;
    };

    const doorsConfig = [
        { slugs: ['driver_door', 'cua_tai_xe'], name: 'Driver Door', icon: 'mdi:car-door' },
        { slugs: ['passenger_door', 'cua_phu'], name: 'Passenger Door', icon: 'mdi:car-door' },
        { slugs: ['rear_driver_door', 'cua_sau_tai_xe', 'cua_sau_trai'], name: 'Rear Driver Door', icon: 'mdi:car-door' },
        { slugs: ['rear_passenger_door', 'cua_sau_phu', 'cua_sau_phai'], name: 'Rear Pass. Door', icon: 'mdi:car-door' },
        { slugs: ['trunk', 'cop_sau'], name: 'Trunk', icon: 'mdi:car-back' },
        { slugs: ['hood', 'nap_capo'], name: 'Hood', icon: 'mdi:car-door' },
        { slugs: ['driver_window', 'kinh_tai_xe', 'cua_so_tai_xe'], name: 'Driver Window', icon: 'mdi:window-open' }
    ];

    const openDoors = doorsConfig.filter(d => checkSensorState(d.slugs, 'open'));
    const isParked = statusTextRaw.toLowerCase().includes('park') || gear.includes('P');
    const isUnlocked = checkSensorState(['central_lock', 'khoa_tong'], 'unlocked');

    const doorsEl = this.querySelector('#vf-doors-container');
    if (doorsEl) {
        let securityHtml = '';
        if (openDoors.length === 0 && (!isParked || !isUnlocked)) {
            securityHtml = `<div class="door-badge" style="color: #10b981; border-color: rgba(16, 185, 129, 0.3); background: rgba(255,255,255,0.7);"><ha-icon icon="mdi:shield-check-outline"></ha-icon> Secure</div>`;
        } else {
            if (openDoors.length > 0) securityHtml += openDoors.map(d => `<div class="door-badge open"><ha-icon icon="${d.icon}"></ha-icon> ${d.name}</div>`).join('');
            if (isParked && isUnlocked) securityHtml += `<div class="door-badge open warning"><ha-icon icon="mdi:lock-open-alert"></ha-icon> Vehicle Unlocked</div>`;
        }
        doorsEl.innerHTML = securityHtml;
    }

    const chargingBanner = this.querySelector('#vf-charging-banner');
    const isCharging = statusTextRaw && statusTextRaw.toLowerCase().includes('charging');
    
    if (isCharging && chargingBanner && !statusTextRaw.toLowerCase().includes('not')) {
        chargingBanner.style.display = 'flex';
        let chargeLimit = getValidState('muc_tieu_sac_target') || '--';
        const chargeTimeRemain = getValidState('thoi_gian_sac_con_lai') || getValidState('thoi_gian_sac_uoc_tinh');
        
        const chargeLimitEl = this.querySelector('#vf-charge-limit');
        const chargeTimeEl = this.querySelector('#vf-charge-time');
        const chargeStatusTextEl = this.querySelector('#vf-charge-status-text');
        const powerEl = this.querySelector('#vf-charge-power');
        
        if (chargeLimitEl) chargeLimitEl.innerText = chargeLimit !== '--' ? `${chargeLimit}%` : '--';
        if (chargeTimeEl) chargeTimeEl.innerText = (chargeTimeRemain && chargeTimeRemain !== 'unknown') ? `${chargeTimeRemain}` : '--';
        if (chargeStatusTextEl) chargeStatusTextEl.innerText = statusTextRaw.toLowerCase().includes('fully') ? "Fully Charged" : "Charging System Active";
        
        let pwr = getValidState('cong_suat_sac_tinh_toan_live') || getValidState('cong_suat_sac_trung_binh_lan_cuoi') || getValidState('cong_suat_sac_tram') || getValidState('cong_suat_sac');
        if (powerEl) powerEl.innerText = pwr ? `${pwr} kW` : 'Calculating...';
    } else if (chargingBanner) {
        chargingBanner.style.display = 'none';
    }

    const batt = getValidState('phan_tram_pin');
    let range = getValidState('quang_duong_du_kien');
    if (!range || range === '0' || range === '0.0' || range === '--' || range === 'unknown') {
        range = getValidState('quang_duong_con_lai_theo_hieu_suat');
        if (!range || range === '0' || range === '0.0' || range === '--' || range === 'unknown') {
            range = getValidState('quang_duong_cong_bo_max');
        }
    }
    
    const trip = getValidState('quang_duong_chuyen_di_trip');
    const tripEnergy = getValidState('dien_nang_tieu_thu_trip');
    const effKwh = getValidState('hieu_suat_tieu_thu_trung_binh_xe') || '--';
    const effRangePerPercent = getValidState('quang_duong_di_duoc_moi_1_pin') || '--';

    if (!this._effToggleTimer) {
        this._effToggleTimer = setInterval(() => {
            this._effToggleState = !this._effToggleState;
            const elements = [
                { el: this.querySelector('#vf-stat-eff'), lbl: this.querySelector('#lbl-eff') },
                { el: this.querySelector('#vf-stat-batt-range'), lbl: this.querySelector('#lbl-batt-range'), icon: this.querySelector('#icon-batt-range') }
            ];

            elements.forEach(item => {
                if (item.el) {
                    item.el.style.opacity = '0'; 
                    setTimeout(() => {
                        if (item.lbl && item.lbl.id === 'lbl-eff') {
                            if (this._effToggleState) {
                                item.el.innerHTML = `${effRangePerPercent}<span class="stat-unit">km/1%</span>`;
                                item.lbl.innerText = "Per 1% Battery";
                                item.lbl.style.color = "#3b82f6";
                            } else {
                                item.el.innerHTML = `${effKwh}<span class="stat-unit">kWh/100km</span>`;
                                item.lbl.innerText = "Avg Efficiency";
                                item.lbl.style.color = "#6b7280";
                            }
                        } else if (item.lbl) {
                            if (this._effToggleState) {
                                item.el.innerHTML = `${range && range!=='--' ? range : '--'}<span class="stat-unit">km</span>`;
                                item.lbl.innerText = "RANGE";
                                item.lbl.style.color = "#3b82f6";
                                if(item.icon) { item.icon.setAttribute('icon', 'mdi:map-marker-distance'); item.icon.style.color = "#3b82f6"; }
                            } else {
                                item.el.innerHTML = `${batt && batt!=='--' ? batt : '--'}<span class="stat-unit">%</span>`;
                                item.lbl.innerText = "BATTERY";
                                item.lbl.style.color = "#10b981";
                                if(item.icon) { item.icon.setAttribute('icon', 'mdi:battery-charging-60'); item.icon.style.color = "#10b981"; }
                            }
                        }
                        item.el.style.opacity = '1';
                    }, 300);
                }
            });
        }, 5000);
    }

    const renderStat = (id, val, unit) => {
        const el = this.querySelector(id);
        if(el) {
            if (val && val !== 'unknown' && val !== '--') el.innerHTML = `${val}<span class="stat-unit">${unit}</span>`;
            else el.innerHTML = '--';
        }
    };

    renderStat('#vf-stat-batt-range', batt, '%');
    renderStat('#vf-stat-trip', trip, 'km');
    
    // --- PATCH: AUTOMATIC PARKING BRAKE FOR VF3 ---
    let phanhTay = getValidState('phanh_tay') || getValidState('phanh_tay_dien_tu');
    if (carModel.toUpperCase().includes('VF3') || carModel.toUpperCase().includes('VF 3')) {
        if (gear.includes('P')) phanhTay = 'Engaged';
        else if (gear.includes('D') || gear.includes('R') || gear.includes('N')) phanhTay = 'Released';
    }

    const sensorsToWatch = [
        { name: "Pin 12V", state: getValidState('pin_12v_ac_quy'), icon: "mdi:car-battery", unit: "%" },
        { name: "Central Lock", state: getValidState('central_lock'), icon: "mdi:lock" },
        { name: "Security", state: getValidState('security_status'), icon: "mdi:shield-car" },
        { name: "Phanh tay", state: phanhTay, icon: "mdi:car-brake-parking" },
        { name: "Hazard Lights", state: getValidState('hazard_warning_lights'), icon: "mdi:car-light-alert" },
        { name: "Climate", state: getValidState('climate_control_status'), icon: "mdi:air-conditioner" },
        { name: "Camp Mode", state: getValidState('camp_mode'), icon: "mdi:tent" },
        { name: "Pet Mode", state: getValidState('pet_mode'), icon: "mdi:paw" },
        { name: "Valet Mode", state: getValidState('valet_mode'), icon: "mdi:account-tie-hat" }
    ];

    let sensorHtml = '';
    let warningCount = 0;

    sensorsToWatch.forEach(s => {
        if (s.state && s.state !== '--' && s.state !== 'unknown') {
            let color = '#475569';
            const stLower = s.state.toLowerCase();
            
            if (stLower.includes('unlocked') || stLower.includes('disarmed') || stLower.includes('released') || (stLower.includes('on') && s.name==='Hazard Lights') || (s.name==='12V Battery' && parseFloat(s.state) < 40)) {
                color = '#ef4444'; 
                if (s.name !== 'Climate') warningCount++;
            } else if (stLower.includes('locked') || stLower.includes('armed') || stLower.includes('engaged') || stLower.includes('on')) {
                color = '#10b981'; 
            }

            sensorHtml += `
            <div style="display:flex; justify-content:space-between; align-items:center; background:var(--primary-background-color, white); padding:8px 12px; border-radius:8px; border:1px solid var(--divider-color, #e2e8f0);">
                <div style="display:flex; align-items:center; gap:8px; color:var(--secondary-text-color, #475569);">
                    <ha-icon icon="${s.icon}" style="color:${color}; --mdc-icon-size:18px;"></ha-icon>
                    <span style="font-size:12px; font-weight:600;">${s.name}</span>
                </div>
                <b style="font-size:12px; color:${color};">${s.state} ${s.unit||''}</b>
            </div>`;
        }
    });

    const sensorListEl = this.querySelector('#sensor-list-container');
    if (sensorListEl) sensorListEl.innerHTML = sensorHtml || `<div style="text-align:center; padding:10px; color:#94a3b8; font-size:12px;">No sensors available</div>`;

    const sensorSummaryEl = this.querySelector('#vf-stat-sensors');
    if (sensorSummaryEl) {
        if (warningCount > 0) {
            sensorSummaryEl.innerHTML = `<span style="color:#ef4444; font-size:14px;">${warningCount} Warnings</span>`;
        } else {
            sensorSummaryEl.innerHTML = `<span style="color:#10b981; font-size:14px;">Normal</span>`;
        }
    }

    const tripEff = parseFloat(getValidState('hieu_suat_tieu_thu_trip')) || 0;
    const capacity = parseFloat(getValidState('dung_luong_pin_thiet_ke')) || 0;
    const maxRange = parseFloat(getValidState('quang_duong_cong_bo_max')) || 0;
    const isTripActive = parseFloat(trip) > 0.5;

    let tripDegradationHtml = '--';
    if (isTripActive && tripEff > 0 && capacity > 0 && maxRange > 0) {
        const tripMaxRange = capacity / (tripEff / 100);
        let dropPct = ((maxRange - tripMaxRange) / maxRange) * 100;
        if (dropPct < 0) dropPct = 0; 
        tripDegradationHtml = `${dropPct.toFixed(1)}% <span style="font-size:10px; color:#94a3b8; font-weight:normal;">(Theo Trip)</span>`;
    } else {
        tripDegradationHtml = `${getValidState('kha_nang_chai_pin_theo_range_tham_khao') || '--'}% <span style="font-size:10px; color:#94a3b8; font-weight:normal;">(Lifetime)</span>`;
    }

    const dtRangeDropTripEl = this.querySelector('#dt-range-drop-trip');
    if (dtRangeDropTripEl) dtRangeDropTripEl.innerHTML = tripDegradationHtml;

    const pubSessions = parseInt(getValidState('so_lan_sac_tai_tram')) || 0;
    const homeSessions = parseInt(getValidState('so_lan_sac_tai_nha')) || 0;
    const totalSessions = parseInt(getValidState('tong_so_lan_sac')) || (pubSessions + homeSessions);
    
    const chargeCountEl = this.querySelector('#vf-stat-charge-count');
    if(chargeCountEl) chargeCountEl.innerHTML = `${totalSessions}<span class="stat-unit"> sessions</span>`;

    const speedBandStr = getValidState('dai_toc_do_toi_uu_nhat');
    const speedElTarget = this.querySelector('#vf-stat-speed');
    if (speedElTarget) {
        if (speedBandStr && speedBandStr !== 'unknown' && speedBandStr !== '--') {
            let spd = speedBandStr.split(' ')[0];
            speedElTarget.innerHTML = `${spd}<span class="stat-unit">km/h</span>`;
        } else speedElTarget.innerHTML = '--';
    }

    const dtSohEl = this.querySelector('#dt-soh');
    if (dtSohEl) dtSohEl.innerText = getValidState('suc_khoe_pin_soh_tinh_toan') ? `${getValidState('suc_khoe_pin_soh_tinh_toan')}%` : '--';
    
    const dtChargeEffEl = this.querySelector('#dt-charge-eff');
    if (dtChargeEffEl) dtChargeEffEl.innerText = getValidState('hieu_suat_sac_thuc_te_lan_cuoi') ? `${getValidState('hieu_suat_sac_thuc_te_lan_cuoi')}%` : '--';

    const dtChargeSocStartEl = this.querySelector('#dt-charge-soc-start');
    if (dtChargeSocStartEl) dtChargeSocStartEl.innerText = `${getValidState('pin_luc_cam_sac_lan_cuoi') || '--'}%`;
    
    const dtChargeSocEndEl = this.querySelector('#dt-charge-soc-end');
    if (dtChargeSocEndEl) {
        let endSoc = getValidState('pin_luc_rut_sac_lan_cuoi');
        if (isCharging) endSoc = batt; 
        dtChargeSocEndEl.innerText = `${endSoc || '--'}%`;
    }
    
    const dtRangeMaxEl = this.querySelector('#dt-range-max');
    if (dtRangeMaxEl) dtRangeMaxEl.innerText = `${getValidState('quang_duong_cong_bo_max') || '--'} km`;
    
    const dtRangeAiEl = this.querySelector('#dt-range-ai');
    if (dtRangeAiEl) dtRangeAiEl.innerText = `${getValidState('quang_duong_thuc_te_day_100_pin') || '--'} km`;
    
    const dtTotalKwhEl = this.querySelector('#dt-total-kwh');
    if (dtTotalKwhEl) dtTotalKwhEl.innerText = `${getValidState('tong_dien_nang_da_sac') || '--'} kWh`;
    
    const dtTotalCostEl = this.querySelector('#dt-total-cost');
    if (dtTotalCostEl) dtTotalCostEl.innerText = `${getValidState('estimated_total_charging_cost') || getValidState('tong_chi_phi_sac_quy_doi') || '--'}`;

    const dtTripAvgSpeedEl = this.querySelector('#dt-trip-avg-speed');
    if (dtTripAvgSpeedEl) dtTripAvgSpeedEl.innerText = `${getValidState('toc_do_tb_chuyen_di') || '--'} km/h`;
    
    const dtTripEnergyEl = this.querySelector('#dt-trip-energy');
    if (dtTripEnergyEl) dtTripEnergyEl.innerText = `${tripEnergy || '--'} kWh`;

    const dtSpeedChart = this.querySelector('#dt-speed-chart');
    if (dtSpeedChart) {
        let htmlChart = '';
        let maxVal = 0;
        let bars = [];
        const sObj = hass.states[`sensor.${p}_optimal_speed_range`] || hass.states[`sensor.${p}_dai_toc_do_toi_uu_nhat`];
        if (sObj && sObj.attributes) {
            for (let key in sObj.attributes) {
                if (key.includes('Band')) {
                    let valStr = sObj.attributes[key];
                    let num = parseFloat(valStr.split(' ')[0]);
                    if (num > maxVal) maxVal = num;
                    bars.push({label: key.replace('Band ', '').replace(' km/h', ''), val: num});
                }
            }
        }
        if (bars.length > 0) {
            bars.forEach(b => {
                let pct = Math.round((b.val / maxVal) * 100);
                htmlChart += `<div style="display:flex; align-items:center; gap:8px;">
                    <div style="width:40px; font-size:10px; text-align:right; font-weight:bold; color:var(--secondary-text-color, #475569);">${b.label}</div>
                    <div style="flex:1; background:var(--divider-color, #e2e8f0); height:8px; border-radius:4px; overflow:hidden;">
                        <div style="width:${pct}%; height:100%; background:${pct === 100 ? '#eab308' : '#3b82f6'}; transition: width 0.5s;"></div>
                    </div>
                    <div style="width:35px; font-size:10px; font-weight:bold; color:var(--primary-text-color, #1e3a8a);">${b.val}</div>
                </div>`;
            });
            dtSpeedChart.innerHTML = htmlChart;
        }
    }

    const addressEl = this.querySelector('#vf-current-address');
    if (addressEl) {
        let sensorAddress = getValidState('vi_tri_xe_dia_chi');
        if (sensorAddress && sensorAddress !== 'unknown') {
             addressEl.innerText = sensorAddress;
        } else if (lat && lon && lat > 0) {
            addressEl.innerText = `Coordinates: ${lat.toFixed(5)}, ${lon.toFixed(5)}`;
        } else {
            addressEl.innerText = "Locating vehicle...";
        }
    }

    if (batt && !isNaN(batt)) {
        const battNum = parseFloat(batt);
        const stageEl = this.querySelector('#vf-car-stage');
        
        if (battNum < 20) {
            if (stageEl) stageEl.classList.add('low-battery');
        } else {
            if (stageEl) stageEl.classList.remove('low-battery');
        }

        if (this._smoothedRouteCoords && this._smoothedRouteCoords.length >= 2) {
            const lastPt = this._smoothedRouteCoords[this._smoothedRouteCoords.length - 1];
            const prevPt = this._smoothedRouteCoords[this._smoothedRouteCoords.length - 2];
            const currentHeading = this.getBearing(prevPt[0], prevPt[1], lastPt[0], lastPt[1]);
            this.checkAndShowSmartSuggestion(battNum, currentHeading);
        } else {
            this.checkAndShowSmartSuggestion(battNum, null);
        }
    }

    if (this._map && lat && lon && typeof L !== 'undefined') {
      if (!this._isReplaying) {
          let targetAngle = this._currentAngle || 0;

          if (this._lastHeadingLat === null) {
              this._lastHeadingLat = lat;
              this._lastHeadingLon = lon;
          } else {
              const distToLastHeading = this._map.distance([this._lastHeadingLat, this._lastHeadingLon], [lat, lon]);
              
              if (distToLastHeading > 2.5 && speedNum > 0) {
                  targetAngle = this.getBearing(this._lastHeadingLat, this._lastHeadingLon, lat, lon);
                  if (gear.includes('R') || gear === '2') targetAngle = (targetAngle + 180) % 360;
                  
                  this._lastHeadingLat = lat;
                  this._lastHeadingLon = lon;
                  this._currentAngle = targetAngle;
              }
          }

          if (this._marker) {
              this._marker.setOpacity(1); 
              this._marker.setLatLng([lat, lon]);

              const iconEl = this._marker.getElement();
              if (iconEl) {
                  const smoothedAngle = this._smoothRotation(targetAngle);
                  const svg = iconEl.querySelector('.car-dir-svg');
                  if (svg) svg.style.transform = `rotate(${smoothedAngle}deg)`;

                  const badge = iconEl.querySelector('.car-speed-badge');
                  if (badge) {
                      badge.style.display = (!gear.includes('P') && speedNum > 0) ? 'block' : 'none';
                      badge.innerText = `${speedNum} km/h`;
                  }
              }
          }

          if (this._lastLat === null) this._map.setView([lat, lon], 15);
          this._lastLat = lat; this._lastLon = lon;
          
          const selectEl = this.querySelector('#trip-selector');
          if (selectEl && selectEl.value === "current") {
              const routeJsonStr = getAttr('lo_trinh_gps', 'route_json');
              if (routeJsonStr && this._polyline) {
                  if (this._currentPolylineString !== routeJsonStr) {
                      this._currentPolylineString = routeJsonStr;
                      let parsedData = this.safeParseJSON(routeJsonStr);
                      this._rawRouteCoords = this.cleanRouteData(parsedData);
                      this._smoothedRouteCoords = this._smoothRouteData(this._rawRouteCoords);
                      const latLngsOnly = this._smoothedRouteCoords.map(p => [p[0], p[1]]);
                      this._polyline.setLatLngs(latLngsOnly);
                  }
              }
          }
      }

      const stationsStr = getAttr('tram_sac_lan_can', 'stations');
      if (stationsStr && stationsStr !== this._prevStationStr) {
          this._prevStationStr = stationsStr;
          let newStations = this.safeParseJSON(stationsStr);
          if (Array.isArray(newStations)) {
              this._currentStations = newStations;
              this.renderStations();
          }
      }
    }
  }
  getCardSize() { return 8; }
}

if (!customElements.get('vinfast-digital-twin')) customElements.define('vinfast-digital-twin', VinFastDigitalTwin);