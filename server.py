from pathlib import Path
import os
from fastapi import FastAPI, Query
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import httpx

ROOT = Path(__file__).parent
app = FastAPI(title="iMagellan")

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
    murl = (
        "https://marine-api.open-meteo.com/v1/marine"
        f"?latitude={lat}&longitude={lon}"
        "&hourly=wave_height,wave_direction,wave_period"
        "&timezone=Europe/London&forecast_days=2"
    )
    try:
        async with httpx.AsyncClient(timeout=12) as c:
            w, m = (await c.get(wurl)).json(), (await c.get(murl)).json()
        return {"ok": True, "weather": w.get("hourly"), "marine": m.get("hourly")}
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=502)

@app.get("/")
def root():
    page = ROOT / "index.html"
    if page.exists():
        return FileResponse(page)
    return JSONResponse({"ok": True, "app": "iMagellan", "hint": "index.html missing"})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8080")))
