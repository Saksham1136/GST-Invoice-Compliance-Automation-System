"""
Extract route - handles file upload and OCR extraction
"""
from fastapi import APIRouter, File, UploadFile, HTTPException, Request
from fastapi.responses import JSONResponse
from loguru import logger

ALLOWED_CONTENT_TYPES = {
    'application/pdf',
    'image/jpeg', 'image/jpg', 'image/png',
    'image/tiff', 'image/webp'
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

router = APIRouter(tags=["extraction"])


@router.post("/extract")
async def extract_invoice(request: Request, file: UploadFile = File(...)):
    """
    Extract GST fields from uploaded invoice (PDF or image)
    Returns structured data with all GST invoice fields
    """
    # Validate content type
    content_type = file.content_type or ''
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {content_type}. Allowed: PDF, JPEG, PNG, TIFF, WEBP"
        )

    # Read file
    file_bytes = await file.read()

    # Validate file size
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large: {len(file_bytes) / 1024 / 1024:.1f}MB. Max: 10MB"
        )

    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty file uploaded")

    # Get OCR engine from app state
    ocr_engine = request.app.state.ocr_engine

    try:
        result = await ocr_engine.process_file(file_bytes, content_type)
        logger.info(f"Successfully extracted from {file.filename}: confidence={result.get('confidence')}%")
        return JSONResponse(content=result)

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"Extraction failed for {file.filename}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")


@router.post("/extract/batch")
async def extract_batch(request: Request, files: list[UploadFile] = File(...)):
    """Process multiple invoices in batch"""
    if len(files) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 files per batch")

    ocr_engine = request.app.state.ocr_engine
    results = []

    for file in files:
        try:
            content_type = file.content_type or ''
            if content_type not in ALLOWED_CONTENT_TYPES:
                results.append({
                    'filename': file.filename,
                    'error': f"Unsupported file type: {content_type}"
                })
                continue

            file_bytes = await file.read()
            result = await ocr_engine.process_file(file_bytes, content_type)
            results.append({'filename': file.filename, **result})

        except Exception as e:
            logger.error(f"Batch extraction failed for {file.filename}: {e}")
            results.append({
                'filename': file.filename,
                'error': str(e)
            })

    return JSONResponse(content={
        'results': results,
        'total': len(results),
        'successful': len([r for r in results if 'error' not in r])
    })
