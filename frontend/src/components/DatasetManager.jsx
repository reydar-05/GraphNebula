import React, { useState } from 'react';
import api from '../api/client';

const DatasetManager = ({ onUploadSuccess }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!file) return alert("Please select a file first.");
    
    const formData = new FormData();
    formData.append("file", file);
    
    setUploading(true);
    try {
      const res = await api.post("/upload-dataset", formData);
      alert(`Success! Dataset ID: ${res.data.dataset_id}`);
      onUploadSuccess(res.data.dataset_id);
    } catch (err) {
      console.error(err);
      alert("Upload failed.");
    }
    setUploading(false);
  };

  return (
    <div style={{ padding: '20px', background: '#f4f4f9', borderRadius: '8px', marginBottom: '20px' }}>
      <h3>1. Upload SNAP Dataset (Edge List)</h3>
      <input type="file" accept=".txt,.csv" onChange={(e) => setFile(e.target.files[0])} />
      <button onClick={handleUpload} disabled={uploading} style={{ marginLeft: '10px' }}>
        {uploading ? "Uploading..." : "Upload & Ingest"}
      </button>
    </div>
  );
};

export default DatasetManager;