/*! iMagellan live brief — phone-first UI wired to /api/streams, /api/tides, /api/wx */
(function () {
  "use strict";

  var SILL_CD = 2.0; // Les Sablons sill +2.0 m CD
  var GATES = [
    { id: "russell", label: "Russell", chip: "chipRussell", when: "leave" },
    { id: "minqw", label: "Minquiers", chip: "chipMinqw", when: "mid" },
    { id: "sablons", label: "Sablons", chip: "chipSablons", when: "arrive" }
  ];

  // Rough planned track SPP → Sablons (west-about sketch, deg)
  var TRACK = [
    { lat: 49.4567, lon: -2.5233 },
    { lat: 49.35, lon: -2.55 },
    { lat: 49.15, lon: -2.45 },
    { lat: 48.97, lon: -2.32 },
    { lat: 48.75, lon: -2.15 },
    { lat: 48.6407, lon: -2.0285 }
  ];

  var CUR = null;
  var TIDE = null;
  var WX = null;
  var syncing = false;
  var selectedGate = null;

  function $(id) { return document.getElementById(id); }
  function num(v) { return typeof v === "number" && isFinite(v); }


  function hh(m) {
    m = ((+m % 1440) + 1440) % 1440;
    var h = Math.floor(m / 60), n = Math.floor(m % 60);
    return (h < 10 ? "0" : "") + h + ":" + (n < 10 ? "0" : "") + n;
  }

  function parseHHMM(s) {
    var m = (s || "").match(/(\d{1,2}):(\d{2})/);
    if (!m) return null;
    return (+m[1]) * 60 + (+m[2]);
  }

  function toTimeValue(min) {
    return hh(min);
  }

  function tzAbbrev() {
    try {
      var parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London",
        timeZoneName: "short"
      }).formatToParts(new Date());
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].type === "timeZoneName") return parts[i].value;
      }
    } catch (e) {}
    return "BST";
  }

  function londonNowMin() {
    var o = {};
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date()).forEach(function (p) { o[p.type] = p.value; });
    return (+o.hour) * 60 + (+o.minute);
  }

  function hourRow(rows, min) {
    if (!rows || !rows.length) return null;
    min = ((+min % 1440) + 1440) % 1440;
    // Prefer same-day then +1440 wrap rows if present
    var best = null;
    var i = 0;
    while (i < rows.length - 2 && rows[i + 1].min < min) i++;
    // If rows span 2 days (min >= 1440), also try matching day-offset
    var A = rows[i], B = rows[i + 1] || A;
    if (!A) return null;
    var span = Math.max(1, (B.min || A.min + 60) - A.min);
    var t = (min - A.min) / span;
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    var knA = +A.kn, knB = +B.kn;
    if (!isFinite(knA)) knA = 0;
    if (!isFinite(knB)) knB = knA;
    return { kn: knA + (knB - knA) * t, dir: +A.dir || 0 };
  }

  function station(id) {
    if (!CUR || !CUR.stations) return null;
    for (var i = 0; i < CUR.stations.length; i++) {
      if (CUR.stations[i].id === id) return CUR.stations[i];
    }
    return null;
  }

  function streamAt(id, min) {
    var st = station(id);
    if (!st) return null;
    return hourRow(st.hours, min);
  }

  function phaseOf(row) {
    if (!row) return "—";
    if (row.kn < 0.28) return "slack";
    // SMOC dir: toward which current flows (oceanographic)
    return (row.dir < 90 || row.dir > 270) ? "flood" : "ebb";
  }

  /** open / watch / timing — deck-readable gate stance */
  function gateState(row) {
    if (!row) return { key: "muted", word: "…" };
    var kn = row.kn;
    if (kn < 0.35) return { key: "open", word: "open" };
    if (kn < 1.15) return { key: "watch", word: "watch" };
    return { key: "warn", word: "timing" };
  }

  function toMin(iso) {
    if (!iso) return 0;
    var o = {};
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      year: "numeric", month: "2-digit", day: "2-digit", hourCycle: "h23"
    }).formatToParts(new Date()).forEach(function (p) { o[p.type] = p.value; });
    var off = Math.round(
      (Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) -
        Date.UTC(+o.year, +o.month - 1, +o.day)) / 86400000
    );
    return off * 1440 + (+iso.slice(11, 13)) * 60 + (+iso.slice(14, 16) || 0);
  }

  function evs(id) {
    if (!TIDE || !TIDE.ports) return [];
    var p = null;
    for (var i = 0; i < TIDE.ports.length; i++) {
      if (TIDE.ports[i].id === id) { p = TIDE.ports[i]; break; }
    }
    if (!p || !p.events) return [];
    return p.events.map(function (e) {
      return [toMin(e.t), +e.h, e.type];
    }).filter(function (a) {
      return isFinite(a[0]) && isFinite(a[1]);
    }).sort(function (a, b) { return a[0] - b[0]; });
  }

  function hAt(id, min) {
    var s = evs(id);
    if (s.length < 2) return null;
    var i = 0;
    while (i < s.length - 2 && s[i + 1][0] < min) i++;
    var A = s[i], B = s[i + 1] || A;
    var t = (min - A[0]) / Math.max(1, B[0] - A[0]);
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    return A[1] + (B[1] - A[1]) * t;
  }

  function nearestHW(id, min) {
    var s = evs(id).filter(function (e) { return e[2] === "HW"; });
    if (!s.length) return null;
    var best = s[0], bd = Math.abs(s[0][0] - min);
    for (var i = 1; i < s.length; i++) {
      var d = Math.abs(s[i][0] - min);
      if (d < bd) { bd = d; best = s[i]; }
    }
    return { min: best[0], h: best[1], delta: min - best[0] };
  }

  function fmtOffset(deltaMin) {
    var sign = deltaMin >= 0 ? "+" : "−";
    var a = Math.abs(Math.round(deltaMin));
    var h = Math.floor(a / 60), m = a % 60;
    return "HW " + sign + h + ":" + (m < 10 ? "0" : "") + m;
  }

  function compass(deg) {
    if (!isFinite(deg)) return "—";
    var dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
      "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    var i = Math.round(((deg % 360) + 360) % 360 / 22.5) % 16;
    return dirs[i];
  }

  function wxAt(min) {
    if (!WX) return null;
    var times = WX.time || [];
    var spd = WX.wind_speed_10m || [];
    var dir = WX.wind_direction_10m || [];
    var gst = WX.wind_gusts_10m || [];
    if (!times.length) return null;
    var targetH = Math.floor((((+min % 1440) + 1440) % 1440) / 60);
    var best = 0, bd = 99;
    for (var i = 0; i < times.length; i++) {
      var hhmm = times[i].split("T")[1] || "";
      var h = +(hhmm.slice(0, 2));
      var d = Math.abs(h - targetH);
      if (d < bd) { bd = d; best = i; }
    }
    return {
      kn: +spd[best],
      dir: +dir[best],
      gust: +gst[best]
    };
  }

  function setLive(on) {
    var el = $("livePill");
    if (!el) return;
    if (on) el.classList.remove("offline");
    else el.classList.add("offline");
  }

  function gateMinute(g, dep, eta) {
    if (g.when === "leave") return dep;
    if (g.when === "arrive") return eta;
    // mid-passage ≈ leave + 3h toward Minquiers
    return dep + 180;
  }

  function paintGates(dep, eta) {
    GATES.forEach(function (g) {
      var el = $(g.chip);
      if (!el) return;
      var row = streamAt(g.id, gateMinute(g, dep, eta));
      var st = gateState(row);
      el.className = "chip" + (st.key === "watch" ? "" : " " + st.key);
      if (st.key === "watch") {
        // gold default — already .chip
      }
      el.textContent = g.label + " · " + st.word;
      el.dataset.kn = row ? row.kn.toFixed(1) : "";
      el.dataset.phase = phaseOf(row);
    });
    paintGateDetail(dep, eta);
  }

  function paintGateDetail(dep, eta) {
    var box = $("gateDetail");
    if (!box) return;
    var g = null;
    if (selectedGate) {
      for (var i = 0; i < GATES.length; i++) {
        if (GATES[i].id === selectedGate) { g = GATES[i]; break; }
      }
    }
    if (!g) {
      box.textContent = CUR && CUR.src
        ? ("Model · " + CUR.src)
        : "Stream is the 8 km model — not chart authority.";
      return;
    }
    var row = streamAt(g.id, gateMinute(g, dep, eta));
    if (!row) {
      box.textContent = g.label + " — no stream data yet.";
      return;
    }
    box.textContent =
      g.label + " · " + phaseOf(row) + " " + row.kn.toFixed(1) + " kn · dir " +
      Math.round(row.dir) + "° · model-based";
  }

  function paintClocks(dep, eta) {
    var tz = tzAbbrev();
    var hw = nearestHW("spp", dep);
    if ($("leaveSub")) {
      $("leaveSub").textContent = hw
        ? (tz + " · " + fmtOffset(hw.delta))
        : (tz + " · HW —");
    }
    if ($("arriveSub")) {
      var ha = hAt("sablons", eta);
      var over = num(ha) ? (ha - SILL_CD) : null;
      if (over != null && over >= 2.5) {
        $("arriveSub").textContent = tz + " · sill window";
      } else if (over != null && over >= 0) {
        $("arriveSub").textContent = tz + " · thin over sill";
      } else if (over != null) {
        $("arriveSub").textContent = tz + " · below sill";
      } else {
        $("arriveSub").textContent = tz + " · sill window";
      }
    }
    var etaEl = $("eta");
    if (etaEl) etaEl.textContent = hh(eta);
  }

  function paintTide(dep, eta, now) {
    var nowH = hAt("sablons", now);
    var arrH = hAt("sablons", eta);
    var sppNow = hAt("spp", now);
    if ($("tideNow")) {
      $("tideNow").textContent = num(nowH) ? (nowH.toFixed(1) + " m") : "—";
    }
    if ($("tideArrive")) {
      $("tideArrive").textContent = num(arrH) ? (arrH.toFixed(1) + " m") : "—";
    }
    if ($("sppNow")) $("sppNow").textContent = num(sppNow) ? sppNow.toFixed(1) + " m" : "—";
    if ($("malNow")) $("malNow").textContent = num(nowH) ? nowH.toFixed(1) + " m" : "—";

    var note = $("sillNote");
    if (!note) return;
    if (!num(arrH)) {
      note.innerHTML = "<b>Sill note:</b> Sablons sill +2.0 m CD — waiting on tide data.";
      return;
    }
    var over = arrH - SILL_CD;
    var plain;
    if (over >= 4.8) {
      plain = "clear with ≥4.8 m over sill — hold if swell builds on the bar.";
    } else if (over >= 2.0) {
      plain = "about " + over.toFixed(1) + " m over the sill — workable, watch swell on the bar.";
    } else if (over >= 0) {
      plain = "only " + over.toFixed(1) + " m over the sill — thin; rethink timing.";
    } else {
      plain = Math.abs(over).toFixed(1) + " m below sill — do not plan entry.";
    }
    note.innerHTML = "<b>Sill note:</b> " + plain + " (sill +2.0 m CD).";
  }

  function paintWind(min) {
    var w = wxAt(min);
    var main = $("windMain"), gust = $("windGust"), needle = $("windNeedle");
    if (!w || !num(w.kn)) {
      if (main) main.textContent = "—";
      if (gust) gust.textContent = "gust —";
      if ($("wv")) $("wv").textContent = "—";
      if ($("wg")) $("wg").textContent = "—";
      return;
    }
    var lo = Math.max(0, Math.round(w.kn - 2));
    var hi = Math.round(w.kn + 2);
    var label = compass(w.dir) + " " + lo + "–" + hi;
    if (main) main.textContent = label;
    if (gust) gust.textContent = num(w.gust)
      ? ("gust " + Math.round(w.gust))
      : "gust —";
    if (needle) {
      // Wind FROM direction: needle points into the wind (meteorological)
      needle.style.transform = "rotate(" + (w.dir) + "deg) translateY(-6px)";
    }
    if ($("wv")) $("wv").textContent = compass(w.dir) + " " + Math.round(w.kn);
    if ($("wg")) $("wg").textContent = num(w.gust) ? ("G" + Math.round(w.gust)) : "";
  }

  function haversineNm(a, b) {
    var R = 3440.065; // Earth radius nm
    var toR = Math.PI / 180;
    var dLat = (b.lat - a.lat) * toR;
    var dLon = (b.lon - a.lon) * toR;
    var la1 = a.lat * toR, la2 = b.lat * toR;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function crossTrackNm(p) {
    // Distance to nearest segment of TRACK
    var best = Infinity;
    for (var i = 0; i < TRACK.length - 1; i++) {
      var a = TRACK[i], b = TRACK[i + 1];
      // Sample midpoint + endpoints as coarse XTE proxy
      var mid = { lat: (a.lat + b.lat) / 2, lon: (a.lon + b.lon) / 2 };
      best = Math.min(best, haversineNm(p, a), haversineNm(p, b), haversineNm(p, mid));
    }
    return best;
  }

  function paintGps(pos) {
    var el = $("gpsText");
    if (!el) return;
    if (!pos) {
      el.textContent = "Location unavailable · plotter primary";
      if ($("left")) $("left").textContent = "—";
      if ($("who")) $("who").textContent = "No GPS";
      return;
    }
    var xte = crossTrackNm({ lat: pos.coords.latitude, lon: pos.coords.longitude });
    var acc = pos.coords.accuracy ? (pos.coords.accuracy / 1852) : null;
    if (xte < 0.5) {
      el.textContent = "On planned track · " + xte.toFixed(1) + " nm";
      if ($("who")) $("who").textContent = "On track";
    } else {
      el.textContent = "Offset · " + xte.toFixed(1) + " nm from sketch track";
      if ($("who")) $("who").textContent = "Offset";
    }
    if ($("left")) $("left").textContent = xte.toFixed(1) + " nm";
    if (acc != null && acc > 0.3) {
      el.textContent += " · ±" + acc.toFixed(1) + " nm";
    }
  }

  function getTimes() {
    var depEl = $("dep");
    var leaveIn = $("leaveTime");
    var arriveIn = $("arriveTime");
    var dep = depEl ? +depEl.value : 400;
    if (leaveIn && leaveIn.value) {
      var lm = parseHHMM(leaveIn.value);
      if (lm != null) dep = lm;
    }
    var eta = dep + 315; // ~5h15 default passage
    if (arriveIn && arriveIn.value) {
      var am = parseHHMM(arriveIn.value);
      if (am != null) {
        eta = am;
        if (eta < dep) eta += 1440;
      }
    }
    var nowEl = $("t");
    var now = nowEl ? +nowEl.value : londonNowMin();
    return { dep: dep, eta: eta, now: now };
  }

  function paint() {
    var t = getTimes();
    paintClocks(t.dep, t.eta);
    paintGates(t.dep, t.eta);
    paintTide(t.dep, t.eta, t.now);
    paintWind(t.now);
    var src = $("srcNote");
    if (src) {
      var bits = ["Planning sketch. Not a chart. Plotter stays primary."];
      if (CUR && CUR.src) bits.push("Stream: model-based.");
      if (TIDE && TIDE.src) bits.push("Tide: official CD.");
      src.textContent = bits.join(" ");
    }
    setLive(!!(CUR || TIDE || WX));
  }

  function syncLeaveFromSlider() {
    if (syncing) return;
    syncing = true;
    var dep = +($("dep").value);
    var leaveIn = $("leaveTime");
    if (leaveIn) leaveIn.value = toTimeValue(dep);
    var arriveIn = $("arriveTime");
    if (arriveIn) {
      var am = parseHHMM(arriveIn.value);
      var depOld = parseHHMM(leaveIn ? leaveIn.value : "") || dep;
      // Keep duration if arrive already set
      var dur = 315;
      if (am != null) {
        var eta0 = am < dep ? am + 1440 : am;
        // On slider move, preserve previous duration from last paint
        dur = Math.max(60, (parseHHMM(arriveIn.dataset.dur) || 315));
      }
      if (!arriveIn.dataset.locked) {
        arriveIn.value = toTimeValue(dep + dur);
      }
    }
    syncing = false;
    paint();
  }

  function syncFromTimeInputs() {
    if (syncing) return;
    syncing = true;
    var leaveIn = $("leaveTime");
    var arriveIn = $("arriveTime");
    var dep = parseHHMM(leaveIn && leaveIn.value) ;
    if (dep == null) dep = 400;
    if ($("dep")) $("dep").value = String(dep);
    var eta = parseHHMM(arriveIn && arriveIn.value);
    if (eta == null) eta = dep + 315;
    if (eta < dep) eta += 1440;
    var dur = eta - dep;
    if (arriveIn) {
      arriveIn.dataset.dur = String(dur);
      arriveIn.dataset.locked = "1";
    }
    if ($("eta")) $("eta").textContent = hh(eta);
    syncing = false;
    paint();
  }

  function bind() {
    var dep = $("dep"), t = $("t");
    if (dep) {
      dep.addEventListener("input", syncLeaveFromSlider);
    }
    if (t) {
      t.addEventListener("input", paint);
    }
    var leaveIn = $("leaveTime"), arriveIn = $("arriveTime");
    if (leaveIn) leaveIn.addEventListener("change", syncFromTimeInputs);
    if (arriveIn) arriveIn.addEventListener("change", syncFromTimeInputs);

    GATES.forEach(function (g) {
      var el = $(g.chip);
      if (!el) return;
      el.addEventListener("click", function () {
        selectedGate = g.id;
        var times = getTimes();
        paintGateDetail(times.dep, times.eta);
      });
    });

    // Seed leave/arrive from London now if mid-afternoon (keep mock defaults morning)
    var now = londonNowMin();
    if ($("t")) $("t").value = String(now);
    if ($("dep") && $("leaveTime")) {
      $("leaveTime").value = toTimeValue(+$("dep").value);
      if ($("arriveTime")) {
        $("arriveTime").value = toTimeValue(+$("dep").value + 315);
        $("arriveTime").dataset.dur = "315";
      }
    }
  }

  function loadApis() {
    var ok = 0;
    function bump() {
      ok++;
      setLive(true);
      paint();
    }
    fetch("/api/streams", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { CUR = d; window.__CUR = d; bump(); })
      .catch(function () { paint(); });
    fetch("/api/tides", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { TIDE = d; bump(); })
      .catch(function () { paint(); });
    fetch("/api/wx?lat=49.30&lon=-2.43", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) {
        // server.py returns {ok, weather: hourly}; main.py returns {ok, data:{hourly}}
        WX = (d && d.weather) || (d && d.data && d.data.hourly) || (d && d.hourly) || null;
        bump();
      })
      .catch(function () { paint(); });
  }

  function bootGps() {
    var el = $("gpsText");
    if (!navigator.geolocation) {
      if (el) el.textContent = "GPS not available in this browser · plotter primary";
      return;
    }
    navigator.geolocation.getCurrentPosition(
      function (pos) { paintGps(pos); },
      function () {
        if (el) el.textContent = "Location denied · plotter primary";
        if ($("who")) $("who").textContent = "No GPS";
        if ($("left")) $("left").textContent = "—";
      },
      { enableHighAccuracy: true, maximumAge: 60000, timeout: 12000 }
    );
  }

  function boot() {
    bind();
    paint();
    loadApis();
    bootGps();
    setInterval(paint, 15000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
