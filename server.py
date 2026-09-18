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
