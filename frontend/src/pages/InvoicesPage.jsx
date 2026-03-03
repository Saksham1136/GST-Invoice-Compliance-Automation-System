import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Download, RefreshCw, ChevronLeft, ChevronRight, FileText, Eye, Trash2, RotateCcw, Filter, X } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { formatCurrency, formatRelative, formatFileSize } from '../utils/formatters';

const Tag = ({ s }) => {
  const m = { valid:'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', invalid:'bg-red-500/15 text-red-400 border-red-500/30', warning:'bg-amber-500/15 text-amber-400 border-amber-500/30', pending:'bg-slate-500/15 text-slate-400 border-slate-500/30', processing:'bg-blue-500/15 text-blue-400 border-blue-500/30' };
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${m[s]||m.pending}`}>{s}</span>;
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [pagination, setPagination] = useState({ page:1, pages:1, total:0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [exporting, setExporting] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit:15 };
      if (status !== 'all') params.compliance_status = status;
      if (search) params.search = search;
      if (from) params.from = from;
      if (to) params.to = to;
      const res = await api.get('/invoices', { params });
      setInvoices(res.data.invoices);
      setPagination(res.data.pagination);
    } catch { toast.error('Failed to load invoices'); }
    finally { setLoading(false); }
  }, [page, status, search, from, to]);

  useEffect(() => { load(); }, [load]);

  const del = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this invoice?')) return;
    try { await api.delete(`/invoices/${id}`); toast.success('Deleted'); load(); }
    catch { toast.error('Delete failed'); }
  };

  const reprocess = async (id, e) => {
    e.stopPropagation();
    try { await api.post(`/invoices/${id}/reprocess`); toast.success('Reprocessing started'); load(); }
    catch { toast.error('Failed'); }
  };

  const exportData = async (fmt) => {
    setExporting(true);
    try {
      const params = {};
      if (status !== 'all') params.compliance_status = status;
      if (from) params.from = from;
      if (to) params.to = to;
      const res = await api.get(`/invoices/export/${fmt}`, { params, responseType:'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = `gst-invoices.${fmt === 'excel' ? 'xlsx' : 'csv'}`; a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported as ${fmt.toUpperCase()}`);
    } catch { toast.error('Export failed'); }
    finally { setExporting(false); }
  };

  const reset = () => { setStatus('all'); setSearch(''); setFrom(''); setTo(''); setPage(1); };
  const hasFilters = status !== 'all' || search || from || to;

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Invoices</h1>
          <p className="text-sm text-slate-400 mt-0.5">{pagination.total} invoice{pagination.total !== 1 ? 's' : ''} total</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportData('csv')} disabled={exporting} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-all"><Download size={13} /> CSV</button>
          <button onClick={() => exportData('excel')} disabled={exporting} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-all"><Download size={13} /> Excel</button>
          <button onClick={load} className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-all"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" />
            <input type="text" placeholder="Search invoices..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-xl placeholder:text-slate-600 focus:outline-none focus:border-teal-500/50 transition-all" />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-2 px-4 py-2.5 text-sm rounded-xl border transition-all ${showFilters || hasFilters ? 'bg-teal-500/10 border-teal-500/30 text-teal-300' : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'}`}>
            <Filter size={13} /> Filters {hasFilters && <span className="w-1.5 h-1.5 bg-teal-400 rounded-full" />}
          </button>
        </div>

        <div className="flex gap-2 flex-wrap">
          {['all','valid','invalid','warning','pending'].map(s => (
            <button key={s} onClick={() => { setStatus(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize border transition-all ${status === s ? 'bg-teal-500/15 border-teal-500/30 text-teal-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'}`}>
              {s === 'all' ? 'All' : s}
            </button>
          ))}
          {hasFilters && <button onClick={reset} className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 transition-colors"><X size={11} /> Reset</button>}
        </div>

        {showFilters && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">From Date</label>
              <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-slate-200 text-xs rounded-lg focus:outline-none focus:border-teal-500/50" />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">To Date</label>
              <input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1); }} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-slate-200 text-xs rounded-lg focus:outline-none focus:border-teal-500/50" />
            </div>
          </div>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">{[...Array(6)].map((_,i) => <div key={i} className="h-14 bg-slate-800/50 rounded-xl animate-pulse" />)}</div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-20">
            <FileText size={32} className="mx-auto text-slate-700 mb-3" />
            <p className="text-slate-400 font-medium">No invoices found</p>
            <p className="text-slate-600 text-sm mt-1">{hasFilters ? 'Try adjusting your filters' : 'Upload your first invoice'}</p>
            {hasFilters && <button onClick={reset} className="mt-3 text-sm text-teal-400 hover:text-teal-300">Clear filters</button>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-800">
                <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  {['Invoice','Inv No.','Seller GSTIN','Date','Total','Status','Confidence','Uploaded','Actions'].map(h => (
                    <th key={h} className={`${h === 'Total' || h === 'Actions' ? 'text-right' : 'text-left'} px-4 py-3`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {invoices.map(inv => (
                  <tr key={inv._id} onClick={() => navigate(`/invoices/${inv._id}`)} className="cursor-pointer hover:bg-slate-800/30 transition-colors group">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0"><FileText size={11} className="text-slate-500" /></div>
                        <span className="text-xs text-slate-300 group-hover:text-white font-medium truncate max-w-[130px] transition-colors">{inv.original_filename}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs font-mono text-slate-500">{inv.extracted_data?.invoice_number||'—'}</td>
                    <td className="px-4 py-3.5 text-xs font-mono text-slate-500">{inv.extracted_data?.gstin_seller||'—'}</td>
                    <td className="px-4 py-3.5 text-xs text-slate-500">{inv.extracted_data?.invoice_date||'—'}</td>
                    <td className="px-4 py-3.5 text-xs text-right font-medium text-slate-200">{inv.extracted_data?.total_amount ? formatCurrency(inv.extracted_data.total_amount) : '—'}</td>
                    <td className="px-4 py-3.5"><Tag s={inv.status === 'processing' ? 'processing' : inv.compliance_status} /></td>
                    <td className="px-4 py-3.5 text-xs text-right text-slate-500">{inv.ocr_confidence ? `${Math.round(inv.ocr_confidence)}%` : '—'}</td>
                    <td className="px-4 py-3.5 text-xs text-slate-600">{formatRelative(inv.createdAt)}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                        <button onClick={() => navigate(`/invoices/${inv._id}`)} className="p-1.5 text-slate-600 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-all"><Eye size={12} /></button>
                        {inv.status === 'failed' && <button onClick={e => reprocess(inv._id, e)} className="p-1.5 text-slate-600 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-all"><RotateCcw size={12} /></button>}
                        <button onClick={e => del(inv._id, e)} className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">Showing {((page-1)*15)+1}–{Math.min(page*15, pagination.total)} of {pagination.total}</p>
          <div className="flex gap-1">
            <button disabled={page <= 1} onClick={() => setPage(p => p-1)} className="p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all"><ChevronLeft size={15} /></button>
            {[...Array(Math.min(pagination.pages, 5))].map((_,i) => (
              <button key={i+1} onClick={() => setPage(i+1)} className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${page === i+1 ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>{i+1}</button>
            ))}
            <button disabled={page >= pagination.pages} onClick={() => setPage(p => p+1)} className="p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all"><ChevronRight size={15} /></button>
          </div>
        </div>
      )}
    </div>
  );
}
