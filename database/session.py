from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os

# PostgreSQL setup — DATABASE_URL must be set in the environment; no hardcoded fallback.
PG_URL = os.environ["DATABASE_URL"]
engine = create_engine(PG_URL, pool_size=10, max_overflow=20, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()