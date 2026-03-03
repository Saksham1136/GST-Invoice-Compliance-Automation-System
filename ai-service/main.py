"""
GST Compliance AI Service
FastAPI-based OCR and data extraction service for GST invoices
"""
import os
import time
import tempfile
import asyncio
from pathlib import Path
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from loguru import logger
import uvicorn

from routes.extract import router as extract_router
from routes.health import router as health_router
from utils.ocr_engine import OCREngine

# Configure logging
logger.add("logs/ai_service.log", rotation="10 MB", retention="30 days", level="INFO")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    logger.info("Starting GST AI Service...")
    # Pre-warm the OCR engine
    app.state.ocr_engine = OCREngine()
    logger.info("OCR Engine initialized successfully")
    yield
    logger.info("Shutting down GST AI Service...")

app = FastAPI(
    title="GST Compliance AI Service",
    description="OCR and AI-powered GST invoice data extraction service",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5000", os.getenv("BACKEND_URL", "*")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(extract_router)
app.include_router(health_router)

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": str(exc)}
    )

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8000)),
        reload=os.getenv("ENV", "production") == "development",
        workers=int(os.getenv("WORKERS", 2)),
        log_level="info"
    )
