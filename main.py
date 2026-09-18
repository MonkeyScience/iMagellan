from fastapi import FastAPI, Query
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import httpx

ROOT = Path(__file__).resolve().parent
app = FastAPI(title="iMagellan")

@app.get("/api/health")
def health():
    return {"ok": True, "name": "iMagellan"}

@app.get("/api/wx")
async def wx(lat: float = Query(49.22), lon: float = Query(-2.38)):
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": "wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m",
        "hourly": "wind_speed_10m,wind_direction_10m,wind_gusts_10m",
        "wind_speed_unit": "kn",
        "timezone": "Europe/London",
        "forecast_days": 1,
    }
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            r = await client.get(url, params=params)
            r.raise_for_status()
            data = r.json()
        return {"ok": True, "source": "open-meteo", "data": data}
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=502)

@app.get("/")
def root():
    return FileResponse(ROOT / "index.html")

app.mount("/", StaticFiles(directory=str(ROOT), html=True), name="static")
