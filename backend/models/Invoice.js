const mongoose = require('mongoose');

const extractedDataSchema = new mongoose.Schema({
  gstin_seller: { type: String, trim: true },
  gstin_buyer: { type: String, trim: true },
  invoice_number: { type: String, trim: true },
  invoice_date: { type: String, trim: true },
  taxable_amount: { type: Number, default: 0 },
  cgst: { type: Number, default: 0 },
  sgst: { type: Number, default: 0 },
  igst: { type: Number, default: 0 },
  total_amount: { type: Number, default: 0 },
  seller_name: { type: String, trim: true },
  buyer_name: { type: String, trim: true },
  place_of_supply: { type: String, trim: true },
  raw_text: { type: String }
}, { _id: false });

const validationResultSchema = new mongoose.Schema({
  is_valid: { type: Boolean, default: false },
  errors: [{ type: String }],
  warnings: [{ type: String }],
  compliance_score: { type: Number, min: 0, max: 100, default: 0 },
  checks: {
    gstin_seller_valid: { type: Boolean },
    gstin_buyer_valid: { type: Boolean },
    invoice_number_present: { type: Boolean },
    invoice_date_valid: { type: Boolean },
    taxable_amount_valid: { type: Boolean },
    tax_calculation_correct: { type: Boolean },
    total_amount_matches: { type: Boolean }
  }
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required'],
    index: true
  },
  original_filename: {
    type: String,
    required: [true, 'Filename is required'],
    trim: true
  },
  stored_filename: {
    type: String,
    required: true
  },
  file_path: {
    type: String,
    required: true
  },
  file_type: {
    type: String,
    enum: ['pdf', 'image'],
    required: true
  },
  file_size: {
    type: Number,
    required: true
  },
  mime_type: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['uploaded', 'processing', 'extracted', 'validated', 'failed'],
    default: 'uploaded',
    index: true
  },
  compliance_status: {
    type: String,
    enum: ['valid', 'invalid', 'warning', 'pending'],
    default: 'pending',
    index: true
  },
  extracted_data: {
    type: extractedDataSchema,
    default: null
  },
  validation_result: {
    type: validationResultSchema,
    default: null
  },
  processing_time_ms: {
    type: Number,
    default: 0
  },
  ocr_confidence: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  batch_id: {
    type: String,
    index: true
  },
  error_message: {
    type: String
  },
  processing_attempts: {
    type: Number,
    default: 0
  },
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  tags: [{ type: String }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient querying
invoiceSchema.index({ user: 1, createdAt: -1 });
invoiceSchema.index({ user: 1, compliance_status: 1 });
invoiceSchema.index({ user: 1, status: 1 });
invoiceSchema.index({ 'extracted_data.gstin_seller': 1 });
invoiceSchema.index({ 'extracted_data.gstin_buyer': 1 });
invoiceSchema.index({ batch_id: 1, user: 1 });

// Virtual for display name
invoiceSchema.virtual('display_name').get(function () {
  return this.extracted_data?.invoice_number || this.original_filename;
});

// Virtual for total tax
invoiceSchema.virtual('total_tax').get(function () {
  if (!this.extracted_data) return 0;
  const { cgst = 0, sgst = 0, igst = 0 } = this.extracted_data;
  return cgst + sgst + igst;
});

// Static method for invoice statistics
invoiceSchema.statics.getStats = async function (userId, dateRange = {}) {
  const matchStage = { user: mongoose.Types.ObjectId(userId) };
  if (dateRange.from || dateRange.to) {
    matchStage.createdAt = {};
    if (dateRange.from) matchStage.createdAt.$gte = new Date(dateRange.from);
    if (dateRange.to) matchStage.createdAt.$lte = new Date(dateRange.to);
  }

  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        total_invoices: { $sum: 1 },
        valid_invoices: {
          $sum: { $cond: [{ $eq: ['$compliance_status', 'valid'] }, 1, 0] }
        },
        invalid_invoices: {
          $sum: { $cond: [{ $eq: ['$compliance_status', 'invalid'] }, 1, 0] }
        },
        total_cgst: { $sum: '$extracted_data.cgst' },
        total_sgst: { $sum: '$extracted_data.sgst' },
        total_igst: { $sum: '$extracted_data.igst' },
        total_taxable: { $sum: '$extracted_data.taxable_amount' },
        total_amount: { $sum: '$extracted_data.total_amount' },
        avg_confidence: { $avg: '$ocr_confidence' }
      }
    }
  ]);

  return stats[0] || {
    total_invoices: 0,
    valid_invoices: 0,
    invalid_invoices: 0,
    total_cgst: 0,
    total_sgst: 0,
    total_igst: 0,
    total_taxable: 0,
    total_amount: 0,
    avg_confidence: 0
  };
};

module.exports = mongoose.model('Invoice', invoiceSchema);
