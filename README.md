# iMagellan

Phone-first live passage briefing. First route: **St Peter Port → Les Sablons**.

**Not a chart. Plotter stays primary.**

Repo: https://github.com/MonkeyScience/iMagellan

## What you get

- Default `/` — Live Brief (status, leave/arrive, stream gates, wind rose, tide/sill, GPS strip, hard footer)
- `/map.html` — secondary legacy map shell (CDN-pinned) if you still want the old map path
- APIs: `/api/streams`, `/api/tides`, `/api/wx`, `/api/health`

Early build: stream is the 8 km Open-Meteo / SMOC model. Tide heights use official CD tables in `server.py`. Sablons sill **+2.0 m CD**.

## Local

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn server:app --host 0.0.0.0 --port 8080
# open http://127.0.0.1:8080/
```

## DigitalOcean App Platform

Preferred (APIs live): use `.do/app.yaml` — Python service running `uvicorn server:app`.

Static-only fallback: Static Site with index `index.html`. Brief UI still renders; API chips/tide/wind show placeholders until a backend is attached.

## Honesty

- `LIVE BRIEF` + `EARLY BUILD` always on screen
- Footer: `NOT A CHART · PLOTTER PRIMARY`
- GPS is context only — never nav authority
