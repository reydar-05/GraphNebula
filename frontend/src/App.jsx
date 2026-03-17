import React, { useState, useEffect } from 'react';
import api from './api/client';
import CytoscapeComponent from 'react-cytoscapejs';
import DatasetManager from './components/DatasetManager';
import MetricsDashboard from './components/MetricsDashboard';
import AlgorithmRunner from './components/AlgorithmRunner';
import './App.css'; 

const App = () => {
  const [datasetId, setDatasetId] = useState(1);
  const [elements, setElements] = useState([]);
  const [loadingGraph, setLoadingGraph] = useState(false);

 const fetchGraphData = async () => {
    if (!datasetId) return;
    setLoadingGraph(true);
    try {
      // ---> INCREASE THE LIMIT HERE FROM 800 TO 3000 <---
      const res = await api.get(`/visualization/${datasetId}?limit=1200`);
setElements(res.data.elements);
    } catch (error) {
      console.error(error);
      setElements([]);
    }
    setLoadingGraph(false);
  };

  useEffect(() => {
    fetchGraphData();
  }, [datasetId]);

 const cyStyle = [
    {
      selector: 'node',
      style: {
        'label': 'data(label)',
        'font-size': '10px',
        'width': '20px', 'height': '20px',
        'background-color': (node) => {
          const colors = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];
          
          // FORCE IT TO BE A NUMBER:
          const commId = parseInt(node.data('community'), 10); 
          
          if (isNaN(commId) || commId === 0) return '#9ca3af'; // Gray for unassigned
          return colors[commId % colors.length];
        },
        'border-width': 2,
        'border-color': '#ffffff'
      }
    },
    { selector: 'edge', style: { 'width': 1, 'line-color': '#e5e7eb', 'curve-style': 'bezier' } }
  ];

  return (
    <div style={{ padding: '30px', maxWidth: '1400px', margin: '0 auto' }}>
      <header style={{ borderBottom: '2px solid #e5e7eb', paddingBottom: '15px', marginBottom: '25px' }}>
        <h1 style={{ color: '#111827', margin: 0 }}>Graph Community Detection Platform</h1>
        <p style={{ color: '#6b7280', margin: '5px 0 0 0' }}>Distributed Graph Analysis & ML Pipeline</p>
      </header>
      
      {/* Top Controls Grid (3 Columns) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '25px' }}>
        
        {/* Box 1: Upload */}
        <div style={{ background: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
          <DatasetManager onUploadSuccess={(id) => setDatasetId(id)} />
        </div>

        {/* Box 2: Algorithm Runner */}
        <div style={{ background: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
           <AlgorithmRunner datasetId={datasetId} onRunComplete={fetchGraphData} />
        </div>

        {/* Box 3: View Controls */}
        <div style={{ background: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h3 style={{ margin: '0 0 15px 0' }}>3. View Results</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <label style={{ fontWeight: '500' }}>Dataset ID:</label>
            <input 
              type="number" 
              value={datasetId} 
              onChange={(e) => setDatasetId(e.target.value)}
              style={{ width: '60px' }}
            />
            <button onClick={fetchGraphData} style={{ backgroundColor: '#3b82f6' }}>Render Graph</button>
          </div>
        </div>

      </div>

      {/* Main Dashboard Area */}
      <div style={{ display: 'flex', gap: '25px', height: '650px' }}>
        
        {/* Graph Canvas */}
        <div style={{ flex: '0 0 65%', background: 'white', borderRadius: '10px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', overflow: 'hidden', position: 'relative' }}>
          {loadingGraph && <div style={{ position: 'absolute', top: '20px', left: '20px', fontWeight: 'bold' }}>Loading network topology...</div>}
          <CytoscapeComponent 
            elements={elements} 
            stylesheet={cyStyle}
            style={{ width: '100%', height: '100%' }} 
layout={{ name: 'concentric', padding: 30 }}            wheelSensitivity={0.2}
            minZoom={0.1}   /* <--- ADD THIS LINE */
            maxZoom={1.5}   /* <--- ADD THIS LINE */
          />
        </div>

        {/* Metrics Panel */}
        <div style={{ flex: '0 0 calc(35% - 25px)', background: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', overflowY: 'auto' }}>
          <h3 style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '10px', margin: '0 0 20px 0' }}>Algorithm Performance</h3>
          <MetricsDashboard datasetId={datasetId} />
        </div>

      </div>
    </div>
  );
};

export default App;