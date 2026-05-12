Here is your complete, copy-pasteable master prompt. Feed this into Cursor, Claude, ChatGPT, or any vibe-coding tool. It is scoped to build the entire thing end-to-end.

---

# MASTER BUILD PROMPT: Paper Logic Mapper

## 1. PROJECT IDENTITY

Build **Paper Logic Mapper** — a web application that transforms academic PDFs into interactive dependency graphs of their logical structure (Definitions, Assumptions, Lemmas, Theorems, Claims, Proofs). A user uploads one or more PDFs. The app extracts the paper's logical skeleton using an LLM, renders it as a force-directed graph, and allows the user to click any node to see its exact text, mathematical content, and dependencies. A synced PDF viewer jumps to the correct page.

This is not a chat-with-PDF tool. It is a **structural decompiler** for academic papers. The core "aha" moment: clicking a Theorem and instantly seeing the exact chain of Lemmas and Definitions it rests upon, while the PDF viewer simultaneously jumps to the source page.

## 2. PHILOSOPHY & CONSTRAINTS

- **No database.** Everything is in-memory per session. No auth, no user accounts, no persistence.
- **Best-effort rendering.** KaTeX renders whatever unicode math PyMuPDF extracts. Some equations will be perfect; others plain text. This is acceptable.
- **Page-level sync only.** The PDF viewer jumps to the correct page when a node is clicked. No paragraph-level coordinate mapping.
- **Multi-paper is tabs, ** Users can upload multiple papers and switch between them via a sidebar. There is cross-paper comparison and search.
- **Target time: 10 hours.** Do not over-engineer. Prefer working code over perfect code.

## 3. TECH STACK

**Backend:**
- Python 3.11+
- FastAPI
- PyMuPDF (fitz) for PDF text extraction with page numbers
- OpenAI API (gpt-4o-mini) with JSON mode
- python-multipart, pydantic, uvicorn
- CORS enabled for frontend origin

**Frontend:**
- React 18 + TypeScript
- Vite (build tool)
- Cytoscape.js + react-cytoscapejs for the graph
- cytoscape-cola for force-directed layout
- react-pdf for PDF viewing (page-level navigation)
- react-katex or better-react-mathjax for math rendering
- No UI framework (Tailwind not required; use inline styles or plain CSS to save setup time)

## 4. DATA MODELS

**Backend Pydantic Models:**

```python
class Node(BaseModel):
    id: str           # e.g., "Lemma 4.2", "Theorem 1"
    type: str         # "Definition" | "Assumption" | "Lemma" | "Theorem" | "Claim" | "Proof"
    text: str         # Full extracted statement
    page: int         # Page number in PDF
    section: str      # Nearest section header

class Edge(BaseModel):
    source: str       # Node id
    target: str       # Node id
    relation: str     # e.g., "uses", "assumes", "proves", "builds on"

class GraphData(BaseModel):
    nodes: list[Node]
    edges: list[Edge]
```

**Frontend State Shape:**

```typescript
interface PaperSession {
  id: string;              // uuid
  filename: string;
  graph: GraphData;
  pdfBlob: string;         // base64 data URL
}

// App state
const [papers, setPapers] = useState<PaperSession[]>([]);
const [activePaperId, setActivePaperId] = useState<string | null>(null);
const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
const [currentPage, setCurrentPage] = useState<number>(1);
```

## 5. BACKEND SPECIFICATION

### Endpoint: `POST /extract`

**Request:** `multipart/form-data` with a single field `file` (PDF only).

