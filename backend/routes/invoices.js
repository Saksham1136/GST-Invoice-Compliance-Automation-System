const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');
const FormData = require('form-data');
const { v4: uuidv4 } = require('uuid');
const { body, query, validationResult } = require('express-validator');
const ExcelJS = require('exceljs');
const { createObjectCsvWriter } = require('csv-writer');
const Invoice = require('../models/Invoice');
const { authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { validateGSTCompliance } = require('../utils/gstValidator');

const router = express.Router();
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedMimes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/tiff', 'image/webp'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} not allowed. Accepted: PDF, JPEG, PNG, TIFF, WEBP`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 20 // max 20 files at once
  }
});

// Helper: send file to AI service for OCR
const processWithAI = async (filePath, fileType, mimeType) => {
  const startTime = Date.now();
  const formData = new FormData();
  const fileBuffer = await fs.readFile(filePath);
  formData.append('file', fileBuffer, {
    filename: path.basename(filePath),
    contentType: mimeType
  });

  const response = await axios.post(`${AI_SERVICE_URL}/extract`, formData, {
    headers: formData.getHeaders(),
    timeout: 60000 // 60s timeout
  });

  return {
    ...response.data,
    processing_time_ms: Date.now() - startTime
  };
};

// Upload single invoice
router.post('/upload', upload.single('invoice'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const { originalname, filename, path: filePath, size, mimetype } = req.file;
  const fileType = mimetype === 'application/pdf' ? 'pdf' : 'image';

  const invoice = await Invoice.create({
    user: req.user._id,
    original_filename: originalname,
    stored_filename: filename,
    file_path: filePath,
    file_type: fileType,
    file_size: size,
    mime_type: mimetype,
    status: 'uploaded'
  });

  // Async processing - don't wait
  processInvoice(invoice._id, filePath, fileType, mimetype);

  logger.info(`Invoice uploaded: ${invoice._id}, user: ${req.user._id}`);

  res.status(202).json({
    message: 'Invoice uploaded and processing started',
    invoice_id: invoice._id,
    status: 'processing'
  });
}));

// Upload bulk invoices
router.post('/upload/bulk', upload.array('invoices', 20), asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  const batchId = uuidv4();
  const invoices = [];

  for (const file of req.files) {
    const { originalname, filename, path: filePath, size, mimetype } = file;
    const fileType = mimetype === 'application/pdf' ? 'pdf' : 'image';

    const invoice = await Invoice.create({
      user: req.user._id,
      original_filename: originalname,
      stored_filename: filename,
      file_path: filePath,
      file_type: fileType,
      file_size: size,
      mime_type: mimetype,
      status: 'uploaded',
      batch_id: batchId
    });

    invoices.push({ invoice_id: invoice._id, filename: originalname });
    processInvoice(invoice._id, filePath, fileType, mimetype);
  }

  logger.info(`Bulk upload: ${req.files.length} invoices, batch: ${batchId}, user: ${req.user._id}`);

  res.status(202).json({
    message: `${req.files.length} invoices uploaded and processing started`,
    batch_id: batchId,
    invoices,
    total: invoices.length
  });
}));

// Background processing function
const processInvoice = async (invoiceId, filePath, fileType, mimeType) => {
  try {
    await Invoice.findByIdAndUpdate(invoiceId, {
      status: 'processing',
      $inc: { processing_attempts: 1 }
    });

    const aiResult = await processWithAI(filePath, fileType, mimeType);

    const extractedData = {
      gstin_seller: aiResult.gstin_seller || '',
      gstin_buyer: aiResult.gstin_buyer || '',
      invoice_number: aiResult.invoice_number || '',
      invoice_date: aiResult.invoice_date || '',
      taxable_amount: parseFloat(aiResult.taxable_amount) || 0,
      cgst: parseFloat(aiResult.cgst) || 0,
      sgst: parseFloat(aiResult.sgst) || 0,
      igst: parseFloat(aiResult.igst) || 0,
      total_amount: parseFloat(aiResult.total_amount) || 0,
      seller_name: aiResult.seller_name || '',
      buyer_name: aiResult.buyer_name || '',
      place_of_supply: aiResult.place_of_supply || '',
      raw_text: aiResult.raw_text || ''
    };

    const validationResult = validateGSTCompliance(extractedData);
    const complianceStatus = validationResult.is_valid ? 'valid' :
      (validationResult.warnings?.length > 0 && validationResult.errors?.length === 0 ? 'warning' : 'invalid');

    await Invoice.findByIdAndUpdate(invoiceId, {
      status: 'validated',
      compliance_status: complianceStatus,
      extracted_data: extractedData,
      validation_result: validationResult,
      processing_time_ms: aiResult.processing_time_ms || 0,
      ocr_confidence: aiResult.confidence || 0
    });

    logger.info(`Invoice processed successfully: ${invoiceId}, compliance: ${complianceStatus}`);
  } catch (error) {
    logger.error(`Invoice processing failed: ${invoiceId}`, error.message);
    await Invoice.findByIdAndUpdate(invoiceId, {
      status: 'failed',
      compliance_status: 'invalid',
      error_message: error.message
    });
  }
};

