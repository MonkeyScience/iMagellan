from pathlib import Path
import math
import os
import time
from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutTimeout
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

IBI_SRC = "MODEL · IBI · 2 km · not for navigation"
SMOC_SRC = "Open-Meteo marine · Meteo-France SMOC tides+currents 8 km"


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


def _cmems_creds():
    user = (
        os.environ.get("COPERNICUSMARINE_SERVICE_USERNAME")
        or os.environ.get("COPERNICUSMARINE_SERVICE_U")
        or ""
    ).strip()
    pwd = (
        os.environ.get("COPERNICUSMARINE_SERVICE_PASSWORD")
        or os.environ.get("COPERNICUSMARINE_SERVICE_P")
        or ""
    ).strip()
    return user, pwd


def _london_tz():
    try:
        from zoneinfo import ZoneInfo
        return ZoneInfo("Europe/London")
    except Exception:
        return timezone(timedelta(hours=1))


def _to_london_min(ts, today0, tz):
    if hasattr(ts, "to_pydatetime"):
        dt = ts.to_pydatetime()
    else:
        raw = str(ts)[:19]
        dt = datetime.fromisoformat(raw)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    local = dt.astimezone(tz)
    mid = local.replace(hour=0, minute=0, second=0, microsecond=0)
    off = int((mid - today0).total_seconds() // 86400)
    return off * 1440 + local.hour * 60 + local.minute


def _ibi_stations():
    user, pwd = _cmems_creds()
    if not user or not pwd:
        return None
    import copernicusmarine
    cred_dir = Path("/tmp/copernicusmarine")
    cred_dir.mkdir(parents=True, exist_ok=True)
    os.environ.setdefault("COPERNICUSMARINE_CREDENTIALS_DIRECTORY", str(cred_dir))
    tz = _london_tz()
    now = datetime.now(timezone.utc)
    start = (now - timedelta(hours=2)).strftime("%Y-%m-%dT%H:00:00")
    end = (now + timedelta(hours=36)).strftime("%Y-%m-%dT%H:00:00")
    ds = copernicusmarine.open_dataset(
        dataset_id="cmems_mod_ibi_phy_anfc_0.027deg-2D_PT1H-m",
        variables=["uo", "vo"],
        minimum_longitude=-2.80,
        maximum_longitude=-1.55,
        minimum_latitude=48.60,
        maximum_latitude=49.80,
        start_datetime=start,
        end_datetime=end,
        username=user,
        password=pwd,
    )
    lat_name = "latitude" if "latitude" in ds.coords else "lat"
    lon_name = "longitude" if "longitude" in ds.coords else "lon"
    times = ds.time.values
    today0 = datetime.now(tz).replace(hour=0, minute=0, second=0, microsecond=0)
    stations = []
    for sid, lat, lon in STREAM_PTS:
        pt = ds.sel({lat_name: lat, lon_name: lon}, method="nearest")
        uo = pt["uo"].squeeze()
        vo = pt["vo"].squeeze()
        hours = []
        for i, t in enumerate(times):
            try:
                u = float(uo.isel(time=i).values)
                v = float(vo.isel(time=i).values)
            except Exception:
                continue
            if not math.isfinite(u) or not math.isfinite(v):
                continue
            kn = math.hypot(u, v) * 1.943844
            deg = (math.degrees(math.atan2(u, v)) + 360.0) % 360.0
            hours.append({
                "min": _to_london_min(t, today0, tz),
                "kn": round(kn, 2),
                "dir": round(deg, 1),
                "sl": None,
            })
        hours.sort(key=lambda r: r["min"])
        if len(hours) < 6:
            continue
        stations.append({"id": sid, "lat": lat, "lon": lon, "hours": hours})
    if len(stations) < 6:
        return None
    return {
        "ok": True,
        "src": IBI_SRC,
        "stations": stations,
    }


def _smoc_payload_from_raw(raw):
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
    return {
        "ok": True,
        "src": SMOC_SRC,
        "stations": stations,
    }


def _ev(t, typ, h):
    return {"t": t, "type": typ, "h": h}


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
    user, pwd = _cmems_creds()
    return {"ok": True, "app": "iMagellan", "ibi_creds": bool(user and pwd)}


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
    user, pwd = _cmems_creds()
    if user and pwd:
        try:
            with ThreadPoolExecutor(max_workers=1) as ex:
                payload = ex.submit(_ibi_stations).result(timeout=25)
            if payload and payload.get("ok") and payload.get("stations"):
                _CACHE["t"] = now
                _CACHE["data"] = payload
                return payload
        except (FutTimeout, Exception):
            pass
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
        payload = _smoc_payload_from_raw(raw)
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
