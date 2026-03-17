import React, { useState } from 'react';
import api from '../api/client';

const DatasetManager = ({ onUploadSuccess }) => {
  const [file, setFile]           = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult]       = useState(null);
  const [error, setError]         = useState('');

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

  const btnClass = uploading ? 'loading' : file ? 'ready' : 'disabled';

  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
        Accepts{' '}
        <code style={{ color: 'var(--indigo)', background: 'rgba(99,102,241,0.1)', padding: '1px 5px', borderRadius: 4 }}>.txt</code>
        {' '}or{' '}
        <code style={{ color: 'var(--indigo)', background: 'rgba(99,102,241,0.1)', padding: '1px 5px', borderRadius: 4 }}>.csv</code>
        {' '}edge lists in <em>node1 node2</em> format.
      </p>

      <div className="upload-area">
        <input
          type="file"
          accept=".txt,.csv"
          onChange={(e) => { setFile(e.target.files[0]); setResult(null); setError(''); }}
        />
        <div className="upload-icon">📂</div>
        <p className="upload-label">
          {file ? 'File selected' : 'Click or drag a file here'}
        </p>
        {file
          ? <p className="upload-filename">⬡ {file.name}</p>
          : <p className="upload-sublabel">.txt or .csv — SNAP edge-list format</p>
        }
      </div>

      <button
        className={`btn-primary ${btnClass}`}
        onClick={handleUpload}
        disabled={uploading || !file}
      >
        {uploading ? '⟳  Ingesting…' : '↑  Upload & Ingest'}
      </button>

      {result && (
        <div className="alert-success">
          ✓ Ingested successfully —{' '}
          <strong>{result.num_nodes?.toLocaleString()}</strong> nodes,{' '}
          <strong>{result.num_edges?.toLocaleString()}</strong> edges
          {' '}· Dataset ID: <strong>{result.dataset_id}</strong>
        </div>
      )}

      {error && <div className="alert-error">✗ {error}</div>}
    </div>
  );
};

export default DatasetManager;
