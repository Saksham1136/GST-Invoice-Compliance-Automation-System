import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { FileText, CheckCircle, AlertTriangle, IndianRupee, Upload, RefreshCw, ExternalLink, Clock, Percent } from 'lucide-react';
import api from '../utils/api';
import { formatCurrency, formatRelative } from '../utils/formatters';

const Stat = ({ title, value, sub, icon: Icon, color, loading }) => {
  const c = { teal:'from-teal-500/10 border-teal-500/20 text-teal-400', green:'from-emerald-500/10 border-emerald-500/20 text-emerald-400', amber:'from-amber-500/10 border-amber-500/20 text-amber-400', blue:'from-blue-500/10 border-blue-500/20 text-blue-400' };
  return (
    <div className={`rounded-2xl border bg-gradient-to-br to-transparent p-5 ${c[color]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{title}</p>
          {loading ? <div className="h-7 w-20 bg-slate-700/50 rounded animate-pulse mt-1" /> : <p className="text-2xl font-bold text-white">{value}</p>}
          {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
        </div>
        <div className="p-2.5 rounded-xl bg-slate-800/50"><Icon size={18} className={c[color].split(' ').pop()} /></div>
      </div>
    </div>
  );
};

const StatusTag = ({ s }) => {
  const m = { valid:'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', invalid:'bg-red-500/15 text-red-400 border-red-500/30', warning:'bg-amber-500/15 text-amber-400 border-amber-500/30', pending:'bg-slate-500/15 text-slate-400 border-slate-500/30', processing:'bg-blue-500/15 text-blue-400 border-blue-500/30' };
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${m[s]||m.pending}`}>{s}</span>;
};

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-xl p-3 shadow-xl text-xs">
      <p className="font-semibold text-slate-200 mb-1">{label}</p>
      {payload.map((p,i) => <p key={i} style={{color:p.color}}>{p.name}: {p.value}</p>)}
    </div>
  );
};

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try { const r = await api.get('/dashboard/stats'); setStats(r.data); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const ov = stats?.overview;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthly = stats?.monthly_trend?.map(m => ({ period:`${months[m.month-1]} ${m.year}`, valid:m.valid, invalid:m.invalid })) || [];
  const pie = ov ? [
    { name:'Valid', value: ov.valid_count||0, color:'#10b981' },
    { name:'Invalid', value: ov.invalid_count||0, color:'#ef4444' },
    { name:'Warning', value: ov.warning_count||0, color:'#f59e0b' },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-0.5">GST compliance overview & analytics</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all border border-slate-700">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={() => navigate('/upload')} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-xl transition-all shadow-lg shadow-teal-500/20">
            <Upload size={13} /> Upload
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat title="Total Invoices" value={ov?.total_invoices?.toLocaleString()||'0'} icon={FileText} color="teal" loading={loading} sub="All time" />
        <Stat title="Valid Invoices" value={ov?.valid_count?.toLocaleString()||'0'} icon={CheckCircle} color="green" loading={loading} sub={`${ov?.compliance_rate||0}% compliance`} />
        <Stat title="Issues Found" value={((ov?.invalid_count||0)+(ov?.warning_count||0)).toLocaleString()} icon={AlertTriangle} color="amber" loading={loading} sub={`${ov?.invalid_count||0} errors`} />
        <Stat title="Total GST" value={formatCurrency(ov?.total_gst||0)} icon={IndianRupee} color="blue" loading={loading} sub={`Taxable: ${formatCurrency(ov?.total_taxable||0)}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-white">Monthly Trend</h2>
            <span className="text-xs text-slate-500">Last 12 months</span>
          </div>
          {loading ? <div className="h-48 bg-slate-800/50 rounded-xl animate-pulse" /> :
            monthly.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={monthly} margin={{top:5,right:10,bottom:5,left:0}}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                    <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="period" tick={{fontSize:10,fill:'#64748b'}} />
                  <YAxis tick={{fontSize:10,fill:'#64748b'}} />
                  <Tooltip content={<Tip />} />
                  <Area type="monotone" dataKey="valid" name="Valid" stroke="#10b981" strokeWidth={2} fill="url(#g1)" />
                  <Area type="monotone" dataKey="invalid" name="Invalid" stroke="#ef4444" strokeWidth={2} fill="url(#g2)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : <div className="h-48 flex items-center justify-center text-slate-600 text-sm">No data yet — upload some invoices!</div>
          }
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="text-sm font-bold text-white mb-4">Compliance Breakdown</h2>
          {loading ? <div className="h-48 bg-slate-800/50 rounded-xl animate-pulse" /> :
            pie.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pie} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" paddingAngle={3}>
                    {pie.map((e,i) => <Cell key={i} fill={e.color} stroke="transparent" />)}
                  </Pie>
                  <Tooltip />
                  <Legend iconType="circle" iconSize={8} formatter={v => <span style={{color:'#94a3b8',fontSize:11}}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center text-slate-600">
                <FileText size={28} className="mb-2 opacity-40" />
                <p className="text-sm">No invoices yet</p>
              </div>
            )
          }
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label:'Avg OCR Confidence', value:`${Math.round(ov?.avg_confidence||0)}%`, icon:Percent },
          { label:'Avg Processing', value:`${Math.round(ov?.avg_processing_time||0)}ms`, icon:Clock },
          { label:'CGST Collected', value:formatCurrency(ov?.total_cgst||0), icon:IndianRupee },
          { label:'IGST Collected', value:formatCurrency(ov?.total_igst||0), icon:IndianRupee },
        ].map(({label,value,icon:Icon}) => (
          <div key={label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
            <Icon size={16} className="mx-auto text-teal-400 mb-2" />
            <p className="text-lg font-bold text-white">{loading ? '...' : value}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-white">Recent Invoices</h2>
          <button onClick={() => navigate('/invoices')} className="flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 transition-colors">
            View all <ExternalLink size={11} />
          </button>
        </div>
        {loading ? (
          <div className="space-y-3">{[...Array(5)].map((_,i) => <div key={i} className="h-12 bg-slate-800/50 rounded-xl animate-pulse" />)}</div>
        ) : stats?.recent_activity?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  <th className="text-left pb-3 pr-4">File</th>
                  <th className="text-left pb-3 pr-4">Invoice No.</th>
                  <th className="text-left pb-3 pr-4">Amount</th>
                  <th className="text-left pb-3 pr-4">Status</th>
                  <th className="text-left pb-3">Uploaded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {stats.recent_activity.map(inv => (
                  <tr key={inv._id} onClick={() => navigate(`/invoices/${inv._id}`)} className="cursor-pointer hover:bg-slate-800/30 transition-colors group">
                    <td className="py-3 pr-4 text-xs text-slate-300 group-hover:text-white font-medium truncate max-w-[150px]">{inv.original_filename}</td>
                    <td className="py-3 pr-4 text-xs text-slate-500 font-mono">{inv.extracted_data?.invoice_number||'—'}</td>
                    <td className="py-3 pr-4 text-xs text-slate-300 font-medium">{inv.extracted_data?.total_amount ? formatCurrency(inv.extracted_data.total_amount) : '—'}</td>
                    <td className="py-3 pr-4"><StatusTag s={inv.compliance_status} /></td>
                    <td className="py-3 text-xs text-slate-600">{formatRelative(inv.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Upload size={28} className="mx-auto text-slate-700 mb-3" />
            <p className="text-slate-500 text-sm">No invoices yet</p>
            <button onClick={() => navigate('/upload')} className="mt-4 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold rounded-xl transition-all">Upload Invoice</button>
          </div>
        )}
      </div>
    </div>
  );
}
