# GraphNebula — Production Deployment Guide

Deploy the entire stack for **free**, with no service sleeping, no expiry dates, and no
juggling five different platforms. Everything runs on one cloud VM using the same
`docker-compose.yml` you already use locally.

---

## Architecture (2 services total)

```
User Browser
     │
     ▼
┌──────────────────────────┐
│  Vercel  (Frontend)      │  https://graphnebula.vercel.app
│  React + Vite — free     │  Auto-deploys on git push
└────────────┬─────────────┘
             │ HTTPS  (X-API-Key header)
             ▼
┌────────────────────────────────────────────────────┐
│        Oracle Cloud Free VM  (ARM A1)              │
│        4 CPU cores · 24 GB RAM · free forever      │
│                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │
│  │   FastAPI    │  │    Neo4j     │  │ Postgres │ │
│  │   uvicorn    │  │   (graph)    │  │  (SQL)   │ │
│  └──────────────┘  └──────────────┘  └──────────┘ │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │
│  │    Celery    │  │    Redis     │  │  MLflow  │ │
│  │   (worker)   │  │  (broker)    │  │ (opt.)   │ │
│  └──────────────┘  └──────────────┘  └──────────┘ │
│                                                    │
│  All started with: docker compose up -d            │
└────────────────────────────────────────────────────┘
```

---

## Why Oracle Cloud Free Tier?

| Feature | Value |
|---|---|
| CPU | 4 ARM Ampere cores |
| RAM | 24 GB |
| Storage | 200 GB |
| Cost | **Free forever** (no expiry) |
| Sleeping | **Never** |
| What runs on it | Your entire `docker-compose.yml` unchanged |

No Render 90-day PostgreSQL expiry. No service sleeping. No splitting your app across
5 different platforms with 5 sets of env vars to keep in sync.

---

## Step 1 — Create Oracle Cloud VM

1. Sign up at **https://cloud.oracle.com** (credit card required for identity verification only — you will not be charged)
2. In the Oracle Cloud Console → **Compute → Instances → Create Instance**
3. Configure:
   - **Name:** `graphnebula`
   - **Image:** Ubuntu 22.04
   - **Shape:** Change shape → **Ampere → VM.Standard.A1.Flex**
     - OCPUs: **4**, Memory: **24 GB** ← this is the Always Free allocation
4. Under **Add SSH keys** → paste your public SSH key (or download the generated one)
5. Click **Create** → wait ~2 minutes for the VM to start
6. Note the **Public IP address** shown on the instance detail page

---

## Step 2 — Open Firewall Port

Oracle blocks all ports by default. Open port 8000:

1. Instance detail page → **Subnet** link → **Security List** → **Add Ingress Rule**
2. Set:
   - Source CIDR: `0.0.0.0/0`
   - Destination port: `8000`
3. Click **Add Ingress Rules**

Also run this **inside the VM** after SSH-ing in (Step 3):
```bash
sudo iptables -I INPUT -p tcp --dport 8000 -j ACCEPT
sudo netfilter-persistent save
```

---

## Step 3 — Install Docker on the VM

SSH into your VM:
```bash
ssh ubuntu@YOUR_VM_IP
```

Install Docker:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-plugin git
sudo usermod -aG docker ubuntu
sudo systemctl enable docker
# Log out and back in so the docker group takes effect
exit
ssh ubuntu@YOUR_VM_IP
```

Verify:
```bash
docker --version
docker compose version
```

---

## Step 4 — Deploy the App

```bash
# Clone your repo
git clone https://github.com/reydar-05/GraphNebula.git
cd GraphNebula

# Create your .env file
nano .env
```

Paste the contents of your local `.env` into the file, but change these two lines:
```
DATABASE_URL=postgresql://graphuser:YOUR_PASSWORD@postgres:5432/graphdb
NEO4J_URI=bolt://neo4j:7687
```
*(Use the Docker service names `postgres` and `neo4j` — not `localhost`)*

Save and exit nano: `Ctrl+O` → Enter → `Ctrl+X`

```bash
# Start everything
docker compose up -d

# Wait ~60 seconds for Neo4j to initialise, then run:
docker compose ps   # all services should show "healthy" or "running"

# Run database migrations
docker compose exec backend python -m alembic upgrade head

# Initialise Neo4j constraints
docker compose exec backend python database/init_neo4j.py
```

**Verify the backend is live:**
```bash
curl -H "X-API-Key: your-api-key" http://localhost:8000/health
# Expected: {"api":"ok","postgres":"ok","neo4j":"ok","redis":"ok"}

# Also test from your local machine:
curl -H "X-API-Key: your-api-key" http://YOUR_VM_IP:8000/health
```

---

## Step 5 — Deploy the Frontend on Vercel

1. Go to **https://vercel.com** → Sign up with GitHub
2. **Add New → Project** → Import `reydar-05/GraphNebula`
3. Configure:

| Setting | Value |
|---|---|
| **Root directory** | `frontend` |
| **Framework preset** | Vite *(auto-detected)* |

4. **Environment Variables:**

| Key | Value |
|---|---|
| `VITE_API_BASE_URL` | `http://YOUR_VM_IP:8000` |
| `VITE_API_KEY` | your API key (same as `API_KEY` in `.env`) |

5. Click **Deploy** → your app is live at `https://graphnebula.vercel.app`

---

## Step 6 — Update CORS on the VM

SSH back into the VM and update `ALLOWED_ORIGINS` in `.env`:

```bash
cd GraphNebula
nano .env
# Change: ALLOWED_ORIGINS=https://graphnebula.vercel.app
```

Restart the backend to pick up the change:
```bash
docker compose restart backend
```

---

## Step 7 — Verify End to End

1. Open `https://graphnebula.vercel.app`
2. Upload `facebook_combined.txt`
3. Run **Louvain** → communities should appear on the graph
4. Check **Algorithm Performance** panel — modularity score should show

---

## Updating the App (Every Future Deploy)

SSH into your VM and run:
```bash
cd GraphNebula
git pull
docker compose up -d --build
```

Vercel redeploys the frontend **automatically** on every `git push origin main` — no action needed.

---

## Service URLs (After Deployment)

| Service | URL |
|---|---|
| Frontend | `https://graphnebula.vercel.app` |
| Backend API | `http://YOUR_VM_IP:8000` |
| API Docs (Swagger) | `http://YOUR_VM_IP:8000/docs` |
| Neo4j Browser | `http://YOUR_VM_IP:7474` |
| MLflow UI | `http://YOUR_VM_IP:5000` |

---

## Custom Domain (Optional)

If you want `https://graphnebula.com` instead of the raw IP:

1. Buy a domain (~$10/yr at Namecheap or Porkbun)
2. Add an **A record** pointing to `YOUR_VM_IP`
3. In Vercel: Project → Settings → Domains → add your domain (HTTPS auto-configured)
4. Update `VITE_API_BASE_URL` on Vercel to `https://api.yourdomain.com`
5. Add a subdomain A record `api.yourdomain.com → YOUR_VM_IP`

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `curl: connection refused` on port 8000 | Check Oracle security list ingress rule + iptables rule |
| Neo4j container keeps restarting | Give it 60s to initialise; run `docker compose logs neo4j` |
| Frontend shows CORS error | Update `ALLOWED_ORIGINS` in `.env` on VM and `docker compose restart backend` |
| `alembic upgrade head` fails | Check `DATABASE_URL` uses `postgres` hostname, not `localhost` |
| VM is slow / out of memory | GraphSAGE on large graphs is memory-heavy; use classical algorithms for demos |
