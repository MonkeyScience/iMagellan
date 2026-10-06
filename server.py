from pathlib import Path
import math
import os
import time
from datetime import datetime, timedelta, timezone
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

_CACHE = {"t": 0, "data": None, "ttl": 900}
_IBI_ERR = {"msg": "ibi disabled — 503 on 1GB worker"}

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


def _smoc_payload_from_raw(raw):
    blocks = raw if isinstance(raw, list) else [raw]
    stations = []
    for i, pt in enumerate(STREAM_PTS):
        block = blocks[i] if i < len(blocks) else {}
        fl = STREAM_FLOOD.get(pt[0])
        stations.append({
            "id": pt[0],
            "lat": pt[1],
            "lon": pt[2],
            "flood": fl[0] if fl else None,
            "flood_src": fl[1] if fl else None,
            "hours": _hours_to_rows(block),
        })
    return {
        "ok": True,
        "src": SMOC_SRC,
        "stations": stations,
    }


# ---------------------------------------------------------------------------
# Tides: live, dated HW/LW feed (chart datum), cached in memory.
#
# St Peter Port : States of Guernsey 2026 tide table, https://gov.gg/tides
#                 (published in GMT for the whole year; converted to UTC).
# Saint-Malo    : SHOM predictions as reproduced by maree.info (port 52),
#                 https://maree.info/52 . Each day row carries its own
#                 "UTC+2"/"UTC+1" label (French legal time), which is applied,
#                 so the CEST-vs-UK offset error of the old table cannot recur.
# Fallback      : Open-Meteo marine sea_level_height_msl (Meteo-France SMOC),
#                 calibrated to chart datum. Used ONLY where the official
#                 source has no events, and every such event is flagged
#                 "src": "model" so the UI can label it a MODEL ESTIMATE.
#
# Calibration of the model (fitted 2026-10-06, see accuracy-check-2026-10-06.md):
#   SPP     : 73 HW/LW, 26 Sep-15 Oct 2026 vs gov.gg. Model extremes are
#             35 min early (sd 5 min). CD = 1.000*MSL + 5.68 m (rms 0.14 m, max 0.34 m).
#   St-Malo : 27 HW/LW, 6-12 Oct 2026 vs SHOM/maree.info. 36 min early
#             (sd 7 min). CD = 0.971*MSL + 7.37 m (rms 0.11 m, max 0.21 m).
#
# Never clamps: the API only returns real events; clients must treat any time
# outside [valid_from, valid_to] as "tide data unavailable".
# ---------------------------------------------------------------------------
import asyncio
import html as _html
import re

TIDE_UA = "Mozilla/5.0 (compatible; iMagellan tide feed; +https://sea-turtle-app-558al.ondigitalocean.app)"
TIDE_OFFICIAL_TTL = 6 * 3600
TIDE_RETRY = 900
TIDE_MODEL_TTL = 3 * 3600
TIDE_PAST_H = 36
TIDE_AHEAD_D = 10

_FR_MONTHS = {
    "janvier": 1, "fevrier": 2, "février": 2, "mars": 3, "avril": 4, "mai": 5, "juin": 6,
    "juillet": 7, "aout": 8, "août": 8, "septembre": 9, "octobre": 10, "novembre": 11,
    "decembre": 12, "décembre": 12,
}


def _last_sunday(year, month):
    d = datetime(year, month + 1, 1, tzinfo=timezone.utc) - timedelta(days=1) if month < 12 else datetime(year, 12, 31, tzinfo=timezone.utc)
    return d - timedelta(days=(d.weekday() + 1) % 7)


def _london_offset_h(dt_utc):
    """UK legal time: BST (UTC+1) from 01:00 UTC last Sunday of March to 01:00 UTC last Sunday of October."""
    y = dt_utc.year
    start = _last_sunday(y, 3).replace(hour=1)
    end = _last_sunday(y, 10).replace(hour=1)
    return 1 if start <= dt_utc < end else 0


def _iso_local(dt_utc):
    off = _london_offset_h(dt_utc)
    loc = dt_utc + timedelta(hours=off)
    return loc.strftime("%Y-%m-%dT%H:%M") + ("+01:00" if off else "+00:00")


def _iso_utc(dt_utc):
    return dt_utc.strftime("%Y-%m-%dT%H:%MZ")


