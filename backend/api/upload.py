from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from database.session import get_db
from backend.services.ingestion import GraphDataService
import os
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter()
graph_service = GraphDataService()

TEMP_DIR = "temp_uploads"
MAX_UPLOAD_BYTES = 500 * 1024 * 1024  # 500 MB hard limit
os.makedirs(TEMP_DIR, exist_ok=True)


@router.post("/upload-dataset")
async def upload_dataset(file: UploadFile = File(...), db: Session = Depends(get_db)):
    # Validate extension
    if not file.filename.endswith((".txt", ".csv")):
        raise HTTPException(status_code=400, detail="Only .txt or .csv edge lists are supported.")

    # Sanitize filename — use a UUID to prevent path traversal entirely
    safe_name = f"{uuid.uuid4().hex}.{file.filename.rsplit('.', 1)[-1]}"
    temp_file_path = os.path.join(TEMP_DIR, safe_name)

    try:
        # Stream to disk with size cap
        bytes_written = 0
        with open(temp_file_path, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):  # 1 MB chunks
                bytes_written += len(chunk)
                if bytes_written > MAX_UPLOAD_BYTES:
                    raise HTTPException(status_code=413, detail="File exceeds 500 MB limit.")
                buffer.write(chunk)

        dataset_record = graph_service.ingest_dataset(
            file_path=temp_file_path,
            dataset_name=file.filename,
            db_session=db,
        )
        return {
            "message": "Dataset ingested successfully.",
            "dataset_id": dataset_record.id,
            "num_nodes": dataset_record.num_nodes,
            "num_edges": dataset_record.num_edges,
        }

    except HTTPException:
        raise
    except Exception:
        logger.exception("Dataset ingestion failed for file '%s'", file.filename)
        raise HTTPException(status_code=500, detail="Ingestion failed. Check server logs.")

    finally:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)