import React, { useState, useEffect } from 'react';
import api from './api/client';
import CytoscapeComponent from 'react-cytoscapejs';
import DatasetManager from './components/DatasetManager';
import MetricsDashboard from './components/MetricsDashboard';
import AlgorithmRunner from './components/AlgorithmRunner';
import './App.css';

const COMMUNITY_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const App = () => {
  const [datasetId, setDatasetId]       = useState(null);
  const [datasetInfo, setDatasetInfo]   = useState(null);   // { name, num_nodes, num_edges }
  const [elements, setElements]         = useState([]);
  const [loadingGraph, setLoadingGraph] = useState(false);
  const [graphStats, setGraphStats]     = useState(null);   // { nodes, edges, communities }
  const [metricsKey, setMetricsKey]     = useState(0);      // increment to force metrics re-fetch
  const [algoResult, setAlgoResult]     = useState(null);   // last algorithm result

  const fetchGraphData = async (id) => {
    const targetId = id ?? datasetId;
    if (!targetId) return;
    setLoadingGraph(true);
    try {
      const res = await api.get(`/visualization/${targetId}?limit=1200`);
      const elems = res.data.elements;
      setElements(elems);

      // Compute graph stats from returned elements
      const nodes = elems.filter(e => e.data && !e.data.source);
      const edges = elems.filter(e => e.data && e.data.source);
      const communities = new Set(nodes.map(n => n.data.community).filter(c => c !== null && c !== undefined && c !== ''));
      setGraphStats({ nodes: nodes.length, edges: edges.length, communities: communities.size });
    } catch {
      setElements([]);
      setGraphStats(null);
    }
    setLoadingGraph(false);
  };

  useEffect(() => {
    if (datasetId) fetchGraphData(datasetId);
  }, [datasetId]);

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
        'width': 10,
        'height': 10,
        'background-color': (node) => {
          const raw = node.data('community');
          // null/undefined means the node has no community assigned yet
          if (raw === null || raw === undefined || raw === '') return '#d1d5db';
          return COMMUNITY_COLORS[parseInt(raw, 10) % COMMUNITY_COLORS.length];
        },
        'border-width': 1,
        'border-color': '#ffffff',
        'label': '',   // hide labels on large graphs — too cluttered
      },
    },
    {
      selector: 'edge',
      style: { 'width': 0.5, 'line-color': '#e5e7eb', 'curve-style': 'haystack' },
    },
  ];

  const hasData = elements.length > 0;
  const hasCommunities = graphStats && graphStats.communities > 0;

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '24px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

        {/* Header */}
        <header style={{ marginBottom: '24px' }}>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#0f172a' }}>
            GraphNebula — Community Detection Platform
          </h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '14px' }}>
            Upload an edge-list dataset, run a detection algorithm, and explore community structure.
          </p>
        </header>

        {/* Workflow strip */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>

          {/* Step 1 — Upload */}
          <div style={cardStyle(datasetId ? 'done' : 'active')}>
            <StepBadge n={1} done={!!datasetId} />
            <DatasetManager onUploadSuccess={handleUploadSuccess} />
          </div>

          {/* Step 2 — Run Algorithm */}
          <div style={cardStyle(datasetId && !hasCommunities ? 'active' : datasetId ? 'done' : 'idle')}>
            <StepBadge n={2} done={hasCommunities} />
            {!datasetId ? (
              <div style={idleHint}>Upload a dataset first to enable algorithm selection.</div>
            ) : (
              <AlgorithmRunner datasetId={datasetId} onRunComplete={handleAlgoComplete} />
            )}
            {algoResult && (
              <div style={successBanner}>
                ✓ {algoResult.algorithm} found <strong>{algoResult.communities_found}</strong> communities
                &nbsp;·&nbsp; modularity <strong>{algoResult.modularity?.toFixed(3)}</strong>
              </div>
            )}
          </div>

          {/* Step 3 — Status */}
          <div style={cardStyle('info')}>
            <StepBadge n={3} done={hasCommunities} />
            <h3 style={stepTitle}>Active Dataset</h3>
            {!datasetId ? (
              <div style={idleHint}>No dataset loaded yet.</div>
            ) : (
              <div style={{ fontSize: '13px', lineHeight: '1.8', color: '#334155' }}>
                <div><span style={label}>Name:</span> {datasetInfo?.name ?? `Dataset #${datasetId}`}</div>
                <div><span style={label}>ID:</span> {datasetId}</div>
                <div><span style={label}>Total nodes:</span> {datasetInfo?.num_nodes?.toLocaleString() ?? '—'}</div>
                <div><span style={label}>Total edges:</span> {datasetInfo?.num_edges?.toLocaleString() ?? '—'}</div>
                {graphStats && <>
                  <div><span style={label}>Showing:</span> {graphStats.nodes} nodes · {graphStats.edges} edges <span style={{ color: '#94a3b8' }}>(1 200-edge sample)</span></div>
                  <div><span style={label}>Communities:</span> {hasCommunities ? <strong style={{ color: '#10b981' }}>{graphStats.communities} detected</strong> : <span style={{ color: '#94a3b8' }}>none yet — run an algorithm</span>}</div>
                </>}
              </div>
            )}
          </div>
        </div>

        {/* Main dashboard */}
        <div style={{ display: 'flex', gap: '20px', height: '640px' }}>

          {/* Graph panel */}
          <div style={{ flex: '0 0 65%', background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,.1)', overflow: 'hidden', position: 'relative' }}>

            {/* Graph toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
              <span style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a' }}>Network Graph</span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {hasCommunities && (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {COMMUNITY_COLORS.slice(0, Math.min(graphStats.communities, 8)).map((color, i) => (
                      <span key={i} title={`Community ${i + 1}`} style={{ width: 12, height: 12, borderRadius: '50%', background: color, display: 'inline-block' }} />
                    ))}
                    <span style={{ fontSize: '12px', color: '#64748b', marginLeft: 2 }}>communities</span>
                  </div>
                )}
                {!hasCommunities && hasData && (
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>All nodes gray — run an algorithm to assign communities</span>
                )}
                <button
                  onClick={() => fetchGraphData()}
                  disabled={loadingGraph || !datasetId}
                  style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', color: '#475569' }}
                >
                  {loadingGraph ? 'Loading…' : '↻ Refresh'}
                </button>
              </div>
            </div>

            {/* Empty state */}
            {!hasData && !loadingGraph && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 'calc(100% - 41px)', color: '#94a3b8', gap: '8px' }}>
                <div style={{ fontSize: '40px' }}>⬡</div>
                <div style={{ fontSize: '14px' }}>Upload a dataset to visualise its graph</div>
              </div>
            )}

            {loadingGraph && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,.7)', zIndex: 10, fontSize: '14px', color: '#64748b' }}>
                Loading network topology…
              </div>
            )}

            {hasData && (
              <CytoscapeComponent
                elements={elements}
                stylesheet={cyStyle}
                style={{ width: '100%', height: 'calc(100% - 41px)' }}
                layout={{ name: 'cose', animate: false, randomize: false, nodeRepulsion: 4096, idealEdgeLength: 32, gravity: 80 }}
                wheelSensitivity={0.2}
                minZoom={0.05}
                maxZoom={3}
              />
            )}
          </div>

          {/* Metrics panel */}
          <div style={{ flex: 1, background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,.1)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
              <span style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a' }}>Algorithm Performance</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              {!datasetId ? (
                <div style={idleHint}>Metrics will appear here after you run an algorithm.</div>
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

// ── Small helpers ──────────────────────────────────────────────────────────────

const StepBadge = ({ n, done }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
    <span style={{
      width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '12px', fontWeight: 700,
      background: done ? '#10b981' : '#3b82f6', color: 'white',
    }}>{done ? '✓' : n}</span>
    <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>Step {n}</span>
  </div>
);

const cardStyle = (state) => ({
  background: 'white',
  borderRadius: '12px',
  padding: '16px 20px',
  boxShadow: '0 1px 3px rgba(0,0,0,.08)',
  border: `1.5px solid ${state === 'active' ? '#3b82f6' : state === 'done' ? '#10b981' : '#f1f5f9'}`,
});

const stepTitle  = { margin: '0 0 10px', fontSize: '14px', fontWeight: 600, color: '#0f172a' };
const idleHint   = { fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' };
const label      = { color: '#94a3b8', marginRight: '6px', fontSize: '12px' };
const successBanner = {
  marginTop: '10px', padding: '8px 12px', borderRadius: '8px',
  background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontSize: '13px',
};

export default App;