def _parse_govgg(text):
    rows = re.findall(r"<tr>\s*<td>(\d\d)/(\d\d)/(\d{4})</td>(.*?)</tr>", text, re.S)
    raw = []
    for d, m, y, rest in rows:
        cells = [_html.unescape(re.sub(r"<[^>]+>", "", c)).strip() for c in re.findall(r"<td[^>]*>(.*?)</td>", rest, re.S)]
        for k in range(0, len(cells) - 1, 2):
            mm = re.match(r"^(\d{1,2}):(\d\d)$", cells[k])
            if not mm:
                continue
            try:
                h = float(cells[k + 1])
            except ValueError:
                continue
            # The gov.gg table is published in GMT all year.
            raw.append((datetime(int(y), int(m), int(d), int(mm.group(1)), int(mm.group(2)), tzinfo=timezone.utc), h))
    raw.sort(key=lambda e: e[0])
    out = []
    for i, (t, h) in enumerate(raw):
        nb = [raw[j][1] for j in (i - 1, i + 1) if 0 <= j < len(raw)]
        if nb and all(h > x for x in nb):
            out.append((t, "HW", h))
        elif nb and all(h < x for x in nb):
            out.append((t, "LW", h))
    return out


def _parse_maree_info(text):
    hdr = re.search(r'id="MareeEnteteJour"[^>]*><b[^>]*>\s*\w+\s+(\d{1,2})\s+([^\s<]+)\s+(\d{4})', text)
    if not hdr:
        return []
    mon = _FR_MONTHS.get(_html.unescape(hdr.group(2)).lower())
    if not mon:
        return []
    cur = datetime(int(hdr.group(3)), mon, int(hdr.group(1)))
    rows = re.findall(r'<tr class="MJ[^"]*" id="MareeJours_(\d+)" title="UTC([+-]\d+)"[^>]*>(.*?)</tr>', text, re.S)
    out = []
    first = True
    for _idx, off, body in rows:
        day = re.search(r"<b>(\d{1,2})</b>", body)
        if not day:
            continue
        if first:
            if int(day.group(1)) != cur.day:
                return []
            first = False
        else:
            cur = cur + timedelta(days=1)
            if cur.day != int(day.group(1)):
                break
        tds = re.findall(r"<td>(.*?)</td>", body, re.S)
        if len(tds) < 2:
            continue
        tz = timezone(timedelta(hours=int(off)))
        for t, h in zip(tds[0].split("<br>"), tds[1].split("<br>")):
            tt = re.search(r"(\d{1,2})h(\d\d)", t)
            hh = re.search(r"(\d+),(\d+)m", h)
            if not tt or not hh:
                continue
            loc = datetime(cur.year, cur.month, cur.day, int(tt.group(1)), int(tt.group(2)), tzinfo=tz)
            # Bold = pleine mer (HW), plain = basse mer (LW).
            out.append((loc.astimezone(timezone.utc), "HW" if "<b>" in t else "LW", float(hh.group(1) + "." + hh.group(2))))
    return out


TIDE_PORTS = [
    {
        "id": "spp",
        "name": "St Peter Port",
        "lat": 49.4567,
        "lon": -2.5233,
        "official": "States of Guernsey tide table (gov.gg/tides, GMT→UK time)",
        "url": "https://gov.gg/tides",
        "parse": _parse_govgg,
        "model": {"lat": 49.4567, "lon": -2.5233, "dt_min": 35, "a": 1.000, "b": 5.68},
    },
    {
        "id": "sablons",
        "name": "Saint-Malo",
        "lat": 48.6407,
        "lon": -2.0285,
        "official": "SHOM predictions via maree.info/52 (French time→UK time)",
        "url": "https://maree.info/52",
        "parse": _parse_maree_info,
        "model": {"lat": 48.6407, "lon": -2.0285, "dt_min": 36, "a": 0.971, "b": 7.37},
    },
]
MODEL_LABEL = "MODEL ESTIMATE · Open-Meteo SMOC sea level calibrated to CD · not official"

_TIDE = {p["id"]: {"events": {}, "fetched": 0.0, "next_try": 0.0, "err": None} for p in TIDE_PORTS}
_TMODEL = {p["id"]: {"events": [], "fetched": 0.0, "next_try": 0.0, "err": None} for p in TIDE_PORTS}
_TIDE_LOCK = asyncio.Lock()


async def _fetch_text(url):
    async with httpx.AsyncClient(timeout=20, follow_redirects=True, headers={"User-Agent": TIDE_UA, "Accept-Language": "en-GB,fr;q=0.8"}) as c:
        r = await c.get(url)
        r.raise_for_status()
        return r.text


