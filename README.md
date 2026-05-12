# Paper Logic Mapper

A web application that transforms academic PDFs into interactive dependency graphs of their logical structure (Definitions, Assumptions, Lemmas, Theorems, Claims, Proofs).

## Features

- **PDF Upload & Processing**: Upload academic PDFs and automatically extract logical structures using Gemini API
- **Interactive Graph**: Force-directed graph visualization of dependencies between theorems, lemmas, definitions, etc.
- **PDF Viewer Integration**: Click any node to jump to the corresponding page in the PDF
- **Multi-Paper Support**: Upload and manage multiple papers with tabs
- **Cross-Paper Search**: Search across all loaded papers for nodes by text or ID
- **Comparison Mode**: Side-by-side comparison of two papers with overlaid dependency chains
- **Node Editing**: Edit extracted node text inline (session-only)
- **Graph Export**: Export graphs to PNG or SVG format
- **Paragraph-Level PDF Sync**: Highlights specific text regions in the PDF

## Tech Stack

**Backend:**
- Python 3.11+
- FastAPI
- PyMuPDF (fitz) - PDF text extraction
- Google Generative AI (Gemini)

**Frontend:**
- React 18 + TypeScript
- Vite
- Cytoscape.js + react-cytoscapejs - Graph rendering
- react-pdf - PDF viewing
- html2canvas - Graph export

## Setup

### Prerequisites

- Node.js 18+
- Python 3.11+
- Google Generative AI API key

### Backend Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create a `.env` file in the backend directory:

```
GEMINI_API_KEY=your_gemini_api_key_here
```

Start the backend:

```bash
python3 -m uvicorn main:app --reload
```

The backend will be available at `http://localhost:8000`

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`

## Usage

1. Open the frontend in your browser
2. Click "Upload PDF" to upload a research paper
3. Wait for the extraction to complete
4. The graph will render automatically
5. Click any node to see details, dependencies, and the PDF page
6. Use comparison mode to view two papers side-by-side
7. Edit nodes inline and export graphs as needed

## API Endpoints

### POST /extract

Extract logical structure from a PDF.

**Request:**
- `file` (multipart/form-data): PDF file

**Response:**
```json
{
  "nodes": [
    {
      "id": "Theorem 1",
      "type": "Theorem",
      "text": "...",
      "page": 1,
      "section": "Introduction",
      "coords": { "x0": 0, "y0": 0, "x1": 100, "y1": 50 }
    }
  ],
  "edges": [
    {
      "source": "Lemma 1",
      "target": "Theorem 1",
      "relation": "uses"
    }
  ],
  "paragraph_coords": { ... }
}
```

### GET /health

Health check endpoint.

## Project Structure

```
Paper-Mapper/
├── backend/
│   ├── main.py              # FastAPI app & routes
│   ├── models.py            # Pydantic models
│   ├── extractor.py         # PDF extraction & Gemini integration
│   ├── requirements.txt      # Python dependencies
│   └── .env.example         # Environment template
├── frontend/
│   ├── src/
│   │   ├── App.tsx          # Main app component
│   │   ├── App.css          # App styles
│   │   ├── components/      # React components
│   │   │   ├── Sidebar.tsx
│   │   │   ├── GraphView.tsx
│   │   │   ├── SourcePane.tsx
│   │   │   ├── PDFViewer.tsx (part of SourcePane)
│   │   │   ├── ComparisonView.tsx
│   │   │   └── CrossPaperSearch.tsx
│   │   ├── types/
│   │   │   └── index.ts     # TypeScript interfaces
│   │   └── index.css        # Global styles
│   ├── package.json         # Node dependencies
│   └── vite.config.ts
└── README.md
```

## Limitations

- Session-only storage (no persistence across page reloads)
- Best-effort PDF text extraction (works best with text-based PDFs)
- Paragraph-level coordinates depend on PDF structure
- No user authentication or multi-user support

## Nice-to-Haves (Future)

- Database persistence
- Real-time collaboration
- Mobile responsiveness
- Paragraph-level pixel coordinate PDF sync
- Custom node types
- Advanced filtering and visualization options

## License

MIT

## Development Notes

- The app uses in-memory storage per browser session
- API key is server-side only, never exposed to frontend
- PDFs are processed locally and not stored
- Graph rendering uses force-directed layout via Cytoscape-cola
