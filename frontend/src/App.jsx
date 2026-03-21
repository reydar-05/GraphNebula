import { useState, useEffect, useRef } from 'react';
import Cytoscape from 'cytoscape';
import api from './api/client';
import DatasetManager from './components/DatasetManager';
import MetricsDashboard from './components/MetricsDashboard';
import AlgorithmRunner from './components/AlgorithmRunner';
import './App.css';

const COMMUNITY_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
];

const CY_STYLE = [
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
  {
    selector: 'node.selected-node',
    style: {
      'border-width': 2.5,
      'border-color': '#ffffff',
      'border-opacity': 0.9,
      'width': 14,
      'height': 14,
    },
  },
];

const COSE_LAYOUT = { name: 'cose', animate: false, randomize: false, nodeRepulsion: 4096, idealEdgeLength: 32, gravity: 80 };

const GraphCanvas = ({ elements, setSelectedNode, cyRef }) => {
  const containerRef = useRef(null);

  // Create cy instance exactly once — never re-runs on re-render
  useEffect(() => {
    if (!containerRef.current) return;
    const cy = Cytoscape({
      container: containerRef.current,
      elements: [],
      stylesheet: CY_STYLE,
      wheelSensitivity: 0.2,
      minZoom: 0.05,
      maxZoom: 3,
    });
    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      cy.$('.selected-node').removeClass('selected-node');
      node.addClass('selected-node');
      setSelectedNode({
        id: node.id(),
        community: node.data('community'),
        degree: node.degree(false),
        neighbors: node.neighborhood('node').map(n => n.id()),
      });
    });
    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        cy.$('.selected-node').removeClass('selected-node');
        setSelectedNode(null);
      }
    });
    cyRef.current = cy;
    return () => { cy.destroy(); cyRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update graph data when elements change — runs layout only when structure changes
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !elements.length) return;
    const prevCount = cy.nodes().length;
    cy.json({ elements });
    if (prevCount === 0 || prevCount !== cy.nodes().length) {
      cy.layout(COSE_LAYOUT).run();
    }
  }, [elements]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} style={{ width: '100%', height: 'calc(100% - 45px)', background: 'transparent' }} />;
};

const App = () => {
  const [datasetId, setDatasetId]       = useState(null);
  const [datasetInfo, setDatasetInfo]   = useState(null);
  const [elements, setElements]         = useState([]);
  const [loadingGraph, setLoadingGraph] = useState(false);
  const [graphStats, setGraphStats]     = useState(null);
  const [metricsKey, setMetricsKey]     = useState(0);
  const [algoResult, setAlgoResult]     = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const cyRef = useRef(null);

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
    // Small delay lets Neo4j finish committing community_id writes before we fetch
    setTimeout(() => fetchGraphData(datasetId), 800);
  };

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

            {hasData && <GraphCanvas elements={elements} setSelectedNode={setSelectedNode} cyRef={cyRef} />}

            {selectedNode && (
              <NodeDetailPanel
                node={selectedNode}
                onClose={() => {
                  setSelectedNode(null);
                  if (cyRef.current) cyRef.current.$('.selected-node').removeClass('selected-node');
                }}
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
const NodeDetailPanel = ({ node, onClose }) => {
  const communityColor =
    node.community !== null && node.community !== undefined && node.community !== ''
      ? COMMUNITY_COLORS[parseInt(node.community, 10) % COMMUNITY_COLORS.length]
      : null;
  const displayNeighbors = node.neighbors.slice(0, 8);
  const extra = node.neighbors.length - displayNeighbors.length;

  return (
    <div className="node-panel fade-in">
      <div className="node-panel-header">
        <span className="node-panel-title">Node Details</span>
        <button className="node-panel-close" onClick={onClose}>×</button>
      </div>
      <div className="node-panel-body">
        <div className="info-row">
          <span className="info-key">ID</span>
          <span className="info-val">{node.id}</span>
        </div>
        <div className="info-row">
          <span className="info-key">Community</span>
          {communityColor ? (
            <span className="info-val" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: communityColor, boxShadow: `0 0 6px ${communityColor}`, display: 'inline-block', flexShrink: 0 }} />
              {node.community}
            </span>
          ) : (
            <span className="info-val muted">unassigned</span>
          )}
        </div>
        <div className="info-row">
          <span className="info-key">Degree</span>
          <span className="info-val">{node.degree}</span>
        </div>
        <div className="node-panel-section">
          <span className="info-key">Neighbors ({node.neighbors.length})</span>
          <div className="node-panel-neighbors">
            {displayNeighbors.map(id => (
              <span key={id} className="neighbor-chip">{id}</span>
            ))}
            {extra > 0 && <span className="neighbor-chip muted">+{extra} more</span>}
            {node.neighbors.length === 0 && <span className="info-val muted">none</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

const StepBadge = ({ n, done, label }) => (
  <div className="step-badge">
    <span className={`step-number ${done ? 'done' : 'pending'}`}>
      {done ? '✓' : n}
    </span>
    <span className="step-label">{label}</span>
  </div>
);

export default App;
