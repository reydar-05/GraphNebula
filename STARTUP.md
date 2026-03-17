# GraphNebula — Local Startup Manual

Every time you open the project in a fresh terminal session, follow this guide.

---

## Prerequisites (check once)

| Tool | Minimum version | Check command |
|---|---|---|
| Docker Desktop | Any recent | `docker --version` |
| Python | 3.9+ | `python --version` |
| Node.js | 20+ | `node --version` |

Make sure **Docker Desktop is running** (system tray icon) before anything else.

---

## First-Time Setup

> Run this **once** after a fresh clone. Skip on subsequent sessions.

```powershell
# 1. Create virtual environment and install Python deps
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt

# 2. Install frontend dependencies
cd frontend
npm install
cd ..

# 3. Copy env template and fill in your values
copy .env.example .env
# Open .env in an editor and set your passwords

# 4. Start databases
docker compose up -d postgres neo4j redis

# Wait ~20 seconds, then verify all three are healthy:
docker compose ps

# 5. Run Alembic migrations (PostgreSQL schema)
$env:DATABASE_URL = 'postgresql://graphuser:YOUR_PASSWORD@localhost:5432/graphdb'
python -m alembic upgrade head

# 6. Initialise Neo4j constraints and indexes
$env:NEO4J_URI      = 'bolt://localhost:7687'
$env:NEO4J_PASSWORD = 'YOUR_PASSWORD'
python database/init_neo4j.py
```

---

## Every-Session Startup

Open **4 PowerShell windows** (or tabs). Run each block in its own window, **in order**.

---

### Terminal 1 — Databases

```powershell
cd C:\Users\renu0\OneDrive\Documents\GraphNebula
docker compose up -d postgres neo4j redis
docker compose ps
```

Wait until all three services show **"healthy"** in the STATUS column before proceeding.

---

### Terminal 2 — Backend API (uvicorn)

```powershell
cd C:\Users\renu0\OneDrive\Documents\GraphNebula
venv\Scripts\activate

$env:DATABASE_URL    = 'postgresql://graphuser:Renu894505&&@localhost:5432/graphdb'
$env:NEO4J_URI       = 'bolt://localhost:7687'
$env:NEO4J_PASSWORD  = 'Renu894505&&'
$env:REDIS_HOST      = 'localhost'
$env:ALLOWED_ORIGINS = 'http://localhost:5173'
$env:API_KEY         = 'graphnebula-dev-key'

uvicorn backend.main:app --reload
```

**Ready when you see:** `Application startup complete.`

> Keep this terminal open. It hot-reloads on file changes.

---

### Terminal 3 — Celery Worker (background tasks)

```powershell
cd C:\Users\renu0\OneDrive\Documents\GraphNebula
venv\Scripts\activate

$env:DATABASE_URL   = 'postgresql://graphuser:Renu894505&&@localhost:5432/graphdb'
$env:NEO4J_URI      = 'bolt://localhost:7687'
$env:NEO4J_PASSWORD = 'Renu894505&&'
$env:REDIS_HOST     = 'localhost'
$env:API_KEY        = 'graphnebula-dev-key'

celery -A backend.worker.celery_app worker --loglevel=info --pool=solo
```

**Ready when you see:** `celery@YourPC ready.`

> **Windows note:** `--pool=solo` is required on Windows. Do not use `--pool=prefork`.

---

### Terminal 4 — Frontend (Vite dev server)

```powershell
cd C:\Users\renu0\OneDrive\Documents\GraphNebula\frontend
npm run dev
```

**Ready when you see:** `Local: http://localhost:5173/`

Open **http://localhost:5173** in your browser.

---

### Terminal 5 — MLflow (optional)

Only needed when you want to inspect GraphSAGE training runs in the MLflow UI.

```powershell
cd C:\Users\renu0\OneDrive\Documents\GraphNebula
venv\Scripts\activate
mlflow server --host 0.0.0.0 --port 5000
```

Open **http://localhost:5000** to see the experiment tracker.

---

## Quick Health Check

After Terminals 2–4 are running, verify everything works:

```powershell
# Should return JSON with "postgres":"ok", "neo4j":"ok", "redis":"ok"
Invoke-WebRequest `
  -Uri "http://localhost:8000/health" `
  -Headers @{"X-API-Key" = "graphnebula-dev-key"} |
  Select-Object -ExpandProperty Content
```

---

## Service Map

| Service | URL | Purpose |
|---|---|---|
| Frontend | http://localhost:5173 | Main app UI |
| Backend API | http://localhost:8000 | REST API |
| API Docs (Swagger) | http://localhost:8000/docs | Interactive API explorer |
| Neo4j Browser | http://localhost:7474 | Graph database UI |
| MLflow UI | http://localhost:5000 | ML experiment tracking |
| Prometheus metrics | http://localhost:8000/metrics | Raw Prometheus scrape |

---

## Shutdown

```powershell
# Stop databases but keep all data intact (fastest, use this normally)
docker compose stop postgres neo4j redis

# Stop AND delete all stored data (use only for a completely fresh start)
docker compose down -v
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `uvicorn: command not found` | Run `venv\Scripts\activate` first |
| `FATAL: password authentication failed` | Check your `$env:DATABASE_URL` value — use single quotes around the password |
| Celery PermissionError on Windows | Make sure you're using `--pool=solo` |
| Neo4j takes too long to start | Wait 30–60s; it's slow to initialise. Check: `docker compose ps` |
| Frontend shows blank/broken UI | Make sure `frontend/.env` has `VITE_API_KEY=graphnebula-dev-key` |
| Graph not refreshing after algorithm | Click the **↻ Refresh** button in the Network Graph panel |
