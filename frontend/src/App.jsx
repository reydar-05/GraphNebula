import React, { useState, useEffect } from 'react';
import api from './api/client';
import CytoscapeComponent from 'react-cytoscapejs';
import DatasetManager from './components/DatasetManager';
import MetricsDashboard from './components/MetricsDashboard';
import AlgorithmRunner from './components/AlgorithmRunner';
import './App.css';

const COMMUNITY_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
];

const App = () => {
  const [datasetId, setDatasetId]       = useState(null);
  const [datasetInfo, setDatasetInfo]   = useState(null);
  const [elements, setElements]         = useState([]);
  const [loadingGraph, setLoadingGraph] = useState(false);
  const [graphStats, setGraphStats]     = useState(null);
  const [metricsKey, setMetricsKey]     = useState(0);
  const [algoResult, setAlgoResult]     = useState(null);

  const fetchGraphData = async (id) => {
    const targetId = id ?? datasetId;
    if (!targetId) return;
    setLoadingGraph(true);
    try {
      const res = await api.get(`/visualization/${targetId}?limit=1200`);
      const elems = res.data.elements;
      setElements(elems);
      const nodes = elems.filter(e => e.data && !e.data.source);
      const edges = elems.filter(e => e.data && e.data.source);
      const communities = new Set(
        nodes.map(n => n.data.community).filter(c => c !== null && c !== undefined && c !== '')
      );
      setGraphStats({ nodes: nodes.length, edges: edges.length, communities: communities.size });
    } catch {
      setElements([]);
      setGraphStats(null);
    }
    setLoadingGraph(false);
  };

  useEffect(() => { if (datasetId) fetchGraphData(datasetId); }, [datasetId]);

  const handleUploadSuccess = (id, info) => {
    setDatasetId(id);
    setDatasetInfo(info);
    setAlgoResult(null);
    setMetricsKey(k => k + 1);
  };

  const handleAlgoComplete = (result) => {
    setAlgoResult(result);
    setMetricsKey(k => k + 1);
    fetchGraphData();
  };

  const cyStyle = [
    {
      selector: 'node',
      style: {
        'width': 9,
        'height': 9,
        'background-color': (node) => {
          const raw = node.data('community');
          if (raw === null || raw === undefined || raw === '') return '#1e293b';
          return COMMUNITY_COLORS[parseInt(raw, 10) % COMMUNITY_COLORS.length];
        },
        'border-width': 0,
        'shadow-blur': 10,
        'shadow-color': (node) => {
          const raw = node.data('community');
          if (raw === null || raw === undefined || raw === '') return '#1e293b';
          return COMMUNITY_COLORS[parseInt(raw, 10) % COMMUNITY_COLORS.length];
        },
        'shadow-opacity': 0.9,
        'shadow-offset-x': 0,
        'shadow-offset-y': 0,
      },
    },
    {
      selector: 'edge',
      style: {
        'width': 0.4,
        'line-color': 'rgba(99,102,241,0.12)',
        'curve-style': 'haystack',
      },
    },
  ];

  const hasData = elements.length > 0;
  const hasCommunities = graphStats && graphStats.communities > 0;

  const cardState = (base) => {
    if (base === 'step1') return datasetId ? 'done' : 'active';
    if (base === 'step2') return datasetId && !hasCommunities ? 'active' : datasetId ? 'done' : '';
    return 'info';
  };

  return (
    <div className="app-bg">
      <div className="app-container">

        {/* ── Header ── */}
        <header className="app-header">
          <div className="app-logo-row">
            <div className="app-logo-icon">⬡</div>
            <h1 className="app-title">GraphNebula</h1>
          </div>
          <p className="app-subtitle">
            Community Detection Platform — upload a graph, run algorithms, explore structure.
          </p>
        </header>

        {/* ── Workflow strip ── */}
        <div className="workflow-grid">

          {/* Step 1 */}
          <div className={`glass-card step-card state-${cardState('step1')}`}>
            <StepBadge n={1} done={!!datasetId} label="Upload" />
            <DatasetManager onUploadSuccess={handleUploadSuccess} />
          </div>

          {/* Step 2 */}
          <div className={`glass-card step-card state-${cardState('step2')}`}>
            <StepBadge n={2} done={hasCommunities} label="Detect" />
            {!datasetId ? (
              <p className="idle-hint">Upload a dataset first to unlock algorithm selection.</p>
            ) : (
              <AlgorithmRunner datasetId={datasetId} onRunComplete={handleAlgoComplete} />
            )}
            {algoResult && (
              <div className="success-banner">
                ✓&nbsp;<strong>{algoResult.algorithm}</strong> found&nbsp;
                <strong>{algoResult.communities_found}</strong> communities
                &nbsp;·&nbsp;modularity&nbsp;<strong>{algoResult.modularity?.toFixed(3)}</strong>
              </div>
            )}
          </div>

          {/* Step 3 — Status */}
          <div className="glass-card step-card state-info">
            <StepBadge n={3} done={hasCommunities} label="Inspect" />
            <p className="step-title" style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 12 }}>
              ACTIVE DATASET
            </p>
            {!datasetId ? (
              <p className="idle-hint">No dataset loaded yet.</p>
            ) : (
              <div className="dataset-info-grid fade-in">
                <div className="info-row">
                  <span className="info-key">Name</span>
                  <span className="info-val">{datasetInfo?.name ?? `Dataset #${datasetId}`}</span>
                </div>
                <div className="info-row">
                  <span className="info-key">Dataset ID</span>
                  <span className="info-val">{datasetId}</span>
                </div>
                <div className="info-row">
                  <span className="info-key">Total nodes</span>
                  <span className="info-val">{datasetInfo?.num_nodes?.toLocaleString() ?? '—'}</span>
                </div>
                <div className="info-row">
                  <span className="info-key">Total edges</span>
                  <span className="info-val">{datasetInfo?.num_edges?.toLocaleString() ?? '—'}</span>
                </div>
                {graphStats && <>
                  <div className="info-row">
                    <span className="info-key">Showing</span>
                    <span className="info-val">
                      {graphStats.nodes} nodes · {graphStats.edges} edges
                      <span className="info-val muted" style={{ marginLeft: 4 }}>(1 200-edge sample)</span>
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-key">Communities</span>
                    {hasCommunities
                      ? <span className="info-val highlight">{graphStats.communities} detected</span>
                      : <span className="info-val muted">none yet</span>
                    }
                  </div>
                </>}
              </div>
            )}
          </div>

        </div>

        {/* ── Main dashboard ── */}
        <div className="dashboard-row">

          {/* Graph panel */}
          <div className="glass-card graph-panel">
            <div className="panel-header">
              <span className="panel-title">
                <span className="panel-dot" />
                Network Graph
              </span>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {hasCommunities && (
                  <div className="community-legend">
                    {COMMUNITY_COLORS.slice(0, Math.min(graphStats.communities, 8)).map((color, i) => (
                      <span
                        key={i}
                        className="community-dot"
                        title={`Community ${i + 1}`}
                        style={{ background: color, boxShadow: `0 0 6px ${color}` }}
                      />
                    ))}
                    <span className="legend-label">communities</span>
                  </div>
                )}
                {!hasCommunities && hasData && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Run an algorithm to colour communities
                  </span>
                )}
                <button
                  className="btn-ghost"
                  onClick={() => fetchGraphData()}
                  disabled={loadingGraph || !datasetId}
                >
                  {loadingGraph ? '…' : '↻ Refresh'}
                </button>
              </div>
            </div>

            {!hasData && !loadingGraph && (
              <div className="empty-state">
                <div className="empty-icon">⬡</div>
                <p className="empty-text">Upload a dataset to visualise its graph</p>
              </div>
            )}

            {loadingGraph && (
              <div className="loading-overlay">
                <div className="spinner" />
                <span className="loading-text">Loading network topology…</span>
              </div>
            )}

            {hasData && (
              <CytoscapeComponent
                elements={elements}
                stylesheet={cyStyle}
                style={{
                  width: '100%',
                  height: 'calc(100% - 45px)',
                  background: 'transparent',
                }}
                layout={{ name: 'cose', animate: false, randomize: false, nodeRepulsion: 4096, idealEdgeLength: 32, gravity: 80 }}
                wheelSensitivity={0.2}
                minZoom={0.05}
                maxZoom={3}
              />
            )}
          </div>

          {/* Metrics panel */}
          <div className="glass-card metrics-panel">
            <div className="panel-header">
              <span className="panel-title">
                <span className="panel-dot green" />
                Algorithm Performance
              </span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              {!datasetId ? (
                <p className="idle-hint" style={{ paddingTop: 16 }}>
                  Metrics will appear here after you run an algorithm.
                </p>
              ) : (
                <MetricsDashboard datasetId={datasetId} refreshKey={metricsKey} />
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

/* ── Helpers ────────────────────────────────────────────────────────────────── */
const StepBadge = ({ n, done, label }) => (
  <div className="step-badge">
    <span className={`step-number ${done ? 'done' : 'pending'}`}>
      {done ? '✓' : n}
    </span>
    <span className="step-label">{label}</span>
  </div>
);

export default App;
