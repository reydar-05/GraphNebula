import React, { useState, useEffect } from 'react';
import api from '../api/client';
import Plot from 'react-plotly.js';

const CHART_CONFIG = { displayModeBar: false, responsive: true };

const BAR_COLORS = [
  'rgba(99,102,241,0.85)', 'rgba(139,92,246,0.85)', 'rgba(6,182,212,0.85)',
  'rgba(16,185,129,0.85)', 'rgba(245,158,11,0.85)', 'rgba(249,115,22,0.85)',
];

// Factory — returns a NEW object every call so Plotly can't mutate a shared reference
const makeLayout = () => ({
  autosize: true,
  margin: { l: 38, r: 10, t: 8, b: 52 },
  paper_bgcolor: 'transparent',
  plot_bgcolor: 'transparent',
  font: { family: 'Inter, sans-serif', color: '#94a3b8', size: 11 },
  xaxis: {
    tickfont: { size: 10, color: '#64748b' },
    gridcolor: 'rgba(255,255,255,0.04)',
    linecolor: 'rgba(255,255,255,0.06)',
    tickangle: -15,
  },
  yaxis: {
    tickfont: { size: 10, color: '#64748b' },
    gridcolor: 'rgba(255,255,255,0.05)',
    linecolor: 'rgba(255,255,255,0.06)',
    zeroline: false,
  },
  bargap: 0.38,
});

const MetricsDashboard = ({ datasetId, refreshKey }) => {
  const [metrics, setMetrics] = useState([]);

  useEffect(() => {
    if (!datasetId) return;
    api.get(`/metrics/${datasetId}`)
      .then(res => setMetrics(res.data.metrics))
      .catch(() => setMetrics([]));
  }, [datasetId, refreshKey]);

  if (metrics.length === 0) {
    return (
      <p className="metrics-empty">
        No runs yet for dataset {datasetId}.<br />
        Execute an algorithm to see metrics here.
      </p>
    );
  }

  // Keep only the latest run per algorithm (backend returns oldest-first)
  const latest = Object.values(
    metrics.reduce((acc, m) => { acc[m.algorithm] = m; return acc; }, {})
  );

  const algorithms = latest.map(m => m.algorithm);
  const modularity = latest.map(m => +(m.modularity ?? 0).toFixed(4));
  const times      = latest.map(m => m.execution_time_ms);

  return (
    <div className="metrics-wrap">

      <div>
        <p className="chart-label">Modularity Score &uarr; higher is better</p>
        <Plot
          data={[{
            x: algorithms,
            y: modularity,
            type: 'bar',
            marker: {
              color: algorithms.map((_, i) => BAR_COLORS[i % BAR_COLORS.length]),
              line: { width: 0 },
            },
            hovertemplate: '<b>%{x}</b><br>Modularity: %{y:.4f}<extra></extra>',
          }]}
          layout={makeLayout()}
          config={CHART_CONFIG}
          style={{ width: '100%' }}
          useResizeHandler
        />
      </div>

      <div>
        <p className="chart-label">Execution Time (ms) &darr; lower is better</p>
        <Plot
          data={[{
            x: algorithms,
            y: times,
            type: 'bar',
            marker: {
              color: algorithms.map((_, i) => BAR_COLORS[(i + 2) % BAR_COLORS.length]),
              line: { width: 0 },
            },
            hovertemplate: '<b>%{x}</b><br>Time: %{y} ms<extra></extra>',
          }]}
          layout={makeLayout()}
          config={CHART_CONFIG}
          style={{ width: '100%' }}
          useResizeHandler
        />
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
        {metrics.length} run{metrics.length !== 1 ? 's' : ''} recorded · {latest.length} algorithm{latest.length !== 1 ? 's' : ''} shown
      </div>

    </div>
  );
};

export default MetricsDashboard;
