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
      }).formatToParts(new Date
/* ... truncated for size test ... */
l) el.textContent = "Location denied · plotter primary";
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
