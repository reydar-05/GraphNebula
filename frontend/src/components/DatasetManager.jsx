import React, { useState } from 'react';
import api from '../api/client';

const DatasetManager = ({ onUploadSuccess }) => {
  const [file, setFile]         = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult]     = useState(null);   // { dataset_id, num_nodes, num_edges }
  const [error, setError]       = useState('');

  const handleUpload = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setUploading(true);
    setError('');
    setResult(null);
    try {
      const res = await api.post('/upload-dataset', formData);
      const d = res.data;
      setResult(d);
      onUploadSuccess(d.dataset_id, { name: file.name, num_nodes: d.num_nodes, num_edges: d.num_edges });
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Upload failed. Check the server logs.');
    }
    setUploading(false);
  };

  return (
    <div>
      <h3 style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
        Upload SNAP Edge List
      </h3>
      <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#64748b' }}>
        Accepts .txt or .csv files in <code>node1 node2</code> format (lines starting with # are ignored).
      </p>

      <input
        type="file"
        accept=".txt,.csv"
        onChange={(e) => { setFile(e.target.files[0]); setResult(null); setError(''); }}
        style={{ fontSize: '13px', marginBottom: '10px', display: 'block', width: '100%' }}
      />

      <button
        onClick={handleUpload}
        disabled={uploading || !file}
        style={{
          padding: '7px 16px', borderRadius: '7px', border: 'none', cursor: file && !uploading ? 'pointer' : 'not-allowed',
          background: file && !uploading ? '#3b82f6' : '#cbd5e1', color: 'white', fontWeight: 600, fontSize: '13px',
        }}
      >
        {uploading ? 'Ingesting…' : 'Upload & Ingest'}
      </button>

      {result && (
        <div style={{ marginTop: '10px', padding: '8px 12px', borderRadius: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: '13px', color: '#166534' }}>
          ✓ Ingested — <strong>{result.num_nodes?.toLocaleString()}</strong> nodes,{' '}
          <strong>{result.num_edges?.toLocaleString()}</strong> edges &nbsp;·&nbsp; Dataset ID: <strong>{result.dataset_id}</strong>
        </div>
      )}

      {error && (
        <div style={{ marginTop: '10px', padding: '8px 12px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fecaca', fontSize: '13px', color: '#991b1b' }}>
          ✗ {error}
        </div>
      )}
    </div>
  );
};

export default DatasetManager;
