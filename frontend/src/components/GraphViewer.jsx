import React from 'react';
import CytoscapeComponent from 'react-cytoscapejs';

const GraphViewer = ({ nodes, edges }) => {
  const elements = [
    ...nodes.map(n => ({ data: { id: n.id, label: n.label, community: n.community } })),
    ...edges.map(e => ({ data: { source: e.source, target: e.target } }))
  ];

  const stylesheet = [
    {
      selector: 'node',
      style: {
        'background-color': 'data(community)', // Color based on community ID
        'label': 'data(label)'
      }
    },
    {
      selector: 'edge',
      style: {
        'width': 1,
        'line-color': '#ccc'
      }
    }
  ];

  return (
    <CytoscapeComponent 
      elements={elements} 
      stylesheet={stylesheet}
      style={{ width: '100%', height: '600px' }} 
      layout={{ name: 'cose' }} // Force-directed layout
    />
  );
};

export default GraphViewer;