async def _refresh_official(port):
    st = _TIDE[port["id"]]
    now = time.time()
    if now - st["fetched"] < TIDE_OFFICIAL_TTL or now < st["next_try"]:
        return
    if port["id"] in os.environ.get("TIDE_FORCE_MODEL", "").split(","):
        st["err"] = "official source disabled by TIDE_FORCE_MODEL (test switch)"
        st["next_try"] = now + TIDE_RETRY
        return
    try:
        ev = port["parse"](await _fetch_text(port["url"]))
        if len(ev) < 4:
            raise ValueError("no tide rows parsed")
        cutoff = datetime.now(timezone.utc) - timedelta(days=3)
        merged = {k: v for k, v in st["events"].items() if v[0] >= cutoff}
        for e in ev:
            merged[_iso_utc(e[0])] = e
        st["events"] = merged
        st["fetched"] = now
        st["err"] = None
    except Exception as e:  # keep previous events; they still carry their own dates
        st["err"] = f"{type(e).__name__}: {e}"[:200]
        st["next_try"] = now + TIDE_RETRY


def _model_extremes(times, vals, m):
    out = []
    for i in range(1, len(vals) - 1):
        a, b, c = vals[i - 1], vals[i], vals[i + 1]
        if a is None or b is None or c is None:
            continue
        if (b > a and b >= c) or (b < a and b <= c):
            den = a - 2 * b + c
            x = 0.5 * (a - c) / den if den else 0.0
            h = b - 0.25 * (a - c) * x
            t = datetime.fromisoformat(times[i]).replace(tzinfo=timezone.utc) + timedelta(hours=x, minutes=m["dt_min"])
            out.append((t, "HW" if b > a else "LW", round(m["a"] * h + m["b"], 2)))
    return out


async def _refresh_model(port):
    st = _TMODEL[port["id"]]
    now = time.time()
    if now - st["fetched"] < TIDE_MODEL_TTL or now < st["next_try"]:
        return
    m = port["model"]
    url = (
        "https://marine-api.open-meteo.com/v1/marine"
        f"?latitude={m['lat']}&longitude={m['lon']}"
        "&hourly=sea_level_height_msl&timezone=GMT&past_days=2&forecast_days=10"
    )
    try:
        async with httpx.AsyncClient(timeout=20) as c:
            d = (await c.get(url)).json()
        h = d.get("hourly") or {}
        ev = _model_extremes(h.get("time") or [], h.get("sea_level_height_msl") or [], m)
        if len(ev) < 4:
            raise ValueError("no model extremes")
        st["events"] = ev
        st["fetched"] = now
        st["err"] = None
    except Exception as e:
        st["err"] = f"{type(e).__name__}: {e}"[:200]
        st["next_try"] = now + TIDE_RETRY


def _ev_json(e, src):
    return {"t": _iso_local(e[0]), "utc": _iso_utc(e[0]), "type": e[1], "h": round(e[2], 2), "src": src}


def _port_payload(port, now_utc):
    off = sorted(_TIDE[port["id"]]["events"].values(), key=lambda e: e[0])
    lo = now_utc - timedelta(hours=TIDE_PAST_H)
    hi = now_utc + timedelta(days=TIDE_AHEAD_D)
    rows = [(e, "official") for e in off]
    model = _TMODEL[port["id"]]["events"]
    if model:
        if off:
            first, last = off[0], off[-1]
            before = [e for e in model if e[0] < first[0] - timedelta(hours=2)]
            after = [e for e in model if e[0] > last[0] + timedelta(hours=2)]
            if before and before[-1][1] == first[1]:
                before = before[:-1]
            if after and after[0][1] == last[1]:
                after = after[1:]
            rows = [(e, "model") for e in before] + rows + [(e, "model") for e in after]
        else:
            rows = [(e, "model") for e in model]
    rows = [r for r in rows if lo <= r[0][0] <= hi]
    events = [_ev_json(e, s) for e, s in rows]
    covered = len(rows) >= 2 and rows[0][0][0] <= now_utc <= rows[-1][0][0]
    srcs = {s for _, s in rows}
    kind = "unavailable" if not covered else ("official" if srcs == {"official"} else ("model" if srcs == {"model"} else "mixed"))
    return {
        "id": port["id"],
        "name": port["name"],
        "lat": port["lat"],
        "lon": port["lon"],
        "kind": kind,
        "src": port["official"] if kind == "official" else (MODEL_LABEL if kind == "model" else (port["official"] + " + " + MODEL_LABEL if kind == "mixed" else "no tide data covers now")),
        "official_src": port["official"],
        "official_url": port["url"],
        "official_err": _TIDE[port["id"]]["err"],
        "valid_from": events[0]["t"] if events else None,
        "valid_to": events[-1]["t"] if events else None,
        "hours_ahead": round((rows[-1][0][0] - now_utc).total_seconds() / 3600, 1) if rows else 0,
        "events": events,
    }


