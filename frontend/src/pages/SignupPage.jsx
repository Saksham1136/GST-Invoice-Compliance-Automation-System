import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Eye, EyeOff, Loader, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function SignupPage() {
  const [form, setForm] = useState({ name:'', email:'', password:'', role:'user', company:'' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      await signup(form);
      toast.success('Account created! Welcome aboard.');
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Signup failed. Please try again.');
    } finally { setLoading(false); }
  };

  const inp = "w-full px-4 py-3 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-xl placeholder:text-slate-600 focus:outline-none focus:border-teal-500/60 transition-all";

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-teal-500/30 mx-auto mb-4">
            <Shield size={20} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Create account</h1>
          <p className="text-sm text-slate-400 mt-1">
            Start automating your GST compliance
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl mb-4">
            <AlertCircle
              size={14}
              className="text-red-400 mt-0.5 flex-shrink-0"
            />
            <p className="text-xs text-red-300">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1.5">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="John Doe"
                className={inp}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1.5">
                Role *
              </label>
              <select
                value={form.role}
                onChange={(e) =>
                  setForm((p) => ({ ...p, role: e.target.value }))
                }
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-xl focus:outline-none focus:border-teal-500/60 transition-all"
              >
                <option value="user">User</option>
                <option value="accountant">Accountant</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1.5">
              Email *
            </label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) =>
                setForm((p) => ({ ...p, email: e.target.value }))
              }
              placeholder="you@company.com"
              className={inp}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1.5">
              Company (optional)
            </label>
            <input
              type="text"
              value={form.company}
              onChange={(e) =>
                setForm((p) => ({ ...p, company: e.target.value }))
              }
              placeholder="Your company name"
              className={inp}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1.5">
              Password *{" "}
              <span className="text-slate-600 font-normal">
                (min 8 characters)
              </span>
            </label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                required
                value={form.password}
                onChange={(e) =>
                  setForm((p) => ({ ...p, password: e.target.value }))
                }
                placeholder="Min 8 chars, uppercase, number"
                className={inp + " pr-11"}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded-xl font-semibold text-white text-sm transition-all flex items-center justify-center gap-2
              ${loading ? "bg-slate-600 cursor-not-allowed" : "bg-teal-600 hover:bg-teal-500 shadow-lg shadow-teal-500/20"}`}
          >
            {loading ? (
              <>
                <Loader size={15} className="animate-spin" /> Creating
                account...
              </>
            ) : (
              "Create account"
            )}
          </button>
        </form>

        <p className="text-center text-xs text-slate-500 mt-5">
          Already have an account?{" "}
          <Link
            to="/login"
            className="text-teal-400 hover:text-teal-300 font-semibold"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
