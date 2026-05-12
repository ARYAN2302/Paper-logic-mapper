import { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import cola from 'cytoscape-cola';
import type { PaperSession } from '../types';
import './ComparisonView.css';

cytoscape.use(cola);

interface ComparisonViewProps {
  paper1: PaperSession;
  paper2: PaperSession;
  onNodeSelect: (nodeId: string, page: number) => void;
  selectedNodeId?: string | null;
  nodeTypeColors: Record<string, string>;
}

export default function ComparisonView({
  paper1,
  paper2,
  onNodeSelect,
  nodeTypeColors,
}: ComparisonViewProps) {
  const cy1Ref = useRef<cytoscape.Core | null>(null);
  const cy2Ref = useRef<cytoscape.Core | null>(null);
  const container1Ref = useRef<HTMLDivElement>(null);
  const container2Ref = useRef<HTMLDivElement>(null);

  const buildElements = (paperSession: PaperSession, paperId: string) => {
    const elements: cytoscape.ElementDefinition[] = [];
    const graph = paperSession.graph;

    graph.nodes.forEach((node) => {
      elements.push({
        data: {
          id: `${paperId}_${node.id}`,
          label: node.id,
          type: node.type,
          page: node.page,
          text: node.text,
          paperId,
        },
      });
    });

    graph.edges.forEach((edge) => {
      elements.push({
        data: {
          id: `${paperId}_${edge.source}-${edge.target}`,
          source: `${paperId}_${edge.source}`,
          target: `${paperId}_${edge.target}`,
          label: edge.relation,
        },
      });
    });

    return elements;
  };

  const initializeCytoscape = (
    container: HTMLDivElement,
    elements: cytoscape.ElementDefinition[],
    cyRef: React.MutableRefObject<cytoscape.Core | null>,
    paperId: string
  ) => {
    if (!container) return;

    const cy = cytoscape({
      container,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'content': 'data(label)',
            'width': 35,
            'height': 35,
            'background-color': (ele: any) => nodeTypeColors[ele.data('type')] || '#999',
            'text-valign': 'center',
            'text-halign': 'center',
            'color': '#fff',
            'font-size': 9,
            'border-width': 2,
            'border-color': '#fff',
            'opacity': 0.8,
          },
        },
        {
          selector: 'edge',
          style: {
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'line-color': '#ccc',
            'target-arrow-color': '#ccc',
            'width': 1,
          },
        },
      ],
      layout: {
        name: 'cola' as any,
      } as any,
    });

    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      const originalId = node.data('id').replace(`${paperId}_`, '');
      const page = node.data('page');
      onNodeSelect(originalId, page);
    });

    cyRef.current = cy;
  };

  useEffect(() => {
    const elements1 = buildElements(paper1, 'p1');
    const elements2 = buildElements(paper2, 'p2');

    if (container1Ref.current) {
      initializeCytoscape(container1Ref.current, elements1, cy1Ref, 'p1');
    }

    if (container2Ref.current) {
      initializeCytoscape(container2Ref.current, elements2, cy2Ref, 'p2');
    }

    return () => {
      cy1Ref.current?.destroy();
      cy2Ref.current?.destroy();
    };
  }, [paper1, paper2, onNodeSelect, nodeTypeColors]);

  return (
    <div className="comparison-view">
      <div className="comparison-header">
        <h3>Comparison Mode</h3>
        <p>{paper1.filename} vs {paper2.filename}</p>
      </div>
      <div className="comparison-graphs">
        <div className="comparison-graph">
          <h4>{paper1.filename}</h4>
          <div ref={container1Ref} className="graph-container" />
        </div>
        <div className="comparison-graph">
          <h4>{paper2.filename}</h4>
          <div ref={container2Ref} className="graph-container" />
        </div>
      </div>
    </div>
  );
}
