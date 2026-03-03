"""Health check and service info endpoints"""
import time
import sys
import platform
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

router = APIRouter(tags=["health"])
START_TIME = time.time()


@router.get("/health")
async def health_check(request: Request):
    """Health check endpoint"""
    ocr_available = hasattr(request.app.state, 'ocr_engine')

    return JSONResponse(content={
        "status": "healthy",
        "service": "GST AI Extraction Service",
        "version": "1.0.0",
        "uptime_seconds": round(time.time() - START_TIME, 2),
        "python_version": sys.version.split()[0],
        "platform": platform.system(),
        "ocr_engine": "ready" if ocr_available else "not_initialized",
        "capabilities": {
            "pdf_support": True,
            "image_support": True,
            "batch_support": True,
            "max_file_size_mb": 10,
            "max_batch_size": 20
        }
    })


@router.get("/")
async def root():
    return {"message": "GST AI Service is running", "docs": "/docs"}