async def _tides_payload():
    now_utc = datetime.now(timezone.utc)
    async with _TIDE_LOCK:
        await asyncio.gather(*[_refresh_official(p) for p in TIDE_PORTS])
        for p in TIDE_PORTS:
            off = list(_TIDE[p["id"]]["events"].values())
            need = (not off) or max(e[0] for e in off) < now_utc + timedelta(hours=36) or min(e[0] for e in off) > now_utc - timedelta(hours=6)
            if need:
                await _refresh_model(p)
    ports = [_port_payload(p, now_utc) for p in TIDE_PORTS]
    kinds = {p["kind"] for p in ports}
    return {
        "ok": all(p["kind"] != "unavailable" for p in ports),
        "src": " · ".join(p["name"] + ": " + p["src"] for p in ports) + " · Chart Datum · not for navigation",
        "datum": "CD",
        "tz": "Europe/London",
        "generated": _iso_local(now_utc),
        "kinds": sorted(kinds),
        "ports": ports,
    }


# Flood set per stream station (degrees TRUE, direction the stream sets TOWARD).
# Clients keep each arrow on the station's fixed model axis and use this only to
# decide which half of the axis is "flood". Sources:
#   ref   = published reference (see accuracy-check-2026-10-06.md §4):
#           Little Russell / SPP: chart 808 diamond C, NE-going 033° on the flood.
#           Alderney Race: NE/N-going on the flood (Univ. Southampton; PMC8278971).
#           Minquiers W: E/SE-going on the rising tide (Jersey Kayak Adventures).
#   model = no free published reference: the half of the SMOC axis that runs on
#           the rising tide (Gulf of St-Malo stations, validated against the
#           Russell and Minquiers references), or that runs in phase with the
#           Race NE-going flood (Race/Casquets/W Cotentin stations).
STREAM_FLOOD = {
    "spp": (33, "ref: chart 808 diamond C"),
    "russell": (33, "ref: chart 808 diamond C"),
    "race": (30, "ref: Alderney Race NE-going flood"),
    "minqw": (120, "ref: Minquiers E/SE-going on rising tide"),
    "bigruss": (17, "model: in phase with Race flood"),
    "alderney": (34, "model: in phase with Race flood"),
    "casquets": (24, "model: in phase with Race flood"),
    "carteret": (332, "model: in phase with Race flood"),
    "dielette": (355, "model: in phase with Race flood"),
    "wjersey": (153, "model: sets on rising tide"),
    "helier": (99, "model: sets on rising tide"),
    "ecrehous": (131, "model: sets on rising tide"),
    "minqe": (75, "model: sets on rising tide"),
    "mid": (123, "model: sets on rising tide"),
    "sablons": (82, "model: sets on rising tide (cell 9 nm offshore)"),
    "granville": (60, "model: sets on rising tide"),
}


@app.get("/api/health")
def health():
    user, pwd = _cmems_creds()
    src = (_CACHE.get("data") or {}).get("src")
    return {
        "ok": True,
        "app": "iMagellan",
        "ibi_creds": bool(user and pwd),
        "streams_src": src,
        "ibi_err": _IBI_ERR.get("msg"),
        "tides": {
            p["id"]: {
                "official_events": len(_TIDE[p["id"]]["events"]),
                "official_err": _TIDE[p["id"]]["err"],
                "last_event": _iso_local(max(e[0] for e in _TIDE[p["id"]]["events"].values())) if _TIDE[p["id"]]["events"] else None,
                "ok_48h": bool(_TIDE[p["id"]]["events"]) and max(e[0] for e in _TIDE[p["id"]]["events"].values()) > datetime.now(timezone.utc) + timedelta(hours=48),
            }
            for p in TIDE_PORTS
        },
    }


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
        hourly = (w or {}).get("hourly")
        if not hourly:
            return JSONResponse(
                {"ok": False, "error": (w or {}).get("reason") or "no hourly wind"},
                status_code=502,
            )
        return {"ok": True, "weather": hourly}
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=502)


