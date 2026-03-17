# GraphNebula — Production Deployment Guide

This guide deploys GraphNebula to a public URL using **entirely free-tier** cloud services.

---

## Why not Vercel alone?

Vercel is perfect for the React frontend, but the backend needs:
- A **persistent process** for FastAPI (not serverless — Celery workers can't run as functions)
- A **hosted graph database** (Neo4j)
- A **hosted Redis** (Celery broker)
- A **hosted PostgreSQL**

**Solution:** Vercel for the frontend + Render.com for the backend stack.

---

## Free-Tier Architecture

```
User Browser
     │
     ▼
┌─────────────────────┐
│  Vercel (Frontend)  │  https://graphnebula.vercel.app
│  React + Vite SPA   │
└──────────┬──────────┘
           │ HTTPS  (X-API-Key header)
           ▼
┌─────────────────────────┐
│  Render (Backend API)   │  https://graphnebula-api.onrender.com
│  FastAPI + uvicorn      │
└──────┬──────────────────┘
       │
       ├──────────────────────────────────────────┐
       │                                          │
┌──────▼──────────┐   ┌──────────────┐   ┌───────▼──────┐
│  Neo4j Aura     │   │  Render PG   │   │  Upstash     │
│  (Graph DB)     │   │  (PostgreSQL)│   │  (Redis)     │
│  Free forever   │   │  Free 90d    │   │  Free always │
└─────────────────┘   └──────────────┘   └──────────────┘
                                                  │
                                    ┌─────────────▼──────────┐
                                    │  Render (Celery Worker) │
                                    │  Background Worker      │
                                    └────────────────────────┘
```

---

## Step-by-Step Deployment

### Step 1 — Neo4j Aura (Graph Database)

1. Go to **https://console.neo4j.io** → Sign up free
2. Click **Create instance** → Choose **AuraDB Free**
3. Name it `graphnebula`
4. **Save the generated password** — you only see it once
5. Note your **Connection URI** (looks like `neo4j+s://xxxxxxxx.databases.neo4j.io`)

**Seed the constraints** (run locally, pointing at Aura):
```powershell
$env:NEO4J_URI      = 'neo4j+s://xxxxxxxx.databases.neo4j.io'
$env:NEO4J_PASSWORD = 'your-aura-password'
python database/init_neo4j.py
```

> Free tier limits: 50,000 nodes, 175,000 relationships.
> `facebook_combined.txt` has ~4,000 nodes — well within limits.

---

### Step 2 — Upstash Redis (Task Queue Broker)

1. Go to **https://upstash.com** → Sign up free
2. Click **Create Database** → Region: closest to you → Free tier
3. Copy the **Redis URL** (format: `rediss://default:password@host:port`)

> Free tier: 10,000 commands/day, 256 MB. Each algorithm run uses ~5–10 commands.

---

### Step 3 — Render PostgreSQL (Relational Database)

1. Go to **https://render.com** → Sign up → **New → PostgreSQL**
2. Name: `graphnebula-db` → Instance type: **Free**
3. Click **Create Database**
4. Copy the **External Database URL** (starts with `postgresql://`)

> Free tier: 1 GB, expires after **90 days**. After that, upgrade to $7/mo
> or migrate to [Supabase](https://supabase.com) (also free, no expiry).

---

### Step 4 — Render Web Service (FastAPI Backend)

1. **New → Web Service** → Connect GitHub → select `reydar-05/GraphNebula`
2. Configure:

| Setting | Value |
|---|---|
| **Name** | `graphnebula-api` |
| **Root directory** | *(leave blank — uses repo root)* |
| **Runtime** | Python 3 |
| **Build command** | `pip install -r requirements.txt` |
| **Start command** | `uvicorn backend.main:app --host 0.0.0.0 --port $PORT` |
| **Instance type** | Free |

3. **Add Environment Variables** (in the "Environment" section):

```
DATABASE_URL      = <External DB URL from Step 3>
NEO4J_URI         = <Aura URI from Step 1>
NEO4J_PASSWORD    = <Aura password from Step 1>
REDIS_HOST        = <Upstash host only, no redis:// prefix>
REDIS_URL         = <Full Upstash Redis URL from Step 2>
ALLOWED_ORIGINS   = https://graphnebula.vercel.app
API_KEY           = <choose a strong secret key>
MLFLOW_TRACKING_URI = http://localhost:5000
```

4. Click **Create Web Service** → wait for first deploy (~5 min)
5. Note your service URL: `https://graphnebula-api.onrender.com`

**Run migrations** via the Render Shell (Service → Shell tab):
```bash
python -m alembic upgrade head
```

---

### Step 5 — Render Background Worker (Celery)

1. **New → Background Worker** → same GitHub repo
2. Configure:

| Setting | Value |
|---|---|
| **Name** | `graphnebula-worker` |
| **Build command** | `pip install -r requirements.txt` |
| **Start command** | `celery -A backend.worker.celery_app worker --loglevel=info --concurrency=1` |
| **Instance type** | Free |

3. Add the **same environment variables** as the Web Service (Steps 3–4)
4. Click **Create Background Worker**

---

### Step 6 — Vercel (React Frontend)

1. Go to **https://vercel.com** → Sign up with GitHub
2. **Add New → Project** → Import `reydar-05/GraphNebula`
3. Configure:

| Setting | Value |
|---|---|
| **Root directory** | `frontend` |
| **Framework preset** | Vite |
| **Build command** | `npm run build` *(auto-detected)* |
| **Output directory** | `dist` *(auto-detected)* |

4. **Add Environment Variables**:

```
VITE_API_BASE_URL = https://graphnebula-api.onrender.com
VITE_API_KEY      = <same API key as Step 4>
```

5. Click **Deploy** → your app will be live at `https://graphnebula.vercel.app`

---

### Step 7 — Verify the Deployment

```powershell
# 1. Check backend health (replace with your Render URL)
Invoke-WebRequest `
  -Uri "https://graphnebula-api.onrender.com/health" `
  -Headers @{"X-API-Key" = "your-api-key"} |
  Select-Object -ExpandProperty Content

# Expected: {"api":"ok","postgres":"ok","neo4j":"ok","redis":"ok"}

# 2. Open the frontend
# https://graphnebula.vercel.app
# Upload facebook_combined.txt → run Louvain → should detect communities
```

---

## Auto-Deploy on Git Push

Both services auto-redeploy when you push to `main`:

```powershell
git push origin main
# → Vercel rebuilds frontend (~1 min)
# → Render rebuilds backend + worker (~3-5 min)
```

---

## Free Tier Limitations

| Limitation | Impact | Workaround |
|---|---|---|
| Render sleeps after 15 min idle | First request takes ~30s to wake | Acceptable for portfolio/demo |
| Neo4j Aura Free: 50k nodes | facebook_combined fits easily (4k nodes) | Use smaller datasets |
| Upstash: 10k Redis ops/day | ~1,000 algorithm runs/day | Sufficient for demo |
| Render PostgreSQL expires in 90 days | Need to migrate or upgrade | Migrate to Supabase free tier |
| Render free: 512 MB RAM | GraphSAGE may OOM (large graphs) | Use classical algorithms in production |

---

## Custom Domain (Optional)

1. Buy a domain (e.g. Namecheap ~$10/yr)
2. In Vercel: Project → Settings → Domains → Add your domain
3. Follow Vercel's DNS instructions (add CNAME record at your registrar)
4. Done — HTTPS is automatic

---

## Environment Variables Reference

| Variable | Where set | Description |
|---|---|---|
| `DATABASE_URL` | Render (backend + worker) | Full PostgreSQL connection string |
| `NEO4J_URI` | Render (backend + worker) | Neo4j Aura bolt URI |
| `NEO4J_PASSWORD` | Render (backend + worker) | Neo4j Aura password |
| `REDIS_URL` | Render (backend + worker) | Full Upstash Redis URL |
| `REDIS_HOST` | Render (backend + worker) | Upstash host (no protocol) |
| `API_KEY` | Render (backend + worker) | Shared secret for X-API-Key auth |
| `ALLOWED_ORIGINS` | Render (backend) | Your Vercel URL (comma-separated) |
| `VITE_API_BASE_URL` | Vercel (frontend) | Full Render backend URL |
| `VITE_API_KEY` | Vercel (frontend) | Same as `API_KEY` above |
