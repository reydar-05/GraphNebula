from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine
from neo4j import GraphDatabase
from prometheus_fastapi_instrumentator import Instrumentator
import redis
import os
import logging

from backend.api.upload import router as upload_router
from backend.api.algorithms import router as algo_router
from backend.api.ml import router as ml_router
from backend.api.visualization import router as vis_router
from backend.api.metrics import router as metrics_router
from backend.core.auth import verify_api_key

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger(__name__)

# --- Database configuration (all from environment, no hardcoded defaults in prod) ---
PG_URL = os.environ["DATABASE_URL"]
NEO4J_URI = os.environ["NEO4J_URI"]
NEO4J_AUTH = ("neo4j", os.environ["NEO4J_PASSWORD"])
REDIS_HOST = os.environ["REDIS_HOST"]

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")

app = FastAPI(
    title="Community Detection API",
    version="1.0.0",
    dependencies=[Depends(verify_api_key)],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization", "X-API-Key"],
)

app.include_router(upload_router, tags=["Data Ingestion"])
app.include_router(algo_router, tags=["Graph Algorithms"])
app.include_router(ml_router, tags=["Machine Learning"])
app.include_router(vis_router, tags=["Visualization"])
app.include_router(metrics_router, tags=["Metrics"])

# Expose /metrics endpoint for Prometheus scraping
Instrumentator().instrument(app).expose(app, endpoint="/metrics")

engine = create_engine(PG_URL, pool_size=10, max_overflow=20, pool_pre_ping=True)


@app.get("/")
def read_root():
    return {"status": "API is running. Welcome to the Graph Community Detection Platform."}


@app.get("/health")
def health_check():
    """Verifies connections to PostgreSQL, Neo4j, and Redis."""
    status = {"api": "ok", "postgres": "down", "neo4j": "down", "redis": "down"}

    try:
        with engine.connect() as conn:
            status["postgres"] = "ok"
    except Exception as e:
        logger.error("Postgres health check failed: %s", e)
        status["postgres"] = "error"

    try:
        driver = GraphDatabase.driver(NEO4J_URI, auth=NEO4J_AUTH)
        driver.verify_connectivity()
        status["neo4j"] = "ok"
        driver.close()
    except Exception as e:
        logger.error("Neo4j health check failed: %s", e)
        status["neo4j"] = "error"

    try:
        r = redis.Redis(host=REDIS_HOST, port=6379, db=0, socket_connect_timeout=2)
        if r.ping():
            status["redis"] = "ok"
    except Exception as e:
        logger.error("Redis health check failed: %s", e)
        status["redis"] = "error"

    return status