@app.get("/api/streams")
async def streams():
    now = time.time()
    ttl = _CACHE.get("ttl") or 900
    if _CACHE["data"] and now - _CACHE["t"] < ttl:
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
        payload = _smoc_payload_from_raw(raw)
        _CACHE["t"] = now
        _CACHE["data"] = payload
        _CACHE["ttl"] = 900
        return payload
    except Exception as e:
        if _CACHE["data"]:
            return _CACHE["data"]
        return JSONResponse({"ok": False, "error": str(e)}, status_code=502)


@app.get("/api/tides")
async def tides():
    return await _tides_payload()


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


_STATIC_TYPES = {
    ".js": "application/javascript",
    ".css": "text/css",
    ".html": "text/html",
    ".svg": "image/svg+xml",
    ".webmanifest": "application/manifest+json",
    ".json": "application/json",
    ".png": "image/png",
    ".ico": "image/x-icon",
}


@app.get("/brief-app.js")
def brief_app_js():
    f = ROOT / "brief-app.js"
    if f.exists():
        return FileResponse(f, media_type="application/javascript")
    return JSONResponse({"ok": False, "error": "brief-app.js missing"}, status_code=404)


@app.get("/map.html")
def map_html():
    f = ROOT / "map.html"
    if f.exists():
        return FileResponse(f, media_type="text/html")
    return JSONResponse({"ok": False, "error": "map.html missing"}, status_code=404)




@app.get("/cdn-map-shell.css")
def cdn_map_shell_css():
    f = ROOT / "cdn-map-shell.css"
    if f.exists():
        return FileResponse(f, media_type="text/css")
    return JSONResponse({"ok": False, "error": "cdn-map-shell.css missing"}, status_code=404)

def _shell_js(name: str):
    f = ROOT / name
    if f.exists():
        return FileResponse(f, media_type="application/javascript")
    return JSONResponse({"ok": False, "error": f"{name} missing"}, status_code=404)

@app.get("/cdn-map-shell.p0.js")
def cdn_map_shell_p0():
    return _shell_js("cdn-map-shell.p0.js")

@app.get("/cdn-map-shell.p1.js")
def cdn_map_shell_p1():
    return _shell_js("cdn-map-shell.p1.js")

@app.get("/cdn-map-shell.p2.js")
def cdn_map_shell_p2():
    return _shell_js("cdn-map-shell.p2.js")

@app.get("/cdn-map-shell.p3.js")
def cdn_map_shell_p3():
    return _shell_js("cdn-map-shell.p3.js")

@app.get("/cdn-map-shell.html")
def cdn_map_shell():
    f = ROOT / "cdn-map-shell.html"
    if f.exists():
        return FileResponse(f, media_type="text/html")
    return JSONResponse({"ok": False, "error": "cdn-map-shell.html missing"}, status_code=404)

@app.get("/capture-map.html")
def capture_map():
    f = ROOT / "capture-map.html"
    if f.exists():
        return FileResponse(f, media_type="text/html")
    return JSONResponse({"ok": False, "error": "capture-map.html missing"}, status_code=404)

@app.get("/{name}")
def static_asset(name: str):
    """Serve known root assets for the phone-first brief (and PWA bits)."""
    if "/" in name or name.startswith(".") or ".." in name:
        return JSONResponse({"ok": False, "error": "not found"}, status_code=404)
    allowed = {
        "brief-app.js", "brief-app.b.js", "brief-app.a.js", "app.js", "brief.js", "scales.js", "inject.js", "map.js",
        "client.js", "sw.js", "icon.svg", "manifest.webmanifest", "map.html",
        "index.html", "brief.css", "cdn-map-shell.html", "cdn-map-shell.css", "capture-map.html",
        "cdn-map-shell.p0.js", "cdn-map-shell.p1.js", "cdn-map-shell.p2.js", "cdn-map-shell.p3.js",
        "cdn-map-shell.app.js", "cdn-map-shell.part0.js", "cdn-map-shell.part1.js",
        "cdn-map-shell.part2.js", "cdn-map-shell.part3.js", "cdn-map-shell.part4.js", "cdn-map-shell.part5.js",
        "cdn-map-shell.part6.js", "cdn-map-shell.part7.js",
        "cdn-map-shell.a1.js",
    }
    if name not in allowed:
        return JSONResponse({"ok": False, "error": "not found"}, status_code=404)
    f = ROOT / name
    if not f.is_file():
        return JSONResponse({"ok": False, "error": "missing"}, status_code=404)
    media = _STATIC_TYPES.get(f.suffix.lower(), "application/octet-stream")
    return FileResponse(f, media_type=media)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8080")))
