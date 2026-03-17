import React, { useState } from 'react';
import api from '../api/client';

const AlgorithmRunner = ({ datasetId, onRunComplete }) => {
  const [algorithm, setAlgorithm] = useState('louvain');
  const [isRunning, setIsRunning] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const pollStatus = (taskId) =>
    new Promise((resolve, reject) => {
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
            setStatusMsg(`${data.status}`);
          }
        } catch {
          clearInterval(interval);
          reject(new Error('Could not reach server'));
        }
      }, 2000);
    });

  const handleRun = async () => {
    if (!datasetId) return;
    setIsRunning(true);
    setStatusMsg('Submitting task');

    try {
      let taskId;
      if (algorithm === 'graphsage') {
        const { data } = await api.post(`/train-model/${datasetId}`);
        taskId = data.task_id;
        setStatusMsg('Training GraphSAGE — running 5-fold CV');
      } else {
        const { data } = await api.post(`/run-algorithm/${datasetId}?algo_name=${algorithm}`);
        taskId = data.task_id;
        setStatusMsg(`Running ${algorithm}`);
      }

      const result = await pollStatus(taskId);
      setStatusMsg('Done — refreshing graph');
      onRunComplete(result);
      setStatusMsg('');
    } catch (err) {
      setStatusMsg(`Error: ${err.message}`);
    }

    setIsRunning(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div className="algo-controls">
        <select
          className="algo-select"
          value={algorithm}
          onChange={(e) => setAlgorithm(e.target.value)}
          disabled={isRunning}
        >
          <option value="louvain">Louvain</option>
          <option value="leiden">Leiden</option>
          <option value="label_propagation">Label Propagation</option>
          <option value="walktrap">Walktrap</option>
          <option value="slpa">SLPA (Overlapping)</option>
          <option value="graphsage">GraphSAGE (ML)</option>
        </select>

        <button
          className={`btn-execute ${isRunning ? 'running' : 'idle'}`}
          onClick={handleRun}
          disabled={isRunning}
        >
          {isRunning ? '…' : '▶ Run'}
        </button>
      </div>

      {statusMsg && (
        <div className="status-msg">
          <span className="status-prompt">›</span>
          {statusMsg}
          {isRunning && <span className="status-cursor" />}
        </div>
      )}
    </div>
  );
};

export default AlgorithmRunner;
