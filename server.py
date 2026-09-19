from pathlib import Path
import os
import time
from fastapi import FastAPI, Query
from fastapi.responses import FileResponse, JSONResponse
import httpx

ROOT = Path(__file__).parent
app = FastAPI(title="iMagellan")

STREAM_PTS = [
    ("spp", 49.4567, -2.5233),
    ("russell", 49.4300, -2.5200),
    ("bigruss", 49.4300, -2.4200),
    ("wjersey", 49.2000, -2.4000),
    ("helier", 49.1800, -2.1200),
    ("ecrehous", 49.2900, -1.9300),
    ("alderney", 49.7200, -2.2000),
    ("race", 49.7100, -2.0800),
    ("casquets", 49.7200, -2.3700),
    ("minqw", 48.9700, -2.3200),
    ("minqe", 48.9500, -1.9500),
    ("mid", 49.0800, -2.2200),
    ("sablons", 48.6407, -2.0285),
    ("carteret", 49.3750, -1.8000),
    ("granville", 48.8350, -1.6000),
    ("dielette", 49.5510, -1.8600),
]

_CACHE = {"t": 0, "data": None}


def _hours_to_rows(block):
    h = (block or {}).get("hourly") or {}
    times = h.get("time") or []
    kn = h.get("ocean_current_velocity") or []
    di = h.get("ocean_current_direction") or []
    sl = h.get("sea_level_height_msl") or []
    rows = []
    for i, ts in enumerate(times):
        try:
            hh, mm = ts.split("T")[1].split(":")
            minute = int(hh) * 60 + int(mm or 0)
            if i >= 24:
                minute += 1440
        except Exception:
            continue
        rows.append({
            "min": minute,
            "kn": kn[i] if i < len(kn) else None,
            "dir": di[i] if i < len(di) else None,
            "sl": sl[i] if i < len(sl) else None,
        })
    return rows


def _ev(t, typ, h):
    return {"t": t, "type": typ, "h": h}


# Official Chart Datum extrema, local time (BST).
# SPP: Jersey Met / National Oceanography Centre (copyright reserved).
# Saint-Malo: SHOM via saintmaloinfo (auth 2026-008).
# Planning overlay only — not a navigation product.
OFFICIAL_TIDES = {
    "ok": True,
    "src": "Jersey Met/NOC + SHOM · Chart Datum · not for navigation",
    "datum": "CD",
    "tz": "Europe/London",
    "ports": [
        {
            "id": "spp",
            "name": "St Peter Port",
            "lat": 49.4567,
            "lon": -2.5233,
            "events": [
                _ev("2026-09-18T23:27", "HW", 6.9),
                _ev("2026-09-19T05:35", "LW", 4.0),
                _ev("2026-09-19T11:50", "HW", 6.7),
                _ev("2026-09-19T18:15", "LW", 4.2),
                _ev("2026-09-20T00:22", "HW", 6.3),
                _ev("2026-09-20T06:46", "LW", 4.6),
                _ev("2026-09-20T13:12", "HW", 6.3),
                _ev("2026-09-20T20:08", "LW", 4.5),
                _ev("2026-09-21T02:33", "HW", 6.1),
                _ev("2026-09-21T08:59", "LW", 4.6),
                _ev("2026-09-21T15:33", "HW", 6.4),
                _ev("2026-09-21T21:56", "LW", 4.2),
                _ev("2026-09-22T04:23", "HW", 6.6),
                _ev("2026-09-22T10:35", "LW", 4.1),
                _ev("2026-09-22T16:43", "HW", 7.0),
                _ev("2026-09-22T23:06", "LW", 3.5),
                _ev("2026-09-23T05:14", "HW", 7.2),
                _ev("2026-09-23T11:29", "LW", 3.4),
                _ev("2026-09-23T17:29", "HW", 7.7),
                _ev("2026-09-23T23:52", "LW", 2.8),
                _ev("2026-09-24T05:54", "HW", 7.9),
                _ev("2026-09-24T12:11", "LW", 2.7),
                _ev("2026-09-24T18:10", "HW", 8.3),
                _ev("2026-09-25T00:32", "LW", 2.2),
                _ev("2026-09-25T06:33", "HW", 8.4),
                _ev("2026-09-25T12:50", "LW", 2.1),
                _ev("2026-09-25T18:48", "HW", 8.8),
            ],
        },
        {
            "id": "sablons",
            "name": "Saint-Malo",
            "lat": 48.6407,
            "lon": -2.0285,
            "coeff": 28,
            "events": [
                _ev("2026-09-18T23:58", "HW", 8.98),
                _ev("2026-09-19T06:34", "LW", 4.99),
                _ev("2026-09-19T12:17", "HW", 8.74),
                _ev("2026-09-19T19:12", "LW", 5.24),
                _ev("2026-09-20T00:55", "HW", 8.13),
                _ev("2026-09-20T07:35", "LW", 5.69),
                _ev("2026-09-20T13:57", "HW", 8.02),
                _ev("2026-09-20T20:50", "LW", 5.70),
                _ev("2026-09-21T03:26", "HW", 7.88),
                _ev("2026-09-21T10:01", "LW", 5.85),
                _ev("2026-09-21T16:19", "HW", 8.30),
                _ev("2026-09-21T23:03", "LW", 5.22),
                _ev("2026-09-22T04:58", "HW", 8.55),
                _ev("2026-09-22T11:39", "LW", 5.05),
                _ev("2026-09-22T17:24", "HW", 9.14),
                _ev("2026-09-23T00:06", "LW", 4.29),
                _ev("2026-09-23T05:49", "HW", 9.45),
                _ev("2026-09-23T12:30", "LW", 4.10),
                _ev("2026-09-23T18:09", "HW", 10.07),
                _ev("2026-09-24T00:52", "LW", 3.39),
                _ev("2026-09-24T06:30", "HW", 10.34),
                _ev("2026-09-24T13:13", "LW", 3.24),
                _ev("2026-09-24T18:48", "HW", 10.94),
                _ev("2026-09-25T01:34", "LW", 2.61),
                _ev("2026-09-25T07:08", "HW", 11.11),
                _ev("2026-09-25T13:54", "LW", 2.53),
                _ev("2026-09-25T19:26", "HW", 11.65),
            ],
        },
    ],
}


