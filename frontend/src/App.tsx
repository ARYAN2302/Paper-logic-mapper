import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import './App.css';
import Sidebar from './components/Sidebar';
import GraphView from './components/GraphView';
import SourcePane from './components/SourcePane';
import ComparisonView from './components/ComparisonView';
import CrossPaperSearch from './components/CrossPaperSearch';
import type { PaperSession, Node, GraphData } from './types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');

function App() {
  const [papers, setPapers] = useState<PaperSession[]>([]);
  const [activePaperId, setActivePaperId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [comparisonMode, setComparisonMode] = useState<boolean>(false);
  const [comparisonPaperId, setComparisonPaperId] = useState<string | null>(null);

  const activePaper = papers.find(p => p.id === activePaperId);

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target?.result as string);
      reader.onerror = () => reject(new Error('Could not read PDF'));
      reader.readAsDataURL(file);
    });

  const handlePaperUpload = async (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      alert('Please upload a PDF file.');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      alert('Please upload a PDF under 20MB.');
      return;
    }

    const newPaperId = uuidv4();
    
    try {
      const pdfBlob = await readFileAsDataUrl(file);

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE_URL}/extract`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to extract PDF');
      }

      const graph: GraphData = await response.json();

      const newPaper: PaperSession = {
        id: newPaperId,
        filename: file.name,
        graph,
        pdfBlob,
        editedNodes: {},
      };

      setPapers((currentPapers) => [...currentPapers, newPaper]);
      setActivePaperId(newPaperId);
      setSelectedNodeId(null);
      setCurrentPage(1);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload and process PDF');
      throw error;
    }
  };

  const handleNodeSelect = (nodeId: string, page: number) => {
    setSelectedNodeId(nodeId);
    setCurrentPage(page);
  };

  const handleNodeEdit = (nodeId: string, updatedNode: Node) => {
    if (!activePaper) return;
    
    const updatedPapers = papers.map(p => {
      if (p.id === activePaperId) {
        return {
          ...p,
          editedNodes: {
            ...p.editedNodes,
            [nodeId]: updatedNode,
          }
        };
      }
      return p;
    });
    
    setPapers(updatedPapers);
  };

  const handleComparisonModeToggle = () => {
    setComparisonMode(!comparisonMode);
    if (comparisonMode) {
      setComparisonPaperId(null);
    }
  };

  const handleSearchNodeSelect = (nodeId: string, paperId: string) => {
    const paper = papers.find((p) => p.id === paperId);
    const node = paper?.graph.nodes.find((n) => n.id === nodeId);
    if (!paper || !node) return;

    setComparisonMode(false);
    setComparisonPaperId(null);
    setActivePaperId(paperId);
    setSelectedNodeId(nodeId);
    setCurrentPage(node.page || 1);
  };

  const getDisplayGraph = () => {
    if (!activePaper) return null;
    
    const graph = activePaper.graph;
    const editedNodes = activePaper.editedNodes || {};
    
    // Replace nodes with edited versions if they exist
    const nodes = graph.nodes.map(node => 
      editedNodes[node.id] || node
    );
    
    return { ...graph, nodes };
  };

  const nodeTypeColors: Record<string, string> = {
    Definition: '#3b82f6',
    Assumption: '#eab308',
    Lemma: '#22c55e',
    Theorem: '#ef4444',
    Claim: '#a855f7',
    Proof: '#6b7280',
  };

  return (
    <div className="app">
      <Sidebar
        papers={papers}
        activePaperId={activePaperId}
        onPaperSelect={setActivePaperId}
        onUpload={handlePaperUpload}
        onSearch={setSearchQuery}
        searchQuery={searchQuery}
        comparisonMode={comparisonMode}
        onComparisonToggle={handleComparisonModeToggle}
        comparisonPaperId={comparisonPaperId}
        onComparisonPaperSelect={setComparisonPaperId}
      >
        <CrossPaperSearch
          papers={papers}
          searchQuery={searchQuery}
          onNodeSelect={handleSearchNodeSelect}
        />
      </Sidebar>
      
      <div className="main-content">
        {activePaper && !comparisonMode && (
          <>
            <GraphView
              graphData={getDisplayGraph()}
              onNodeSelect={handleNodeSelect}
              selectedNodeId={selectedNodeId}
              nodeTypeColors={nodeTypeColors}
            />
            <SourcePane
              node={selectedNodeId && getDisplayGraph()?.nodes.find(n => n.id === selectedNodeId) || null}
              graphData={getDisplayGraph()}
              currentPage={currentPage}
              pdfBlob={activePaper.pdfBlob}
              onPageChange={setCurrentPage}
              onNodeEdit={handleNodeEdit}
              isEdited={selectedNodeId && activePaper.editedNodes?.[selectedNodeId] ? true : false}
            />
          </>
        )}
        
        {comparisonMode && activePaper && comparisonPaperId && (
          <ComparisonView
            paper1={activePaper}
            paper2={papers.find(p => p.id === comparisonPaperId)!}
            onNodeSelect={handleNodeSelect}
            selectedNodeId={selectedNodeId}
            nodeTypeColors={nodeTypeColors}
          />
        )}
        
        {!activePaper && (
          <div className="empty-state">
            <h2>Paper Logic Mapper</h2>
            <p>Upload a PDF to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
