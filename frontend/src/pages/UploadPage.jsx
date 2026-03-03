import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, Image, X, CheckCircle, AlertCircle, Loader, Info, ChevronRight } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { formatFileSize } from '../utils/formatters';

export default function UploadPage() {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const navigate = useNavigate();

  const onDrop = useCallback((accepted, rejected) => {
    setFiles(prev => [...prev, ...accepted.map(f => ({ id: Math.random().toString(36).slice(2), file: f, status: 'pending' }))]);
    rejected.forEach(r => toast.error(`${r.file.name}: ${r.errors[0]?.message || 'Invalid file'}`));
  }, []);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: { 'application/pdf':['.pdf'], 'image/jpeg':['.jpg','.jpeg'], 'image/png':['.png'], 'image/tiff':['.tiff'], 'image/webp':['.webp'] },
    maxSize: 10*1024*1024,
    multiple: true,
  });

  const remove = (id) => setFiles(p => p.filter(f => f.id !== id));
  const clear = () => { setFiles([]); setResult(null); };

  const upload = async () => {
    if (!files.length) return toast.error('Please add files');
    setUploading(true);
    setFiles(p => p.map(f => ({...f, status:'uploading'})));
    try {
      const formData = new FormData();
      if (files.length === 1) {
        formData.append('invoice', files[0].file);
        const res = await api.post('/invoices/upload', formData, { headers:{'Content-Type':'multipart/form-data'} });
        setFiles(p => p.map(f => ({...f, status:'success'})));
        toast.success('Invoice uploaded! Processing started.');
        setResult({ type:'single', id: res.data.invoice_id });
      } else {
        files.forEach(f => formData.append('invoices', f.file));
        const res = await api.post('/invoices/upload/bulk', formData, { headers:{'Content-Type':'multipart/form-data'} });
        setFiles(p => p.map(f => ({...f, status:'success'})));
        toast.success(`${res.data.total} invoices uploaded!`);
        setResult({ type:'batch', total: res.data.total });
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Upload failed';
      toast.error(msg);
      setFiles(p => p.map(f => ({...f, status:'error', error: msg})));
    } finally { setUploading(false); }
  };

  const statusIcon = (s) => ({
    pending: <FileText size={12} className="text-slate-400" />,
    uploading: <Loader size={12} className="animate-spin text-blue-400" />,
    success: <CheckCircle size={12} className="text-emerald-400" />,
    error: <AlertCircle size={12} className="text-red-400" />,
  })[s];

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Upload Invoices</h1>
        <p className="text-sm text-slate-400 mt-0.5">AI-powered OCR extraction & GST compliance validation</p>
      </div>

      <div className="flex items-start gap-3 p-4 bg-teal-500/8 border border-teal-500/20 rounded-xl">
        <Info size={15} className="text-teal-400 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-teal-300">
          <p className="font-semibold">Supported: PDF, JPEG, PNG, TIFF, WEBP</p>
          <p className="text-teal-400/70 mt-0.5">Max 10MB per file · Max 20 files per batch · Processing: 15–60 seconds</p>
        </div>
      </div>

      <div {...getRootProps()} className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200
        ${isDragActive && !isDragReject ? 'border-teal-400 bg-teal-400/5 scale-[1.01]' : ''}
        ${isDragReject ? 'border-red-400 bg-red-400/5' : ''}
        ${!isDragActive ? 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/30' : ''}`}>
        <input {...getInputProps()} />
        <div className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-4 transition-colors ${isDragActive && !isDragReject ? 'bg-teal-500/20' : 'bg-slate-800'}`}>
          <Upload size={22} className={isDragActive && !isDragReject ? 'text-teal-400' : 'text-slate-500'} />
        </div>
        {isDragReject ? <p className="text-red-400 font-semibold">File type not supported</p> :
          isDragActive ? <p className="text-teal-300 font-semibold text-lg">Drop invoices here!</p> : (
          <div>
            <p className="text-white font-semibold">Drag & drop invoices here</p>
            <p className="text-slate-500 text-sm mt-1">or <span className="text-teal-400">click to browse</span></p>
          </div>
        )}
      </div>

      {files.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
            <p className="text-sm font-bold text-white">{files.length} file{files.length !== 1 ? 's' : ''}</p>
            {!uploading && <button onClick={clear} className="text-xs text-slate-500 hover:text-red-400 transition-colors">Clear all</button>}
          </div>
          <div className="divide-y divide-slate-800 max-h-64 overflow-y-auto">
            {files.map(({id, file, status, error}) => (
              <div key={id} className="flex items-center gap-3 px-5 py-3">
                {file.type === 'application/pdf' ? <FileText size={18} className="text-red-400 flex-shrink-0" /> : <Image size={18} className="text-blue-400 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 font-medium truncate">{file.name}</p>
                  <p className="text-xs text-slate-600">{formatFileSize(file.size)}</p>
                  {error && <p className="text-xs text-red-400">{error}</p>}
                </div>
                <div className="flex items-center gap-1 text-xs font-medium">
                  {statusIcon(status)}
                  <span className={status === 'success' ? 'text-emerald-400' : status === 'error' ? 'text-red-400' : status === 'uploading' ? 'text-blue-400' : 'text-slate-500'}>
                    {status === 'pending' ? 'Ready' : status === 'uploading' ? 'Uploading...' : status === 'success' ? 'Uploaded' : 'Failed'}
                  </span>
                </div>
                {status === 'pending' && !uploading && (
                  <button onClick={() => remove(id)} className="text-slate-600 hover:text-red-400 transition-colors ml-1"><X size={13} /></button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {files.some(f => f.status === 'pending') && (
        <button onClick={upload} disabled={uploading}
          className={`w-full py-3 rounded-xl font-semibold text-white text-sm transition-all flex items-center justify-center gap-2
            ${uploading ? 'bg-slate-700 cursor-not-allowed' : 'bg-teal-600 hover:bg-teal-500 shadow-lg shadow-teal-500/20'}`}>
          {uploading ? <><Loader size={15} className="animate-spin" /> Processing...</> : <><Upload size={15} /> Upload {files.filter(f=>f.status==='pending').length} Invoice{files.filter(f=>f.status==='pending').length !== 1 ? 's' : ''}</>}
        </button>
      )}

      {result && (
        <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <CheckCircle size={18} className="text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-bold text-emerald-300">{result.type === 'batch' ? `${result.total} invoices uploaded!` : 'Invoice uploaded!'}</p>
              <p className="text-xs text-emerald-400/70 mt-1">AI extraction started. Results ready in 15–60 seconds.</p>
              <div className="flex gap-4 mt-3">
                <button onClick={() => navigate('/invoices')} className="flex items-center gap-1 text-xs font-semibold text-emerald-300 hover:text-emerald-200 transition-colors">
                  View Invoices <ChevronRight size={11} />
                </button>
                {result.type === 'single' && (
                  <button onClick={() => navigate(`/invoices/${result.id}`)} className="flex items-center gap-1 text-xs font-semibold text-teal-300 hover:text-teal-200 transition-colors">
                    View Details <ChevronRight size={11} />
                  </button>
                )}
                <button onClick={clear} className="text-xs text-slate-500 hover:text-slate-300 transition-colors ml-auto">Upload more</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