@app.get("/api/health")
def health():
    return {"ok": True, "app": "iMagellan"}


@app.get("/api/wx")
async def wx(lat: float = Query(49.30), lon: float = Query(-2.43)):
    wurl = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        "&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m"
        "&wind_speed_unit=kn&timezone=Europe/London&forecast_days=2"
    )
    try:
        async with httpx.AsyncClient(timeout=12) as c:
            w = (await c.get(wurl)).json()
        return {"ok": True, "weather": w.get("hourly")}
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=502)


@app.get("/api/streams")
async def streams():
    now = time.time()
    if _CACHE["data"] and now - _CACHE["t"] < 900:
        return _CACHE["data"]
    lats = ",".join(str(p[1]) for p in STREAM_PTS)
    lons = ",".join(str(p[2]) for p in STREAM_PTS)
    url = (
        "https://marine-api.open-meteo.com/v1/marine"
        f"?latitude={lats}&longitude={lons}"
        "&hourly=ocean_current_velocity,ocean_current_direction,sea_level_height_msl,wave_height"
        "&wind_speed_unit=kn&timezone=Europe/London&forecast_days=2"
    )
    try:
        async with httpx.AsyncClient(timeout=20) as c:
            raw = (await c.get(url)).json()
        blocks = raw if isinstance(raw, list) else [raw]
        stations = []
        for i, pt in enumerate(STREAM_PTS):
            block = blocks[i] if i < len(blocks) else {}
            stations.append({
                "id": pt[0],
                "lat": pt[1],
                "lon": pt[2],
                "hours": _hours_to_rows(block),
            })
        payload = {
            "ok": True,
            "src": "Open-Meteo marine · Meteo-France SMOC tides+currents 8 km",
            "stations": stations,
        }
        _CACHE["t"] = now
        _CACHE["data"] = payload
        return payload
    except Exception as e:
        if _CACHE["data"]:
            return _CACHE["data"]
        return JSONResponse({"ok": False, "error": str(e)}, status_code=502)


@app.get("/api/tides")
def tides():
    return OFFICIAL_TIDES


@app.get("/app.js")
def app_js():
    f = ROOT / "app.js"
    if f.exists():
        return FileResponse(f, media_type="application/javascript")
    return JSONResponse({"ok": False, "error": "app.js missing"}, status_code=404)


@app.get("/")
def root():
    page = ROOT / "index.html"
    if page.exists():
        return FileResponse(page)
    return JSONResponse({"ok": True, "app": "iMagellan", "hint": "index.html missing"})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8080")))
