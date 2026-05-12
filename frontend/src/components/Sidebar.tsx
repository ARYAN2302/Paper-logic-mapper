import React, { useRef } from 'react';
import type { PaperSession } from '../types';
import './Sidebar.css';

interface SidebarProps {
  papers: PaperSession[];
  activePaperId: string | null;
  onPaperSelect: (id: string) => void;
  onUpload: (file: File) => void;
  onSearch: (query: string) => void;
  searchQuery: string;
  comparisonMode: boolean;
  onComparisonToggle: () => void;
  comparisonPaperId: string | null;
  onComparisonPaperSelect: (id: string | null) => void;
  children?: React.ReactNode;
}

export default function Sidebar({
  papers,
  activePaperId,
  onPaperSelect,
  onUpload,
  onSearch,
  searchQuery,
  comparisonMode,
  onComparisonToggle,
  comparisonPaperId,
  onComparisonPaperSelect,
  children,
}: SidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploading(true);
      try {
        await onUpload(file);
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>Paper Mapper</h2>
      </div>

      <div className="upload-section">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <button
          className="upload-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? 'Processing...' : '+ Upload PDF'}
        </button>
      </div>

      <div className="search-section">
        <input
          type="text"
          placeholder="Search nodes..."
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="comparison-section">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={comparisonMode}
            onChange={onComparisonToggle}
          />
          Comparison Mode
        </label>
      </div>

      <div className="papers-list">
        <h3>Papers</h3>
        {papers.length === 0 ? (
          <p className="empty-text">No papers uploaded</p>
        ) : (
          papers.map((paper) => (
            <div key={paper.id}>
              <button
                className={`paper-item ${activePaperId === paper.id ? 'active' : ''}`}
                onClick={() => onPaperSelect(paper.id)}
              >
                <span className="paper-icon" aria-hidden="true" />
                <span>{paper.filename}</span>
              </button>
              {comparisonMode && activePaperId && activePaperId !== paper.id && (
                <button
                  className={`comparison-select ${comparisonPaperId === paper.id ? 'selected' : ''}`}
                  onClick={() => onComparisonPaperSelect(comparisonPaperId === paper.id ? null : paper.id)}
                >
                  {comparisonPaperId === paper.id ? 'Selected' : 'Compare'}
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {children}
    </div>
  );
}
