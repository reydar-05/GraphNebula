from fastapi import Security, HTTPException, status
from fastapi.security.api_key import APIKeyHeader
import os

API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)


def verify_api_key(key: str = Security(API_KEY_HEADER)):
    """Validate the X-API-Key header against the API_KEY environment variable."""
    expected = os.environ.get("API_KEY")
    if not expected:
        # If API_KEY is not configured in the environment, deny all requests
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server is not configured with an API key.",
        )
    if key != expected:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or missing API key. Pass your key in the X-API-Key header.",
        )
