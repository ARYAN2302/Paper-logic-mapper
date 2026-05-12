from pydantic import BaseModel
from typing import Optional, Dict, List


class CoordBounds(BaseModel):
    """Bounding box for paragraph-level text location."""
    x0: float
    y0: float
    x1: float
    y1: float


class Node(BaseModel):
    """Logical node extracted from paper."""
    id: str  # e.g., "Lemma 4.2", "Theorem 1"
    type: str  # "Definition" | "Assumption" | "Lemma" | "Theorem" | "Claim" | "Proof"
    text: str  # Full extracted statement
    page: int  # Page number in PDF (1-indexed)
    section: str  # Nearest section header
    coords: Optional[CoordBounds] = None  # Bounding box for paragraph highlighting


class Edge(BaseModel):
    """Logical dependency between nodes."""
    source: str  # Node id
    target: str  # Node id
    relation: str  # e.g., "uses", "assumes", "proves", "builds on", "depends on"


class GraphData(BaseModel):
    """Complete extracted graph structure."""
    nodes: List[Node]
    edges: List[Edge]
    paragraph_coords: Optional[Dict[str, CoordBounds]] = None  # Text snippet -> coords mapping
