import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/shared/Layout';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import InvoicesPage from './pages/InvoicesPage';
import UploadPage from './pages/UploadPage';
import InvoiceDetailPage from './pages/InvoiceDetailPage';
import ProfilePage from './pages/ProfilePage';

const Spinner = () => (
  <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#0f172a'}}>
    <div style={{width:40,height:40,border:'3px solid #334155',borderTop:'3px solid #14b8a6',borderRadius:'50%',animation:'spin 0.8s linear infinite'}} />
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

const Protected = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  return user ? children : <Navigate to="/login" replace />;
};

const Public = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  return user ? <Navigate to="/dashboard" replace /> : children;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<Public><LoginPage /></Public>} />
      <Route path="/signup" element={<Public><SignupPage /></Public>} />
      <Route path="/" element={<Protected><Layout /></Protected>}>
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="invoices/:id" element={<InvoiceDetailPage />} />
        <Route path="upload" element={<UploadPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster position="top-right" toastOptions={{
          style: { background:'#1e293b', color:'#f1f5f9', border:'1px solid #334155', borderRadius:'12px', fontSize:'14px', fontFamily:'DM Sans' },
          success: { iconTheme: { primary:'#10b981', secondary:'#fff' } },
          error: { iconTheme: { primary:'#ef4444', secondary:'#fff' } },
        }} />
      </BrowserRouter>
    </AuthProvider>
  );
}