// Get all invoices with filtering and pagination
router.get('/', [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('status').optional().isIn(['uploaded', 'processing', 'extracted', 'validated', 'failed']),
  query('compliance_status').optional().isIn(['valid', 'invalid', 'warning', 'pending']),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  query('gstin').optional().isString()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ error: 'Invalid query parameters', errors: errors.array() });
  }

  const {
    page = 1, limit = 20, status, compliance_status,
    from, to, gstin, search, batch_id
  } = req.query;

  const filter = { user: req.user._id };
  if (status) filter.status = status;
  if (compliance_status) filter.compliance_status = compliance_status;
  if (batch_id) filter.batch_id = batch_id;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }
  if (gstin) {
    filter.$or = [
      { 'extracted_data.gstin_seller': { $regex: gstin, $options: 'i' } },
      { 'extracted_data.gstin_buyer': { $regex: gstin, $options: 'i' } }
    ];
  }
  if (search) {
    filter.$or = [
      { original_filename: { $regex: search, $options: 'i' } },
      { 'extracted_data.invoice_number': { $regex: search, $options: 'i' } },
      { 'extracted_data.seller_name': { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (page - 1) * limit;
  const [invoices, total] = await Promise.all([
    Invoice.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Invoice.countDocuments(filter)
  ]);

  res.json({
    invoices,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      has_next: page * limit < total,
      has_prev: page > 1
    }
  });
}));

// Get single invoice
router.get('/:id', asyncHandler(async (req, res) => {
  const invoice = await Invoice.findOne({ _id: req.params.id, user: req.user._id });
  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found' });
  }
  res.json({ invoice });
}));

// Reprocess invoice
router.post('/:id/reprocess', asyncHandler(async (req, res) => {
  const invoice = await Invoice.findOne({ _id: req.params.id, user: req.user._id });
  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found' });
  }
  if (invoice.status === 'processing') {
    return res.status(400).json({ error: 'Invoice is already being processed' });
  }

  processInvoice(invoice._id, invoice.file_path, invoice.file_type, invoice.mime_type);
  res.json({ message: 'Reprocessing started', invoice_id: invoice._id });
}));

// Delete invoice
router.delete('/:id', asyncHandler(async (req, res) => {
  const invoice = await Invoice.findOne({ _id: req.params.id, user: req.user._id });
  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  try {
    await fs.unlink(invoice.file_path);
  } catch { /* File might not exist */ }

  await invoice.deleteOne();
  res.json({ message: 'Invoice deleted successfully' });
}));

// Export invoices
router.get('/export/:format', [
  query('format').optional().isIn(['csv', 'excel']),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  query('compliance_status').optional().isIn(['valid', 'invalid', 'warning', 'pending'])
], asyncHandler(async (req, res) => {
  const { format = 'csv' } = req.params;
  const { from, to, compliance_status } = req.query;

  const filter = { user: req.user._id, status: 'validated' };
  if (compliance_status) filter.compliance_status = compliance_status;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const invoices = await Invoice.find(filter).sort({ createdAt: -1 }).lean();

  const data = invoices.map(inv => ({
    'Invoice ID': inv._id.toString(),
    'Filename': inv.original_filename,
    'Invoice Number': inv.extracted_data?.invoice_number || '',
    'Invoice Date': inv.extracted_data?.invoice_date || '',
    'Seller GSTIN': inv.extracted_data?.gstin_seller || '',
    'Buyer GSTIN': inv.extracted_data?.gstin_buyer || '',
    'Seller Name': inv.extracted_data?.seller_name || '',
    'Buyer Name': inv.extracted_data?.buyer_name || '',
    'Taxable Amount': inv.extracted_data?.taxable_amount || 0,
    'CGST': inv.extracted_data?.cgst || 0,
    'SGST': inv.extracted_data?.sgst || 0,
    'IGST': inv.extracted_data?.igst || 0,
    'Total Amount': inv.extracted_data?.total_amount || 0,
    'Compliance Status': inv.compliance_status,
    'OCR Confidence': inv.ocr_confidence,
    'Processing Time (ms)': inv.processing_time_ms,
    'Upload Date': new Date(inv.createdAt).toISOString()
  }));

  if (format === 'excel') {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'GST Compliance System';
    const worksheet = workbook.addWorksheet('GST Invoices');

    if (data.length > 0) {
      worksheet.columns = Object.keys(data[0]).map(key => ({
        header: key, key, width: Math.max(key.length + 2, 15)
      }));

      // Style header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern', pattern: 'solid',
        fgColor: { argb: 'FF1B4F72' }
      };
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

      data.forEach((row, idx) => {
        const newRow = worksheet.addRow(row);
        if (row['Compliance Status'] === 'invalid') {
          newRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4E4' } };
        } else if (row['Compliance Status'] === 'valid') {
          newRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
        }
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=gst-invoices-${Date.now()}.xlsx`);
    await workbook.xlsx.write(res);
  } else {
    const fields = data.length > 0 ? Object.keys(data[0]) : [];
    const csvRows = [fields.join(',')];
    data.forEach(row => {
      csvRows.push(fields.map(f => `"${String(row[f] || '').replace(/"/g, '""')}"`).join(','));
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=gst-invoices-${Date.now()}.csv`);
    res.send(csvRows.join('\n'));
  }
}));

module.exports = router;
