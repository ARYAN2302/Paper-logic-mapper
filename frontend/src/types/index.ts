export interface CoordBounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Node {
  id: string;
  type: string; // "Definition" | "Assumption" | "Lemma" | "Theorem" | "Claim" | "Proof"
  text: string;
  page: number;
  section: string;
  coords?: CoordBounds;
}

export interface Edge {
  source: string;
  target: string;
  relation: string;
}

export interface GraphData {
  nodes: Node[];
  edges: Edge[];
  paragraph_coords?: Record<string, CoordBounds>;
}

export interface PaperSession {
  id: string;
  filename: string;
  graph: GraphData;
  pdfBlob: string; // base64 data URL
  editedNodes?: Record<string, Node>;
}
