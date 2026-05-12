import { useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import type { Node, GraphData } from '../types';
import './SourcePane.css';

interface SourcePaneProps {
  node: Node | null;
  graphData: GraphData | null;
  currentPage: number;
  pdfBlob: string;
  onPageChange: (page: number) => void;
  onNodeEdit: (nodeId: string, node: Node) => void;
  isEdited: boolean;
}

export default function SourcePane({
  node,
  graphData,
  currentPage,
  pdfBlob,
  onPageChange,
  onNodeEdit,
  isEdited,
}: SourcePaneProps) {
  const [editMode, setEditMode] = useState(false);
  const [editedText, setEditedText] = useState(node?.text || '');
  const [numPages, setNumPages] = useState<number>(0);
  const [pdfError, setPdfError] = useState(false);
  const [pdfWidth, setPdfWidth] = useState(320);
  const pdfWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  }, []);

  useEffect(() => {
    setEditedText(node?.text || '');
    setEditMode(false);
    setPdfError(false);
  }, [node]);

  useEffect(() => {
    const wrapper = pdfWrapperRef.current;
    if (!wrapper) return;

    const updateWidth = () => {
      setPdfWidth(Math.max(260, wrapper.clientWidth - 24));
    };

    updateWidth();
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(wrapper);
    return () => resizeObserver.disconnect();
  }, []);

  const formatNodeText = (text: string): string => {
    return text
      .replace(/-\s*\n/g, '')
      .replace(/\s*\n\s*/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  };

  const handleSaveEdit = () => {
    if (!node) return;
    const updatedNode: Node = {
      ...node,
      text: editedText,
    };
    onNodeEdit(node.id, updatedNode);
    setEditMode(false);
  };

  const getNodeTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      Definition: '#3b82f6',
      Assumption: '#eab308',
      Lemma: '#22c55e',
      Theorem: '#ef4444',
      Claim: '#a855f7',
      Proof: '#6b7280',
    };
    return colors[type] || '#999';
  };

  const incomingEdges = graphData?.edges.filter(e => e.target === node?.id) || [];
  const outgoingEdges = graphData?.edges.filter(e => e.source === node?.id) || [];

  return (
    <div className="source-pane">
      {node ? (
        <>
          <div className="node-header" style={{ borderLeftColor: getNodeTypeColor(node.type) }}>
            <div className="node-title">
              <h3>{node.id}</h3>
              {isEdited && <span className="edited-badge">EDITED</span>}
            </div>
            <p className="node-meta">
              {node.type} • Page {node.page} • {node.section}
            </p>
          </div>

          <div className="node-text-section">
            <h4>Text</h4>
            {editMode ? (
              <div className="edit-mode">
                <textarea
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  className="edit-textarea"
                />
                <div className="edit-buttons">
                  <button onClick={handleSaveEdit} className="save-btn">
                    Save
                  </button>
                  <button
                    onClick={() => setEditMode(false)}
                    className="cancel-btn"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="node-text">{formatNodeText(node.text)}</p>
                <button
                  onClick={() => setEditMode(true)}
                  className="edit-btn"
                >
                  Edit
                </button>
              </>
            )}
          </div>

          <div className="dependencies-section">
            <h4>Dependencies</h4>
            <div className="dependency-list">
              <strong>Incoming:</strong>
              {incomingEdges.length > 0 ? (
                incomingEdges.map((edge, i) => (
                  <p key={i}>
                    {edge.source} <span className="relation">{edge.relation}</span> {edge.target}
                  </p>
                ))
              ) : (
                <p className="no-deps">None</p>
              )}
            </div>
            <div className="dependency-list">
              <strong>Outgoing:</strong>
              {outgoingEdges.length > 0 ? (
                outgoingEdges.map((edge, i) => (
                  <p key={i}>
                    {edge.source} <span className="relation">{edge.relation}</span> {edge.target}
                  </p>
                ))
              ) : (
                <p className="no-deps">None</p>
              )}
            </div>
          </div>

          <div className="pdf-section">
              <h4>PDF Viewer</h4>
              <div className="pdf-controls">
                <button
                  onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage <= 1}
                >
                  Prev
                </button>
                <input
                  type="number"
                  min="1"
                  max={numPages}
                  value={currentPage}
                  onChange={(e) => {
                    const nextPage = parseInt(e.target.value, 10) || 1;
                    onPageChange(Math.min(numPages || nextPage, Math.max(1, nextPage)));
                  }}
                  className="page-input"
                />
                <span className="page-count">/ {numPages}</span>
                <button
                  onClick={() => onPageChange(Math.min(numPages, currentPage + 1))}
                  disabled={currentPage >= numPages}
                >
                  Next
                </button>
              </div>
              <div className="pdf-viewer" ref={pdfWrapperRef}>
                {pdfBlob && !pdfError && (
                  <Document
                    file={pdfBlob}
                    onLoadSuccess={({ numPages }) => {
                      setNumPages(numPages);
                      if (currentPage > numPages) onPageChange(numPages);
                    }}
                    loading={<p>Loading PDF...</p>}
                    onLoadError={() => setPdfError(true)}
                  >
                    <Page
                      pageNumber={currentPage}
                      loading={<p>Loading page...</p>}
                      width={pdfWidth}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                    />
                  </Document>
                )}
                {pdfError && (
                  <p className="no-deps">PDF preview unavailable</p>
                )}
              </div>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <p>Select a node to view details</p>
        </div>
      )}
    </div>
  );
}
