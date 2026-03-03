import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Eye, EyeOff, Loader, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
    } finally { setLoading(false); }
  };

 const fillDemo = (role) => {
   const d = {
     admin: { email: "admin@demo.com", password: "Admin123!" },
     accountant: { email: "accountant@demo.com", password: "Admin123!" },
     user: { email: "user@demo.com", password: "Admin123!" },
   };
   setForm(d[role]);
 };
  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-5/12 bg-slate-900 border-r border-slate-800 p-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-teal-500/30">
            <Shield size={18} className="text-white" />
          </div>
          <span className="text-lg font-bold text-white">GST Comply</span>
        </div>
        <div>
          <h2 className="text-3xl font-bold text-white leading-snug mb-4">
            AI-Powered GST<br />Compliance, Automated.
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-8">
            Upload GST invoices, extract data with OCR, validate compliance rules — all automatically.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[['300+','Invoices/batch'],['95%+','OCR accuracy'],['15s','Processing time'],['100%','Automated']].map(([s,l]) => (
              <div key={l} className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <p className="text-xl font-bold text-teal-400">{s}</p>
                <p className="text-xs text-slate-400 mt-0.5">{l}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-slate-600">© 2024 GST Comply · React · Node.js · FastAPI · MongoDB</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 justify-center mb-8">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center">
              <Shield size={16} className="text-white" />
            </div>
            <span className="text-lg font-bold text-white">GST Comply</span>
          </div>

          <h1 className="text-2xl font-bold text-white mb-1">Sign in</h1>
          <p className="text-sm text-slate-400 mb-6">Access your compliance dashboard</p>

          {/* Demo accounts */}
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 mb-5">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Demo Accounts</p>
            <div className="flex gap-2">
              {['admin','accountant','user'].map(r => (
                <button key={r} onClick={() => fillDemo(r)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 transition-all border border-slate-600">
                  {r}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl mb-4">
              <AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1.5">Email</label>
              <input type="email" required value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))}
                placeholder="you@example.com"
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-xl placeholder:text-slate-600 focus:outline-none focus:border-teal-500/60 transition-all" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1.5">Password</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} required value={form.password} onChange={e => setForm(p => ({...p, password: e.target.value}))}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-xl placeholder:text-slate-600 focus:outline-none focus:border-teal-500/60 transition-all pr-11" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className={`w-full py-3 rounded-xl font-semibold text-white text-sm transition-all flex items-center justify-center gap-2 mt-2
                ${loading ? 'bg-slate-600 cursor-not-allowed' : 'bg-teal-600 hover:bg-teal-500 shadow-lg shadow-teal-500/20'}`}>
              {loading ? <><Loader size={15} className="animate-spin" /> Signing in...</> : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-xs text-slate-500 mt-5">
            New here?{' '}
            <Link to="/signup" className="text-teal-400 hover:text-teal-300 font-semibold">Create account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
