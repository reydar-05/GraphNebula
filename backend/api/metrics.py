from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database.session import get_db
from backend.models.sql_models import Experiment

router = APIRouter()

@router.get("/metrics/{dataset_id}")
async def get_metrics(dataset_id: int, db: Session = Depends(get_db)):
    experiments = db.query(Experiment).filter(Experiment.dataset_id == dataset_id).all()
    
    if not experiments:
        raise HTTPException(status_code=404, detail="No metrics found for this dataset.")
        
    return {
        "dataset_id": dataset_id,
        "metrics": [
            {
                "algorithm": exp.algorithm,
                "modularity": exp.modularity,
                "conductance": exp.conductance,
                "execution_time_ms": exp.execution_time_ms
            } for exp in experiments
        ]
    }