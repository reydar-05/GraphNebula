<div align="center">

# ⬡ GraphNebula

### Community Detection Platform

[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.2-EE4C2C?style=flat-square&logo=pytorch&logoColor=white)](https://pytorch.org)
[![Neo4j](https://img.shields.io/badge/Neo4j-5.16-008CC1?style=flat-square&logo=neo4j&logoColor=white)](https://neo4j.com)
[![Celery](https://img.shields.io/badge/Celery-5.3-37814A?style=flat-square&logo=celery&logoColor=white)](https://docs.celeryq.dev)
[![MLflow](https://img.shields.io/badge/MLflow-2.11-0194E2?style=flat-square&logo=mlflow&logoColor=white)](https://mlflow.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-a855f7?style=flat-square)](LICENSE)

**Upload a graph dataset → run community detection algorithms → explore structure visually.**

GraphNebula is a full-stack research platform that combines classical graph algorithms (Louvain, Leiden, SLPA) with a GNN-based pipeline (Node2Vec + GraphSAGE) for community detection on large real-world networks.

</div>

---

## ✨ Features

| Category | Details |
|---|---|
| **Algorithms** | Louvain, Leiden, Label Propagation, Walktrap, SLPA (overlapping), GraphSAGE (PyTorch GNN) |
| **ML Pipeline** | Node2Vec embeddings → GraphSAGE with 5-fold cross-validation + MLflow experiment tracking |
| **Visualization** | Interactive Cytoscape.js graph with glow-colored community nodes |
| **Metrics** | Modularity, conductance, execution time — plotted per algorithm via Plotly |
| **Async Tasks** | Celery + Redis task queue with real-time status polling |
| **Storage** | Neo4j for graph topology · PostgreSQL for experiment records |
| **Auth** | API key authentication (`X-API-Key` header) |
| **Observability** | Prometheus metrics at `/metrics` · MLflow UI at `:5000` |
| **Deployment** | Docker Compose · Kubernetes manifests · GitHub Actions CI/CD |

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser (React + Vite)                  │
│  DatasetManager  ·  AlgorithmRunner  ·  MetricsDashboard        │
│  Cytoscape.js graph     ·     Plotly charts                     │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP  (X-API-Key)
┌────────────────────────────▼────────────────────────────────────┐
│                    FastAPI  (uvicorn)                            │
│  /upload-dataset  /run-algorithm  /train-model                  │
│  /visualization   /metrics        /task-status  /health         │
│  Global: verify_api_key  ·  Prometheus instrumentation          │
└──────┬──────────────┬──────────────────────────────────────────┘
       │              │
  Celery task    Direct queries
  (Redis broker) │
       │          │
┌──────▼──────┐  ├──────────────────┐  ┌──────────────────────┐
│   Worker    │  │      Neo4j        │  │    PostgreSQL         │
│  community  │  │  Graph topology   │  │  datasets            │
│  detection  │  │  community_id     │  │  experiments         │
│  GraphSAGE  │  │  node labels      │  │  metrics             │
└─────────────┘  └──────────────────┘  └──────────────────────┘
                                                 ▲
                                        Alembic migrations
```

---

## 🚀 Quick Start

### Prerequisites

- Python 3.9+
- Node.js 20+
- Neo4j 5.x running on `bolt://localhost:7687`
- PostgreSQL running on `localhost:5432`
- Redis running on `localhost:6379`

### 1. Clone & install

```bash
git clone https://github.com/reydar-05/GraphNebula.git
cd GraphNebula

# Backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Frontend
cd frontend && npm install && cd ..
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and fill in your DATABASE_URL, NEO4J_PASSWORD, API_KEY, etc.
```

> **Windows PowerShell** — set variables before running commands:
> ```powershell
> $env:DATABASE_URL = 'postgresql://graphuser:password@localhost:5432/graphdb'
> $env:NEO4J_URI    = 'bolt://localhost:7687'
> $env:NEO4J_PASSWORD = 'your-password'
> $env:REDIS_HOST   = 'localhost'
> $env:API_KEY      = 'graphnebula-dev-key'
> ```

### 3. Initialize databases

```bash
# Run Alembic migrations (PostgreSQL)
python -m alembic upgrade head

# Seed Neo4j constraints & indexes
python database/init_neo4j.py
```

### 4. Start services

Open **4 terminals**:

```bash
# Terminal 1 — Backend API
uvicorn backend.main:app --reload

# Terminal 2 — Celery worker (use --pool=solo on Windows)
celery -A backend.worker.celery_app worker --loglevel=info --pool=solo

# Terminal 3 — Frontend dev server
cd frontend && npm run dev

# Terminal 4 — MLflow tracking UI (optional, for GraphSAGE runs)
mlflow server --host 0.0.0.0 --port 5000
```

Open **http://localhost:5173** in your browser.

---

## 🐳 Docker Compose

```bash
# Copy and configure env
cp .env.example .env

# Start everything (Postgres, Neo4j, Redis, backend, worker, frontend, MLflow)
docker compose up -d

# Run migrations inside the container
docker compose exec backend python -m alembic upgrade head
docker compose exec backend python database/init_neo4j.py
```

Services exposed:

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| MLflow UI | http://localhost:5000 |
| Neo4j Browser | http://localhost:7474 |
| Prometheus metrics | http://localhost:8000/metrics |

---

## 📂 Project Structure

```
GraphNebula/
├── backend/
│   ├── main.py                  # FastAPI app, health check, CORS, auth
│   ├── worker.py                # Celery app configuration
│   ├── core/auth.py             # X-API-Key authentication dependency
│   ├── api/                     # Route handlers
│   │   ├── upload.py            # Dataset ingestion
│   │   ├── algorithms.py        # Community detection tasks + task-status
│   │   ├── ml.py                # GraphSAGE training endpoint
│   │   ├── visualization.py     # Cytoscape element builder
│   │   └── metrics.py           # Experiment metrics
│   ├── algorithms/community.py  # Louvain / Leiden / SLPA / Walktrap / LP
│   ├── ml/
│   │   ├── models.py            # GraphSAGE PyTorch model definition
│   │   └── train.py             # Node2Vec → GraphSAGE + 5-fold CV + MLflow
│   ├── services/ingestion.py    # Neo4j graph data service
│   ├── models/sql_models.py     # SQLAlchemy ORM models
│   └── alembic/                 # Database migrations
├── database/
│   ├── session.py               # SQLAlchemy engine + session factory
│   └── init_neo4j.py            # Neo4j constraints initialization
├── frontend/
│   ├── src/
│   │   ├── App.jsx              # Main layout, state, Cytoscape graph
│   │   ├── App.css              # Dark nebula theme, glassmorphism
│   │   ├── api/client.js        # Axios instance with X-API-Key header
│   │   └── components/
│   │       ├── DatasetManager.jsx     # Upload UI
│   │       ├── AlgorithmRunner.jsx    # Algorithm selector + task polling
│   │       └── MetricsDashboard.jsx   # Plotly charts
│   └── nginx.conf               # SPA fallback + /api/ proxy
├── deployment/
│   ├── k8s/                     # Kubernetes manifests (8 files, HPA)
│   └── monitoring/              # Prometheus + Grafana configs
├── .github/workflows/ci-cd.yml  # 4-job CI/CD pipeline (test→lint→build→deploy)
├── docker-compose.yml
├── requirements.txt
└── .env.example
```

---

## 🔬 Supported Algorithms

| Algorithm | Type | Library | Notes |
|---|---|---|---|
| **Louvain** | Crisp | cdlib / networkx | Fast modularity optimisation |
| **Leiden** | Crisp | leidenalg | Improved Louvain — no disconnected communities |
| **Label Propagation** | Crisp | cdlib | Linear time, stochastic |
| **Walktrap** | Crisp | cdlib / igraph | Random-walk based hierarchy |
| **SLPA** | Overlapping | cdlib | Nodes can belong to multiple communities |
| **GraphSAGE** | GNN (ML) | PyTorch Geometric | Node2Vec embeddings → 5-fold CV classification |

---

## 📊 GraphSAGE Pipeline

```
Neo4j graph
     │
     ▼
Node2Vec (64-dim embeddings, 5 epochs)
     │
     ▼
GraphSAGE (2-layer, 32 hidden, 50 epochs × 5 folds)
     │
     ├── Best-fold weights saved  →  backend/models/saved/
     ├── Predictions written back →  Neo4j  (community_id)
     ├── Experiment saved         →  PostgreSQL (modularity proxy = mean CV acc)
     └── Run logged               →  MLflow (params + metrics + artifacts)
```

---

## 🔒 Authentication

All API endpoints require the `X-API-Key` header:

```bash
curl -H "X-API-Key: graphnebula-dev-key" http://localhost:8000/health
```

Set `API_KEY` in your `.env` and `VITE_API_KEY` in `frontend/.env`. The frontend axios client sends the key automatically on every request.

---

## 🛠 Tech Stack

### Backend
- **FastAPI** — async REST API
- **Celery + Redis** — distributed task queue
- **Neo4j** — graph database (community assignments, topology)
- **PostgreSQL + SQLAlchemy + Alembic** — relational data + migrations
- **PyTorch Geometric** — GraphSAGE & Node2Vec
- **cdlib / igraph / leidenalg** — classical community detection
- **MLflow** — experiment tracking & model registry
- **Prometheus** — metrics instrumentation

### Frontend
- **React 18 + Vite** — SPA
- **Cytoscape.js** — interactive network graph
- **Plotly.js** — algorithm comparison charts
- **Axios** — HTTP client

### Infrastructure
- **Docker + Docker Compose** — local containerisation
- **Kubernetes** — production deployment (HPA: 2–8 backend pods)
- **GitHub Actions** — CI/CD (test → lint → build/push → deploy)
- **NGINX** — static hosting + `/api/` reverse proxy

---

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/upload-dataset` | Upload edge-list file, ingest to Neo4j |
| `POST` | `/run-algorithm/{id}?algo_name=louvain` | Submit community detection task |
| `POST` | `/train-model/{id}` | Submit GraphSAGE training task |
| `GET` | `/task-status/{task_id}` | Poll Celery task state |
| `GET` | `/visualization/{id}?limit=1200` | Get Cytoscape elements |
| `GET` | `/metrics/{id}` | Get algorithm experiment metrics |
| `GET` | `/health` | Postgres + Neo4j + Redis health check |
| `GET` | `/metrics` | Prometheus scrape endpoint |
| `GET` | `/docs` | Swagger UI |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit your changes: `git commit -m "feat: add your feature"`
4. Push and open a Pull Request

---

## 📄 License

MIT © 2026 [reydar-05](https://github.com/reydar-05)
