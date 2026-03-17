import React, { useState, useEffect } from 'react';
import api from '../api/client';
import Plot from 'react-plotly.js';

const MetricsDashboard = ({ datasetId }) => {
  const [metrics, setMetrics] = useState([]);

  useEffect(() => {
    if (!datasetId) return;
    api.get(`/metrics/${datasetId}`)
      .then(res => setMetrics(res.data.metrics))
      .catch(err => console.error("No metrics yet or error fetching:", err));
  }, [datasetId]);

  if (metrics.length === 0) {
    return (
      <div style={{ color: '#6b7280', fontStyle: 'italic', marginTop: '20px' }}>
        No algorithm metrics found for Dataset {datasetId}. Run an algorithm via the API to see data here.
      </div>
    );
  }

  const algorithms = metrics.map(m => m.algorithm);
  const modularity = metrics.map(m => m.modularity);
  const times = metrics.map(m => m.execution_time_ms);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', marginTop: '10px' }}>
      <Plot
        data={[{ 
          x: algorithms, 
          y: modularity, 
          type: 'bar', 
          marker: { color: '#3b82f6' } 
        }]}
        layout={{ 
          title: 'Modularity Score (Higher is better)', 
          width: 350, 
          height: 250, 
          margin: { l: 40, r: 20, t: 40, b: 40 },
          paper_bgcolor: 'rgba(0,0,0,0)',
          plot_bgcolor: 'rgba(0,0,0,0)'
        }}
        config={{ displayModeBar: false }}
      />
      
      <Plot
        data={[{ 
          x: algorithms, 
          y: times, 
          type: 'bar', 
          marker: { color: '#f59e0b' } 
        }]}
        layout={{ 
          title: 'Execution Time (ms) (Lower is better)', 
          width: 350, 
          height: 250, 
          margin: { l: 40, r: 20, t: 40, b: 40 },
          paper_bgcolor: 'rgba(0,0,0,0)',
          plot_bgcolor: 'rgba(0,0,0,0)'
        }}
        config={{ displayModeBar: false }}
      />
    </div>
  );
};

export default MetricsDashboard;