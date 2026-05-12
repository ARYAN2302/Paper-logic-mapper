import { useEffect, useMemo, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
// cola is still available as a fallback but prefer dagre layout for hierarchical flow
import cola from 'cytoscape-cola';
import navigator from 'cytoscape-navigator';
import type { GraphData } from '../types';
import './GraphView.css';

cytoscape.use(cola);
// register dagre layout plugin
try {
  dagre(cytoscape);
} catch (err) {
  // ignore if registration fails at runtime
  console.warn('Failed to register cytoscape-dagre', err);
}

try {
  cytoscape.use(navigator as any);
} catch (err) {
  console.warn('Failed to register cytoscape-navigator', err);
}

interface GraphViewProps {
  graphData: GraphData | null;
  onNodeSelect: (nodeId: string, page: number) => void;
  selectedNodeId: string | null;
  nodeTypeColors: Record<string, string>;
}

export default function GraphView({
  graphData,
  onNodeSelect,
  selectedNodeId,
  nodeTypeColors,
}: GraphViewProps) {
  const cyRef = useRef<cytoscape.Core | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLDivElement>(null);
  const [hoverCard, setHoverCard] = useState<{
    x: number;
    y: number;
    id: string;
    type: string;
    page: number;
    preview: string;
    inCount: number;
    outCount: number;
  } | null>(null);

  const graphStats = useMemo(() => {
    const nodes = graphData?.nodes || [];
    const edges = graphData?.edges || [];
    return {
      nodes: nodes.length,
      edges: edges.length,
      sections: new Set(nodes.map((node) => node.section || 'Unsorted')).size,
      types: nodes.reduce<Record<string, number>>((counts, node) => {
        counts[node.type] = (counts[node.type] || 0) + 1;
        return counts;
      }, {}),
    };
  }, [graphData]);

  useEffect(() => {
    if (!graphData) return;

    // Build elements for Cytoscape
    const elements: cytoscape.ElementDefinition[] = [];

    const validNodeIds = new Set(graphData.nodes.map((node) => node.id));
    const validEdges = graphData.edges.filter(
      (edge) => validNodeIds.has(edge.source) && validNodeIds.has(edge.target)
    );
    const inCounts = new Map<string, number>();
    const outCounts = new Map<string, number>();
    const sectionIds = new Map<string, string>();

    validEdges.forEach((edge) => {
      outCounts.set(edge.source, (outCounts.get(edge.source) || 0) + 1);
      inCounts.set(edge.target, (inCounts.get(edge.target) || 0) + 1);
    });

    const ensureSection = (section: string) => {
      const label = section.trim() || 'Unsorted';
      if (!sectionIds.has(label)) {
        const id = `section:${label}`;
        sectionIds.set(label, id);
        elements.push({
          data: {
            id,
            label,
          },
          classes: 'section',
        });
      }
      return sectionIds.get(label) as string;
    };

    // Add nodes
    graphData.nodes.forEach((node) => {
      const inCount = inCounts.get(node.id) || 0;
      const outCount = outCounts.get(node.id) || 0;
      const size = Math.min(120, 70 + (inCount + outCount) * 6);
      const parent = ensureSection(node.section || '');
      const preview = (node.text || '').replace(/\s+/g, ' ').slice(0, 140);
      const color = nodeTypeColors[node.type] || '#64748b';
      elements.push({
        data: {
          id: node.id,
          label: node.id,
          type: node.type,
          page: node.page,
          text: node.text,
          preview,
          inCount,
          outCount,
          size,
          parent,
          color,
        },
      });
    });

    // Add edges
    validEdges.forEach((edge, index) => {
      elements.push({
        data: {
          id: `${edge.source}-${edge.target}-${index}`,
          source: edge.source,
          target: edge.target,
          label: edge.relation,
          color: nodeTypeColors[
            graphData.nodes.find((node) => node.id === edge.source)?.type || ''
          ] || '#64748b',
        },
      });
    });

    let isActive = true;

    const layoutOptions: cytoscape.LayoutOptions = {
      name: 'dagre' as any,
      rankDir: 'TB',
      nodeSep: 80,
      rankSep: 110,
      edgeSep: 40,
      padding: 30,
      animate: true,
      animationDuration: 500,
      align: 'UL',
    } as any;

    // Initialize Cytoscape
    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'core',
          style: {
            'background-color': '#111827',
          },
        },
        {
          selector: 'node',
          style: {
            'content': 'data(label)',
            'background-color': 'data(color)',
            'text-valign': 'center',
            'text-halign': 'center',
            'color': '#e2e8f0',
            'font-size': 11,
            'font-family': 'IBM Plex Sans, Segoe UI, sans-serif',
            'font-weight': 700,
            'border-width': 2,
            'border-color': '#f8fafc',
            'border-opacity': 0.72,
            'text-outline-width': 2,
            'text-outline-color': '#111827',
            'text-wrap': 'wrap',
            'text-max-width': '86px',
            'text-overflow-wrap': 'anywhere',
            'opacity': 1,
            'overlay-padding': 8,
            'overlay-opacity': 0,
          },
        },
        {
          selector: 'node[size]:childless',
          style: {
            'width': 'data(size)',
            'height': 'data(size)',
          },
        },
        {
          selector: 'node[type = "Theorem"]',
          style: {
            'shape': 'hexagon',
            'border-color': '#fecaca',
          },
        },
        {
          selector: 'node[type = "Lemma"]',
          style: {
            'shape': 'round-rectangle',
            'border-color': '#bbf7d0',
          },
        },
        {
          selector: 'node[type = "Definition"]',
          style: {
            'border-color': '#93c5fd',
          },
        },
        {
          selector: 'node[type = "Assumption"]',
          style: {
            'shape': 'diamond',
            'border-color': '#fde047',
          },
        },
        {
          selector: 'node[type = "Claim"]',
          style: {
            'shape': 'tag',
            'border-color': '#d8b4fe',
          },
        },
        {
          selector: 'node[type = "Proof"]',
          style: {
            'border-color': '#cbd5f5',
            'shape': 'round-rectangle',
            'width': 'data(size)',
            'height': 'data(size)',
            'padding': '8px',
          },
        },
        {
          selector: ':parent',
          style: {
            'background-opacity': 0.08,
            'background-color': '#38bdf8',
            'border-width': 1,
            'border-color': '#38bdf8',
            'border-opacity': 0.35,
            'label': 'data(label)',
            'color': '#cbd5e1',
            'font-size': 11,
            'font-weight': 700,
            'text-valign': 'top',
            'text-margin-y': -6,
          },
        },
        {
          selector: '.selected',
          style: {
            'border-width': 3,
            'border-color': '#f8fafc',
          },
        },
        {
          selector: 'edge',
          style: {
            'target-arrow-shape': 'triangle',
            'curve-style': 'unbundled-bezier',
            'control-point-distance': 24,
            'control-point-weight': 0.5,
            'line-color': 'data(color)',
            'target-arrow-color': 'data(color)',
            'line-opacity': 0.58,
            'width': 2.25,
            'arrow-scale': 1.05,
            'label': 'data(label)',
            'font-size': 10,
            'font-weight': 600,
            'color': '#cbd5e1',
            'text-background-color': '#111827',
            'text-background-opacity': 0.92,
            'text-background-padding': '3px',
            'text-background-shape': 'roundrectangle',
          },
        },
        {
          selector: 'edge.highlighted',
          style: {
            'width': 4,
            'line-opacity': 1,
            'z-index': 9,
          },
        },
        {
          selector: '.hover',
          style: {
            'overlay-opacity': 0.14,
            'overlay-color': '#ffffff',
          },
        },
        // Highlighting helpers
        {
          selector: '.dimmed',
          style: {
            'opacity': 0.12,
          },
        },
        {
          selector: '.highlighted',
          style: {
            'border-width': 4,
            'border-color': '#f8fafc',
            'background-opacity': 1,
            'opacity': 1,
            'z-index': 10,
          },
        },
      ],
      layout: { name: 'preset' } as any,
    });

    const layout = cy.layout(layoutOptions);
    layout.run();
    layout.on('layoutstop', () => {
      try {
        cy.fit(undefined, 40);
      } catch (e) {
        // ignore
      }
    });

    cy.ready(() => {
      if (!isActive || cy.destroyed()) return;
      if (minimapRef.current && minimapRef.current.isConnected && (cy as any).navigator) {
        try {
          (cy as any).navigator({
            container: minimapRef.current,
            viewLiveFramerate: 0,
            thumbnailEventFramerate: 0,
          });
        } catch (err) {
          console.warn('Failed to initialize minimap', err);
        }
      }
    });

    // Event handlers
    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      const nodeId = node.id();
      const page = node.data('page');
      onNodeSelect(nodeId, page);

      try {
        const predecessors = node.predecessors();
        const successors = node.successors();
        const connected = node.union(predecessors).union(successors);
        cy.elements().removeClass('highlighted selected').addClass('dimmed');
        connected.removeClass('dimmed').addClass('highlighted');
        connected.connectedEdges().addClass('highlighted');
        node.addClass('selected');
      } catch (e) {
        // ignore
      }
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        cy.elements().removeClass('dimmed highlighted selected');
      }
    });

    cy.on('mouseover', 'node', (evt) => {
      const node = evt.target;
      node.addClass('hover');

      const rendered = evt.renderedPosition || { x: 0, y: 0 };
      const preview = node.data('preview') || '';
      const label = node.data('label') || node.id();
      setHoverCard({
        x: rendered.x + 14,
        y: rendered.y + 14,
        id: label,
        type: node.data('type'),
        page: node.data('page'),
        preview,
        inCount: node.data('inCount') || 0,
        outCount: node.data('outCount') || 0,
      });
    });

    cy.on('mousemove', 'node', (evt) => {
      const rendered = evt.renderedPosition || { x: 0, y: 0 };
      setHoverCard((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          x: rendered.x + 14,
          y: rendered.y + 14,
        };
      });
    });

    cy.on('mouseout', 'node', (evt) => {
      const node = evt.target;
      node.removeClass('hover');
      setHoverCard(null);
    });

    cyRef.current = cy;

    return () => {
      isActive = false;
      try {
        if ((cy as any).navigator) {
          (cy as any).navigator('destroy');
        }
      } catch (e) {
        // ignore
      }
      cy.destroy();
      cyRef.current = null;
    };
  }, [graphData, onNodeSelect, nodeTypeColors]);

  // Update selected node styling
  useEffect(() => {
    if (!cyRef.current) return;

    const cy = cyRef.current;
    cy.elements().removeClass('dimmed highlighted selected');

    if (!selectedNodeId) return;

    const node = cy.getElementById(selectedNodeId);
    if (!node.length) return;

    const connected = node.union(node.predecessors()).union(node.successors());
    cy.elements().addClass('dimmed');
    connected.removeClass('dimmed').addClass('highlighted');
    connected.connectedEdges().removeClass('dimmed').addClass('highlighted');
    node.addClass('selected');
  }, [selectedNodeId]);

  const handleExport = async (format: 'png' | 'svg') => {
    if (!cyRef.current) return;

    try {
      if (format === 'png') {
        const png = cyRef.current.png({ full: true, scale: 2, bg: '#111827' }) as string;
        const link = document.createElement('a');
        link.href = png;
        link.download = `graph-${Date.now()}.png`;
        link.click();
      } else if (format === 'svg') {
        const cy = cyRef.current;
        const bbox = cy.elements().boundingBox();
        const padding = 80;
        const width = Math.max(800, bbox.w + padding * 2);
        const height = Math.max(600, bbox.h + padding * 2);
        const xOffset = padding - bbox.x1;
        const yOffset = padding - bbox.y1;
        const escapeXml = (value: string) =>
          value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');

        const edges = cy.edges().map((edge) => {
          const source = edge.source().position();
          const target = edge.target().position();
          const color = edge.data('color') || '#94a3b8';
          return `<line x1="${source.x + xOffset}" y1="${source.y + yOffset}" x2="${target.x + xOffset}" y2="${target.y + yOffset}" stroke="${color}" stroke-opacity="0.62" stroke-width="2" marker-end="url(#arrow)" />`;
        }).join('');

        const nodes = cy.nodes(':childless').map((node) => {
          const position = node.position();
          const radius = Math.max(22, (Number(node.data('size')) || 64) / 2);
          const color = node.data('color') || '#64748b';
          const label = escapeXml(node.data('label') || node.id());
          return `<g><circle cx="${position.x + xOffset}" cy="${position.y + yOffset}" r="${radius}" fill="${color}" stroke="#f8fafc" stroke-opacity="0.74" stroke-width="2"/><text x="${position.x + xOffset}" y="${position.y + yOffset + 4}" text-anchor="middle" fill="#f8fafc" font-family="IBM Plex Sans, Arial, sans-serif" font-size="11" font-weight="700">${label}</text></g>`;
        }).join('');

        const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L9,3 z" fill="#94a3b8"/></marker></defs><rect width="100%" height="100%" fill="#111827"/><g>${edges}${nodes}</g></svg>`;
        const link = document.createElement('a');
        const blob = new Blob([svgStr], { type: 'image/svg+xml' });
        link.href = URL.createObjectURL(blob);
        link.download = `graph-${Date.now()}.svg`;
        link.click();
        URL.revokeObjectURL(link.href);
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export graph');
    }
  };

  const handleFit = () => {
    cyRef.current?.fit(undefined, 44);
  };

  const handleRelayout = () => {
    if (!cyRef.current) return;
    cyRef.current.layout({
      name: 'dagre' as any,
      rankDir: 'TB',
      nodeSep: 80,
      rankSep: 110,
      edgeSep: 40,
      padding: 30,
      animate: true,
      animationDuration: 450,
      align: 'UL',
    } as any).run();
  };

  return (
    <div className="graph-view">
      <div className="graph-header">
        <div>
          <h3>Logic Graph</h3>
          <div className="graph-stats">
            <span>{graphStats.nodes} nodes</span>
            <span>{graphStats.edges} links</span>
            <span>{graphStats.sections} sections</span>
          </div>
        </div>
        <div className="graph-actions">
          <button onClick={handleFit} className="graph-tool-btn" title="Fit graph">
            Fit
          </button>
          <button onClick={handleRelayout} className="graph-tool-btn" title="Re-run layout">
            Layout
          </button>
          <button onClick={() => handleExport('png')} className="export-btn">
            PNG
          </button>
          <button onClick={() => handleExport('svg')} className="export-btn">
            SVG
          </button>
        </div>
      </div>
      <div className="graph-legend">
        {Object.entries(nodeTypeColors).map(([type, color]) => (
          <span key={type} className="legend-item">
            <span className="legend-swatch" style={{ background: color }} />
            {type}
            {graphStats.types[type] ? <strong>{graphStats.types[type]}</strong> : null}
          </span>
        ))}
      </div>
      <div ref={containerRef} className="graph-container" />
      <div ref={minimapRef} className="graph-minimap" />
      {hoverCard && (
        <div
          className="hover-card"
          style={{
            left: hoverCard.x,
            top: hoverCard.y,
          }}
        >
          <div className="hover-title">
            <span className={`hover-badge type-${hoverCard.type}`}>{hoverCard.type}</span>
            <strong>{hoverCard.id}</strong>
          </div>
          <p className="hover-preview">{hoverCard.preview || 'No preview'}</p>
          <div className="hover-meta">
            <span>Page {hoverCard.page}</span>
            <span>{hoverCard.inCount} in • {hoverCard.outCount} out</span>
          </div>
        </div>
      )}
    </div>
  );
}
