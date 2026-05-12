import type { PaperSession } from '../types';
import './CrossPaperSearch.css';

interface CrossPaperSearchProps {
  papers: PaperSession[];
  searchQuery: string;
  onNodeSelect?: (nodeId: string, paperId: string) => void;
}

export default function CrossPaperSearch({
  papers,
  searchQuery,
  onNodeSelect,
}: CrossPaperSearchProps) {
  const results = searchQuery
    ? papers.flatMap((paper) => ({
        paperId: paper.id,
        filename: paper.filename,
        nodes: paper.graph.nodes.filter(
          (node) =>
            node.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            node.text.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      })).filter(r => r.nodes.length > 0)
    : [];
  const resultCount = results.reduce((count, result) => count + result.nodes.length, 0);

  if (!searchQuery) {
    return null;
  }

  return (
    <div className="cross-paper-search">
      <h4>Search Results ({resultCount})</h4>
      {results.length === 0 ? (
        <p className="no-results">No results found</p>
      ) : (
        <div className="results-list">
          {results.map((result) => (
            <div key={result.paperId} className="result-paper">
              <p className="paper-name">{result.filename}</p>
              {result.nodes.map((node) => (
                <button
                  key={node.id}
                  className="result-node"
                  onClick={() => onNodeSelect?.(node.id, result.paperId)}
                >
                  <span className="node-id">{node.id}</span>
                  <span className="node-type">{node.type}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
