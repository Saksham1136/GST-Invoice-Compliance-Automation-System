"""
OCR Engine with preprocessing and GST field extraction
Supports Tesseract as primary, with fallback patterns
"""
import re
import io
import time
import base64
from typing import Optional, Dict, Any, Tuple, List
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter, ImageEnhance
from loguru import logger

try:
    import pytesseract
    TESSERACT_AVAILABLE = True
    logger.info("Tesseract OCR available")
except ImportError:
    TESSERACT_AVAILABLE = False
    logger.warning("Tesseract not available, using fallback")

try:
    import cv2
    OPENCV_AVAILABLE = True
except ImportError:
    OPENCV_AVAILABLE = False
    logger.warning("OpenCV not available")

try:
    from pdf2image import convert_from_bytes
    PDF2IMAGE_AVAILABLE = True
except ImportError:
    PDF2IMAGE_AVAILABLE = False
    logger.warning("pdf2image not available")


class OCREngine:
    """Multi-engine OCR processor with preprocessing pipeline"""

    GSTIN_PATTERN = re.compile(
        r'\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})\b',
        re.IGNORECASE
    )
    
    # INVOICE_NO_PATTERNS = [
    #     re.compile(r'(?:invoice\s*(?:no|number|#|num)\.?\s*:?\s*)([A-Z0-9\-\/]{3,20})', re.IGNORECASE),
    #     re.compile(r'(?:bill\s*(?:no|number)\.?\s*:?\s*)([A-Z0-9\-\/]{3,20})', re.IGNORECASE),
    #     re.compile(r'(?:inv\s*no\.?\s*:?\s*)([A-Z0-9\-\/]{3,20})', re.IGNORECASE),
    #     re.compile(r'\bINV[-/]?([A-Z0-9]{4,15})\b', re.IGNORECASE),
    # ]

    INVOICE_NO_PATTERNS = [
        # Standard formats with label (more flexible)
        re.compile(r'(?:invoice|inv|bill).*?(?:no|number|num|#)\.?\s*:?\s*([A-Z0-9\-\/]+)', re.IGNORECASE),
        
        # Catch patterns like INV-2024-001
        re.compile(r'\b(INV[-\/]?\d{4}[-\/]?\d+)\b', re.IGNORECASE),
        
        # Catch patterns like ABC-2024-123
        re.compile(r'\b([A-Z]{2,5}[-\/]\d{4}[-\/]\d{1,4})\b'),
        
        # More aggressive - any text that looks like invoice number
        re.compile(r'([A-Z]{3,5}\d{4,8})', re.IGNORECASE),
        
        # Last resort - alphanumeric with dashes near "invoice" or "inv"
        re.compile(r'(?:oice|nv|bill).*?([A-Z0-9]{3,}-[0-9]{4}-[0-9]{1,4})', re.IGNORECASE),
    ]
    DATE_PATTERNS = [
        re.compile(r'(?:invoice\s*date|date\s*of\s*issue|bill\s*date|date)\.?\s*:?\s*(\d{1,2}[-\/\s]\d{1,2}[-\/\s]\d{2,4})', re.IGNORECASE),
        re.compile(r'(?:invoice\s*date|date)\.?\s*:?\s*(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})', re.IGNORECASE),
        re.compile(r'(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})'),
        re.compile(r'(\d{4}[-\/]\d{2}[-\/]\d{2})'),
    ]
    AMOUNT_PATTERNS = {
        'taxable_amount': [
            re.compile(r'(?:taxable\s*(?:value|amount)|assessable\s*value)\.?\s*:?\s*(?:rs\.?|₹|inr)?\s*([\d,]+\.?\d{0,2})', re.IGNORECASE),
            re.compile(r'(?:subtotal|sub\s*total|base\s*amount)\.?\s*:?\s*(?:rs\.?|₹|inr)?\s*([\d,]+\.?\d{0,2})', re.IGNORECASE),
        ],
        'cgst': [
            re.compile(r'cgst\s*(?:@\s*[\d.]+%?)?\s*:?\s*(?:rs\.?|₹|inr)?\s*([\d,]+\.?\d{0,2})', re.IGNORECASE),
            re.compile(r'central\s*gst\s*:?\s*(?:rs\.?|₹|inr)?\s*([\d,]+\.?\d{0,2})', re.IGNORECASE),
        ],
        'sgst': [
            re.compile(r'sgst\s*(?:@\s*[\d.]+%?)?\s*:?\s*(?:rs\.?|₹|inr)?\s*([\d,]+\.?\d{0,2})', re.IGNORECASE),
            re.compile(r'state\s*gst\s*:?\s*(?:rs\.?|₹|inr)?\s*([\d,]+\.?\d{0,2})', re.IGNORECASE),
        ],
        'igst': [
            re.compile(r'igst\s*(?:@\s*[\d.]+%?)?\s*:?\s*(?:rs\.?|₹|inr)?\s*([\d,]+\.?\d{0,2})', re.IGNORECASE),
            re.compile(r'integrated\s*gst\s*:?\s*(?:rs\.?|₹|inr)?\s*([\d,]+\.?\d{0,2})', re.IGNORECASE),
        ],
        'total_amount': [
            re.compile(r'(?:grand\s*total|total\s*amount|total\s*payable|amount\s*payable|net\s*amount)\.?\s*:?\s*(?:rs\.?|₹|inr)?\s*([\d,]+\.?\d{0,2})', re.IGNORECASE),
            re.compile(r'total\s*:?\s*(?:rs\.?|₹|inr)?\s*([\d,]+\.?\d{0,2})', re.IGNORECASE),
        ]
    }
    NAME_PATTERNS = {
        'seller': [
            re.compile(r'(?:from|sold\s*by|supplier|vendor|seller)\.?\s*:?\s*([A-Z][A-Za-z\s&.,()Pvt Ltd]{5,60})', re.IGNORECASE),
        ],
        'buyer': [
            re.compile(r'(?:to|bill\s*to|ship\s*to|buyer|customer|recipient)\.?\s*:?\s*([A-Z][A-Za-z\s&.,()Pvt Ltd]{5,60})', re.IGNORECASE),
        ]
    }

    def __init__(self):
        self.tesseract_config = '--oem 3 --psm 6 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,/-:₹@%& '
        logger.info("OCREngine initialized")

    def preprocess_image(self, image: Image.Image) -> Image.Image:
        """Apply preprocessing to improve OCR accuracy"""
        try:
            # Convert to grayscale
            if image.mode != 'L':
                image = image.convert('L')

            # Resize if too small (upscale for better OCR)
            # width, height = image.size
            # if width < 1000:
            #     scale = 1000 / width
            #     image = image.resize((int(width * scale), int(height * scale)), Image.LANCZOS)

           # Resize if too small (upscale for better OCR)
            width, height = image.size
            min_dim = min(width, height)
            if min_dim < 2000:
                scale = 2000 / min_dim
                image = image.resize((int(width * scale), int(height * scale)), Image.LANCZOS)

            if OPENCV_AVAILABLE:
                img_array = np.array(image)

                # Denoise
                img_array = cv2.fastNlMeansDenoising(img_array, h=10)

                clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8,8))
                img_array = clahe.apply(img_array)

                # Adaptive thresholding for better text extraction
                img_array = cv2.adaptiveThreshold(
                    img_array, 255,
                    cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                    cv2.THRESH_BINARY, 11, 2
                )

                # Deskew
                coords = np.column_stack(np.where(img_array < 128))
                if len(coords) > 100:
                    angle = cv2.minAreaRect(coords)[-1]
                    if abs(angle) < 45:
                        (h, w) = img_array.shape[:2]
                        center = (w // 2, h // 2)
                        M = cv2.getRotationMatrix2D(center, angle if angle > -45 else 90 + angle, 1.0)
                        img_array = cv2.warpAffine(img_array, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)

                image = Image.fromarray(img_array)
            else:
                # Fallback PIL processing
                enhancer = ImageEnhance.Contrast(image)
                image = enhancer.enhance(2.0)
                image = image.filter(ImageFilter.SHARPEN)

            return image
        except Exception as e:
            logger.warning(f"Image preprocessing error: {e}")
            return image

    def pdf_to_images(self, pdf_bytes: bytes) -> List[Image.Image]:
        """Convert PDF to list of images"""
        if not PDF2IMAGE_AVAILABLE:
            raise ValueError("pdf2image not available. Install with: pip install pdf2image")
        try:
            images = convert_from_bytes(
                pdf_bytes,
                dpi=300,
                fmt='PNG',
                thread_count=2,
                use_cropbox=True
            )
            return images
        except Exception as e:
            logger.error(f"PDF conversion error: {e}")
            raise ValueError(f"Failed to convert PDF: {str(e)}")

    def extract_text_from_image(self, image: Image.Image) -> Tuple[str, float]:
        """Extract text from image using available OCR engine"""
        processed = self.preprocess_image(image)
        text = ""
        confidence = 0.0

        if TESSERACT_AVAILABLE:
            try:
                data = pytesseract.image_to_data(
                    processed,
                    output_type=pytesseract.Output.DICT,
                    config=self.tesseract_config,
                    lang='eng'
                )
                words = [w for w, c in zip(data['text'], data['conf'])
                         if w.strip() and c > 0]
                confidences = [c for w, c in zip(data['text'], data['conf'])
                               if w.strip() and c > 0]

                text = pytesseract.image_to_string(processed, config=self.tesseract_config)
                confidence = float(np.mean(confidences)) if confidences else 0.0
                logger.debug(f"Tesseract extracted {len(words)} words, avg confidence: {confidence:.1f}%")
            except Exception as e:
                logger.error(f"Tesseract error: {e}")

        return text, confidence

    def parse_amount(self, text: str) -> Optional[float]:
        """Parse currency amount from string"""
        if not text:
            return None
        cleaned = re.sub(r'[^\d.,]', '', text.strip())
        cleaned = cleaned.replace(',', '')
        try:
            return float(cleaned)
        except ValueError:
            return None

    def extract_gst_fields(self, text: str) -> Dict[str, Any]:
        """Extract all GST invoice fields from OCR text"""
        result = {
            'gstin_seller': None,
            'gstin_buyer': None,
            'invoice_number': None,
            'invoice_date': None,
            'taxable_amount': 0.0,
            'cgst': 0.0,
            'sgst': 0.0,
            'igst': 0.0,
            'total_amount': 0.0,
            'seller_name': None,
            'buyer_name': None,
            'place_of_supply': None,
        }

        # Extract GSTINs
        gstins = self.GSTIN_PATTERN.findall(text.upper())
        unique_gstins = list(dict.fromkeys(gstins))  # preserve order, deduplicate
        if unique_gstins:
            result['gstin_seller'] = unique_gstins[0]
        if len(unique_gstins) > 1:
            result['gstin_buyer'] = unique_gstins[1]

        # Extract invoice number
        for pattern in self.INVOICE_NO_PATTERNS:
            match = pattern.search(text)
            if match:
                result['invoice_number'] = match.group(1).strip()
                break

        # Extract date
        for pattern in self.DATE_PATTERNS:
            match = pattern.search(text)
            if match:
                result['invoice_date'] = match.group(1).strip()
                break

        # Extract amounts
        for field, patterns in self.AMOUNT_PATTERNS.items():
            for pattern in patterns:
                match = pattern.search(text)
                if match:
                    amount = self.parse_amount(match.group(1))
                    if amount is not None:
                        result[field] = amount
                        break

        # Extract names
        for entity, patterns in self.NAME_PATTERNS.items():
            for pattern in patterns:
                match = pattern.search(text)
                if match:
                    name = match.group(1).strip()
                    if len(name) > 3:
                        result[f'{entity}_name'] = name
                        break

        # Extract place of supply
        pos_pattern = re.compile(r'place\s*of\s*supply\.?\s*:?\s*([A-Za-z\s]+)', re.IGNORECASE)
        pos_match = pos_pattern.search(text)
        if pos_match:
            result['place_of_supply'] = pos_match.group(1).strip()[:50]

        return result

    async def process_file(self, file_bytes: bytes, content_type: str) -> Dict[str, Any]:
        """Main processing pipeline for invoice files"""
        start_time = time.time()
        all_text = ""
        total_confidence = 0.0
        page_count = 0

        try:
            if content_type == 'application/pdf':
                images = self.pdf_to_images(file_bytes)
                for img in images[:5]:  # Process max 5 pages
                    text, conf = self.extract_text_from_image(img)
                    all_text += text + "\n"
                    total_confidence += conf
                    page_count += 1
            else:
                image = Image.open(io.BytesIO(file_bytes))
                all_text, total_confidence = self.extract_text_from_image(image)
                page_count = 1

            avg_confidence = total_confidence / page_count if page_count > 0 else 0
            extracted_fields = self.extract_gst_fields(all_text)

            processing_time = int((time.time() - start_time) * 1000)
            logger.info(f"Processed {page_count} page(s) in {processing_time}ms, confidence: {avg_confidence:.1f}%")

            return {
                **extracted_fields,
                'raw_text': all_text[:5000],  # Limit stored text
                'confidence': round(avg_confidence, 2),
                'page_count': page_count,
                'processing_time_ms': processing_time,
                'extraction_method': 'tesseract' if TESSERACT_AVAILABLE else 'pattern_only'
            }

        except Exception as e:
            logger.error(f"File processing error: {e}", exc_info=True)
            raise
