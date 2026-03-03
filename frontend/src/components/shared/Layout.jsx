import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LayoutDashboard, FileText, Upload, User, LogOut, Menu, X, Shield, ChevronRight } from 'lucide-react';

const nav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/invoices', icon: FileText, label: 'Invoices' },
  { to: '/upload', icon: Upload, label: 'Upload' },
  { to: '/profile', icon: User, label: 'Profile' },
];

const roleColors = {
  admin: 'bg-red-500/20 text-red-300 border-red-400/30',
  accountant: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
  user: 'bg-teal-500/20 text-teal-300 border-teal-400/30',
};

export default function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => { await logout(); navigate('/login'); };

  const Sidebar = () => (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-teal-500/25">
          <Shield size={16} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-white">GST Comply</p>
          <p className="text-[10px] text-slate-500">AI Invoice Processing</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group
              ${isActive ? 'bg-teal-500/10 text-teal-300' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`
            }>
            {({ isActive }) => (<>
              <Icon size={17} className={isActive ? 'text-teal-400' : 'text-slate-500 group-hover:text-slate-300'} />
              <span>{label}</span>
              {isActive && <ChevronRight size={13} className="ml-auto text-teal-500" />}
            </>)}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-slate-800">
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-800/50 mb-2">
          <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
            {user?.name?.charAt(0)?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-200 truncate">{user?.name}</p>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border uppercase tracking-wider ${roleColors[user?.role] || roleColors.user}`}>
              {user?.role}
            </span>
          </div>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm text-slate-400 hover:text-red-300 hover:bg-red-500/10 transition-all group">
          <LogOut size={15} className="group-hover:text-red-400" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 fixed top-0 left-0 h-screen z-30">
        <Sidebar />
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="relative w-56 z-10">
            <button onClick={() => setOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white z-10">
              <X size={18} />
            </button>
            <Sidebar />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 lg:ml-56 flex flex-col">
        {/* Mobile topbar */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
          <button onClick={() => setOpen(true)} className="text-slate-300"><Menu size={20} /></button>
          <div className="flex items-center gap-2">
            <Shield size={15} className="text-teal-400" />
            <span className="text-sm font-bold text-white">GST Comply</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-xs font-bold text-white">
            {user?.name?.charAt(0)?.toUpperCase()}
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
