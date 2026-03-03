import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle, RefreshCw, Trash2, Loader, IndianRupee } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { formatCurrency, formatRelative } from '../utils/formatters';

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const r = await api.get(`/invoices/${id}`);
      setInvoice(r.data.invoice);
    } catch {
      toast.error('Invoice not found');
      navigate('/invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const del = async () => {
    if (!window.confirm('Delete this invoice?')) return;
    try {
      await api.delete(`/invoices/${id}`);
      toast.success('Deleted');
      navigate('/invoices');
    } catch {
      toast.error('Delete failed');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader size={22} className="animate-spin text-teal-400" />
      </div>
    );
  }

  if (!invoice) return null;

  const ext = invoice.extracted_data || {};
  const val = invoice.validation_result || {};
  const status = invoice.compliance_status;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/invoices')}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={16} /> Back to Invoices
        </button>
        <div className="flex gap-2">
          <button
            onClick={del}
            className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-xl border border-red-500/20 transition-all"
          >
            <Trash2 size={13} /> Delete
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">{invoice.original_filename}</h1>
            <p className="text-sm text-slate-500 mt-1">
              Uploaded {formatRelative(invoice.createdAt)} • {Math.round(invoice.file_size / 1024)} KB
            </p>
          </div>
          <span
            className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase ${
              status === 'valid'
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                : status === 'warning'
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                : 'bg-red-500/15 text-red-300 border border-red-500/30'
            }`}
          >
            {status}
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-800/50 rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-1">Invoice Number</p>
            <p className="text-sm font-mono text-white">{ext.invoice_number || '—'}</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-1">Date</p>
            <p className="text-sm text-white">{ext.invoice_date || '—'}</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-1">Total Amount</p>
            <p className="text-sm font-bold text-white">
              {ext.total_amount ? formatCurrency(ext.total_amount) : '—'}
            </p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-1">OCR Confidence</p>
            <p className="text-sm font-bold text-teal-300">{Math.round(invoice.ocr_confidence || 0)}%</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white mb-3">Tax Breakdown</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Taxable Amount', value: ext.taxable_amount },
                { label: 'CGST', value: ext.cgst },
                { label: 'SGST', value: ext.sgst },
                { label: 'IGST', value: ext.igst },
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-800/30 rounded-lg p-3">
                  <p className="text-xs text-slate-600">{label}</p>
                  <p className="text-sm font-semibold text-slate-200">
                    {value ? formatCurrency(value) : '₹0.00'}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-white mb-3">Party Details</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="bg-slate-800/30 rounded-lg p-3">
                <p className="text-xs text-slate-600 mb-1">Seller GSTIN</p>
                <p className="text-sm font-mono text-slate-200">{ext.gstin_seller || 'Not extracted'}</p>
              </div>
              <div className="bg-slate-800/30 rounded-lg p-3">
                <p className="text-xs text-slate-600 mb-1">Buyer GSTIN</p>
                <p className="text-sm font-mono text-slate-200">{ext.gstin_buyer || 'Not extracted'}</p>
              </div>
            </div>
          </div>

          {val.checks && (
            <div>
              <h3 className="text-sm font-bold text-white mb-3">Validation Checks</h3>
              <div className="space-y-2">
                {Object.entries(val.checks).map(([key, passed]) => (
                  <div key={key} className="flex items-center gap-2">
                    {passed ? (
                      <CheckCircle size={14} className="text-emerald-400" />
                    ) : (
                      <XCircle size={14} className="text-red-400" />
                    )}
                    <span className="text-xs text-slate-300">{key.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {val.errors && val.errors.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <h3 className="text-sm font-bold text-red-300 mb-2">Errors</h3>
              {val.errors.map((err, i) => (
                <p key={i} className="text-xs text-red-400">
                  • {err}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
