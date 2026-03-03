const express = require('express');
const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Main dashboard stats
router.get('/stats', asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const userId = req.user._id;

  const matchStage = { user: userId };
  if (from || to) {
    matchStage.createdAt = {};
    if (from) matchStage.createdAt.$gte = new Date(from);
    if (to) matchStage.createdAt.$lte = new Date(to);
  }

  const [overview, byStatus, byMonth, topGSTINs, recentActivity] = await Promise.all([
    // Overview stats
    Invoice.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          total_invoices: { $sum: 1 },
          valid_count: { $sum: { $cond: [{ $eq: ['$compliance_status', 'valid'] }, 1, 0] } },
          invalid_count: { $sum: { $cond: [{ $eq: ['$compliance_status', 'invalid'] }, 1, 0] } },
          warning_count: { $sum: { $cond: [{ $eq: ['$compliance_status', 'warning'] }, 1, 0] } },
          pending_count: { $sum: { $cond: [{ $eq: ['$compliance_status', 'pending'] }, 1, 0] } },
          processing_count: { $sum: { $cond: [{ $eq: ['$status', 'processing'] }, 1, 0] } },
          total_cgst: { $sum: '$extracted_data.cgst' },
          total_sgst: { $sum: '$extracted_data.sgst' },
          total_igst: { $sum: '$extracted_data.igst' },
          total_taxable: { $sum: '$extracted_data.taxable_amount' },
          total_amount: { $sum: '$extracted_data.total_amount' },
          avg_confidence: { $avg: '$ocr_confidence' },
          avg_processing_time: { $avg: '$processing_time_ms' },
          total_file_size: { $sum: '$file_size' }
        }
      }
    ]),

    // By compliance status breakdown
    Invoice.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$compliance_status',
          count: { $sum: 1 },
          total_amount: { $sum: '$extracted_data.total_amount' }
        }
      }
    ]),

    // Monthly trend
    Invoice.aggregate([
      { $match: { ...matchStage } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 },
          valid: { $sum: { $cond: [{ $eq: ['$compliance_status', 'valid'] }, 1, 0] } },
          invalid: { $sum: { $cond: [{ $eq: ['$compliance_status', 'invalid'] }, 1, 0] } },
          total_gst: {
            $sum: {
              $add: [
                { $ifNull: ['$extracted_data.cgst', 0] },
                { $ifNull: ['$extracted_data.sgst', 0] },
                { $ifNull: ['$extracted_data.igst', 0] }
              ]
            }
          }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 12 }
    ]),

    // Top GSTINs by invoice count
    Invoice.aggregate([
      { $match: { ...matchStage, 'extracted_data.gstin_seller': { $exists: true, $ne: '' } } },
      {
        $group: {
          _id: '$extracted_data.gstin_seller',
          count: { $sum: 1 },
          total_amount: { $sum: '$extracted_data.total_amount' },
          seller_name: { $first: '$extracted_data.seller_name' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]),

    // Recent invoices activity
    Invoice.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('original_filename compliance_status status extracted_data.invoice_number extracted_data.total_amount createdAt ocr_confidence')
      .lean()
  ]);

  const stats = overview[0] || {
    total_invoices: 0, valid_count: 0, invalid_count: 0, warning_count: 0,
    pending_count: 0, processing_count: 0, total_cgst: 0, total_sgst: 0,
    total_igst: 0, total_taxable: 0, total_amount: 0, avg_confidence: 0,
    avg_processing_time: 0, total_file_size: 0
  };

  stats.total_gst = (stats.total_cgst || 0) + (stats.total_sgst || 0) + (stats.total_igst || 0);
  stats.compliance_rate = stats.total_invoices > 0
    ? Math.round((stats.valid_count / stats.total_invoices) * 100)
    : 0;

  // Format monthly data
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyTrend = byMonth.map(m => ({
    period: `${monthNames[m._id.month - 1]} ${m._id.year}`,
    month: m._id.month,
    year: m._id.year,
    total: m.count,
    valid: m.valid,
    invalid: m.invalid,
    total_gst: m.total_gst
  }));

  res.json({
    overview: stats,
    by_status: byStatus.reduce((acc, item) => {
      acc[item._id] = { count: item.count, total_amount: item.total_amount };
      return acc;
    }, {}),
    monthly_trend: monthlyTrend,
    top_gstins: topGSTINs,
    recent_activity: recentActivity
  });
}));

// Compliance breakdown
router.get('/compliance', asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const validationErrors = await Invoice.aggregate([
    { $match: { user: userId, compliance_status: 'invalid' } },
    { $unwind: '$validation_result.errors' },
    {
      $group: {
        _id: '$validation_result.errors',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);

  const fileTypeBreakdown = await Invoice.aggregate([
    { $match: { user: userId } },
    {
      $group: {
        _id: '$file_type',
        count: { $sum: 1 },
        avg_confidence: { $avg: '$ocr_confidence' },
        avg_processing_time: { $avg: '$processing_time_ms' }
      }
    }
  ]);

  res.json({
    common_errors: validationErrors.map(e => ({ error: e._id, count: e.count })),
    file_type_breakdown: fileTypeBreakdown
  });
}));

module.exports = router;
