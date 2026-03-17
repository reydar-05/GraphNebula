import React, { useState } from 'react';
import api from '../api/client';

const AlgorithmRunner = ({ datasetId, onRunComplete }) => {
  const [algorithm, setAlgorithm] = useState('louvain');
  const [isRunning, setIsRunning] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const pollStatus = (taskId) => {
    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        try {
          const { data } = await api.get(`/task-status/${taskId}`);
          if (data.status === 'SUCCESS') {
            clearInterval(interval);
            resolve(data.result);
          } else if (data.status === 'FAILURE') {
            clearInterval(interval);
            reject(new Error(data.error || 'Task failed'));
          } else {
            setStatusMsg(`Status: ${data.status}...`);
          }
        } catch {
          clearInterval(interval);
          reject(new Error('Could not reach server'));
        }
      }, 2000); // poll every 2 seconds
    });
  };

  const handleRun = async () => {
    if (!datasetId) return alert('Please upload or select a dataset first.');
    setIsRunning(true);
    setStatusMsg('Submitting task...');

    try {
      let taskId;
      if (algorithm === 'graphsage') {
        const { data } = await api.post(`/train-model/${datasetId}`);
        taskId = data.task_id;
        setStatusMsg('Training GraphSAGE model...');
      } else {
        const { data } = await api.post(`/run-algorithm/${datasetId}?algo_name=${algorithm}`);
        taskId = data.task_id;
        setStatusMsg('Running algorithm...');
      }

      const result = await pollStatus(taskId);
      setStatusMsg('Done! Refreshing graph...');
      onRunComplete(result);   // pass result up so App can show communities_found
      setStatusMsg('');
    } catch (err) {
      console.error(err);
      setStatusMsg(`Error: ${err.message}`);
    }

    setIsRunning(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
      <h3 style={{ margin: '0 0 15px 0' }}>2. Run Algorithm</h3>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <select
          value={algorithm}
          onChange={(e) => setAlgorithm(e.target.value)}
          style={{ padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', flex: 1 }}
        >
          <option value="louvain">Louvain</option>
          <option value="leiden">Leiden</option>
          <option value="label_propagation">Label Propagation</option>
          <option value="walktrap">Walktrap</option>
          <option value="slpa">SLPA (Overlapping)</option>
          <option value="graphsage">GraphSAGE (PyTorch ML)</option>
        </select>
        <button
          onClick={handleRun}
          disabled={isRunning}
          style={{ backgroundColor: isRunning ? '#6b7280' : '#10b981', color: '#fff',
                   padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: isRunning ? 'not-allowed' : 'pointer' }}
        >
          {isRunning ? 'Running...' : 'Execute'}
        </button>
      </div>
      {statusMsg && (
        <p style={{ marginTop: '10px', fontSize: '13px', color: '#6b7280' }}>{statusMsg}</p>
      )}
    </div>
  );
};

export default AlgorithmRunner;
