from fastapi import APIRouter, HTTPException
from backend.worker import celery_app
from backend.ml.train import train_gnn_pipeline

router = APIRouter()

@celery_app.task(name="train_model_task")
def train_model_task(dataset_id: int):
    # Runs the PyTorch training loop in the Celery background worker
    return train_gnn_pipeline(dataset_id)

@router.post("/train-model/{dataset_id}")
async def trigger_training(dataset_id: int):
    # Dispatch to Celery
    task = train_model_task.delay(dataset_id)
    
    return {
        "message": f"GraphSAGE training started for dataset {dataset_id}.",
        "task_id": task.id,
        "status": "Training in background. Check Celery logs for accuracy metrics."
    }