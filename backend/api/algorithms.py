from fastapi import APIRouter, HTTPException
from celery.result import AsyncResult
from backend.worker import celery_app
from backend.algorithms.community import run_community_detection

router = APIRouter()

VALID_ALGOS = ["louvain", "leiden", "infomap", "label_propagation", "walktrap", "slpa"]

# Register the Celery Task
@celery_app.task(name="process_algorithm_task")
def process_algorithm_task(dataset_id: int, algo_name: str):
    return run_community_detection(dataset_id, algo_name)


@router.post("/run-algorithm/{dataset_id}")
async def trigger_algorithm(dataset_id: int, algo_name: str):
    if algo_name.lower() not in VALID_ALGOS:
        raise HTTPException(status_code=400, detail=f"Invalid algorithm. Choose from: {VALID_ALGOS}")

    task = process_algorithm_task.delay(dataset_id, algo_name)
    return {
        "message": f"Algorithm '{algo_name}' triggered successfully.",
        "task_id": task.id,
        "status": "PENDING",
    }


@router.get("/task-status/{task_id}")
async def get_task_status(task_id: str):
    """Poll this endpoint to check if a background task has completed."""
    result = AsyncResult(task_id, app=celery_app)
    response = {"task_id": task_id, "status": result.status}
    if result.successful():
        response["result"] = result.result
    elif result.failed():
        response["error"] = str(result.result)
    return response