**Processing Pipeline:**
1. Receive PDF, save to `/tmp/{uuid}.pdf`.
2. Open with PyMuPDF. Iterate pages. Extract text with `page.get_text()`. Preserve page numbers.
3. Concatenate text chunks with markers: `\n--- PAGE {n} ---\n`.
4. Truncate to first 15,000 characters (covers most theoretical papers' core logic).
5. Send to OpenAI API with the extraction prompt below. Use `response_format={"type": "json_object"}` and `temperature=0.1`.
6. Parse JSON. **Sanitize:** Collect all valid node IDs. Drop any edge whose `source` or `target` does not exist in the node list. Drop any node whose `type` is not in the allowed enum.
7. Delete temp file.
8. Return `GraphData`.

### LLM Extraction Prompt (Exact Text)

```
You are a logic extractor for academic papers. Given the following text from a research paper, identify formal logical blocks.

Allowed types (strict): Definition, Assumption, Lemma, Theorem, Claim, Proof.

For each block, extract:
- id: the exact label as written (e.g., "Lemma 4.2", "Theorem 1", "Definition 3")
- type: one of the allowed types
- text: the full statement, as verbatim as possible
- page: the page number where this block appears
- section: the nearest section header (e.g., "4.1 Convergence Analysis")

Then map dependencies between blocks:
- edges: list of {source, target, relation}

Dependency rules:
- Only create an edge if the relationship is EXPLICIT in the text (e.g., "By Lemma 4.1", "Under Assumption 2", "Proof of Theorem 1").
- Allowed relations: "uses", "assumes", "proves", "builds on", "depends on".
- If a target node does not exist in your extracted nodes, DROP that edge. Do not invent nodes.
- If a proof is inline and unlabeled, skip it.

Output strict JSON matching this schema:
{
  "nodes": [{"id": "...", "type": "...", "text": "...", "page": 1, "section": "..."}],
  "edges": [{"source": "...", "target": "...", "relation": "..."}]
}
```

### Error Handling
- If OpenAI returns invalid JSON: retry once. If still invalid, return HTTP 500 with message.
- If PDF has no extractable text: return HTTP 400.
- If no logical blocks found: return empty nodes/edges arrays (HTTP 200).

## 6. FRONTEND SPECIFICATION

### Layout (Three-Panel)

```
┌──────────┬──────────────────────────────┬─────────────────────┐
│ SIDEBAR  │        GRAPH VIEW            │    SOURCE PANE      │
│ (narrow) │       (main, 50%)            │      (right, 30%)   │
│          │                              │                     │
│ [Upload] │   [Force-directed graph]     │  [Node details]     │
│ Paper 1  │                              │  [KaTeX math]       │
│ Paper 2  │   Click node →               │  [Dependencies]     │
│ ...      │   highlights +               │  [PDF Viewer]       │
│          │   viewer jumps               │                     │
└──────────┴──────────────────────────────┴─────────────────────┘
```

### Component: Sidebar
- Shows list of uploaded papers by filename.
- Click to switch `activePaperId`.
- "Upload New" button triggers file input.
- When a new PDF is uploaded:
  1. Read file as base64 for `react-pdf`.
  2. POST to `/extract`.
  3. On response, create new `PaperSession`, append to `papers`, set as active.
- Show loading spinner on the paper being processed.

### Component: GraphView
- Uses `CytoscapeComponent` with `cytoscape-cola` layout (`infinite: true`).
- **Node styling by type:**
  - Definition: `#3b82f6` (blue)
  - Assumption: `#eab308` (yellow)
  - Lemma: `#22c55e` (green)
  - Theorem: `#ef4444` (red)
  - Claim: `#a855f7` (purple)
  - Proof: `#6b7280` (gray)
- Node size: 40px. Label = node `id`. White text, slight outline.
- Edges: gray, directed arrows, bezier curves.
- **Interactions:**
  - Click node: call `onNodeSelect(nodeId, nodeData.page)`.
  - Hover node: show tooltip with type and page.
- **Re-initialization:** When `activePaperId` changes, destroy and rebuild Cytoscape instance with new elements. Do not attempt to diff-update.

### Component: SourcePane
- **Header:** Selected node `id` in its type color. Subtitle: `Type • Page N • Section`.
- **Text block:** Render `node.text` inside a KaTeX auto-render wrapper. If KaTeX fails to parse, fall back to `<pre>` plain text. Do not crash the app.
- **Dependencies list:**
  - Outgoing: "This node → [relation] → [target]"
  - Incoming: "[source] → [relation] → this node"
- **PDF Viewer:**
  - Use `react-pdf` `<Document>` and `<Page>`.
  - Show page number input / prev / next buttons.
  - When `currentPage` prop changes (from graph click), jump to that page.
  - Display at 100% width of the pane, scrollable.

### Component: UploadZone
- Drag-and-drop or click to select PDF.
- Accepts only `.pdf`.
- On upload, show "Extracting logic..." until backend responds.

## 7. API CONTRACT

```
POST /extract
Content-Type: multipart/form-data

Response 200:
{
  "nodes": [...],
  "edges": [...]
}

Response 400: {"detail": "PDF only or no extractable text"}
Response 500: {"detail": "Extraction failed: ..."}
```

## 8. CRITICAL IMPLEMENTATION DETAILS

1. **CORS:** Backend must allow the frontend origin. Use `allow_origins=["*"]` for development.
2. **PDF Base64:** Frontend reads the uploaded File as base64 using `FileReader.readAsDataURL()` so `react-pdf` can render it without re-fetching.
3. **KaTeX Fallback:** Wrap in try-catch. If `katex.renderToString` throws, render plain text.
4. **Cytoscape Cleanup:** On component unmount or paper switch, call `cy.destroy()` to prevent memory leaks.
5. **OpenAI Key:** Backend reads from `OPENAI_API_KEY` env var. Never expose to frontend.
6. **File Size Limit:** Reject PDFs > 20MB to prevent timeout.

## 9. DEPLOYMENT

**Backend (Render):**
- Create Web Service from GitHub repo.
- Root directory: `backend/`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Environment variable: `OPENAI_API_KEY`

**Frontend (Vercel):**
- Import GitHub repo.
- Framework: Vite.
- Update the `fetch` URL in the frontend to point to the Render backend URL before deploying.

**Fallback:** If deployment fails for any reason, record a 2-minute screen recording of the app working on localhost and submit that.

## 9.1 Nice to haves

Cross-paper search or comparison analytics
Paragraph-level PDF sync (pixel coordinates).
Editing extracted nodes.
Exporting graphs to PNG/SVG.

## 10. WHAT SUCCESS LOOKS LIKE

A user can:
1. Upload a 10-page ML theory PDF.
2. See a force-directed graph appear with 8–15 colored nodes within 20 seconds.
3. Click "Theorem 2" → right pane shows the theorem text with rendered math, lists the Lemmas it depends on, and the PDF viewer jumps to page 6.
4. Upload a second paper → sidebar now has two items → click first item → graph switches back seamlessly.

## 11. EXPLICITLY OUT OF SCOPE (Do Not Build)

- User authentication or accounts.
- Database persistence (PostgreSQL, MongoDB, etc.).
- Server-side file storage (S3, etc.). Session-only.
- Real-time collaboration.
- Mobile responsiveness (desktop only is fine).

---

we will not use open ai api key will use gemeini api key so keep that in mind