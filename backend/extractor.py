import os
import json
import uuid
import tempfile
from typing import Tuple, Dict, Optional
try:
    import fitz  # PyMuPDF
    _HAVE_FITZ = True
except Exception:
    fitz = None
    _HAVE_FITZ = False
    # PyMuPDF binary may be missing on some systems; we'll fall back to PyPDF2
    from PyPDF2 import PdfReader
import google.generativeai as genai
from dotenv import load_dotenv
from models import Node, Edge, GraphData, CoordBounds


# Configure Gemini API
load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
_DEFAULT_GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
_MAX_CHARS = int(os.getenv("MAX_CHARS", "60000"))


def extract_pdf_text(pdf_path: str) -> Tuple[str, int, Dict[str, CoordBounds]]:
    """
    Extract text from PDF with page markers and paragraph coordinates.
    
    Returns:
        (text, max_page, paragraph_coords_dict)
        - text: concatenated text with page markers
        - max_page: total number of pages
        - paragraph_coords_dict: mapping of text snippets to their bounding boxes
    """
    try:
        text_chunks = []
        paragraph_coords = {}

        if _HAVE_FITZ and fitz is not None:
            doc = fitz.open(pdf_path)
            max_page = doc.page_count

            for page_num, page in enumerate(doc, start=1):
                text_chunks.append(f"\n--- PAGE {page_num} ---\n")

                try:
                    text_dict = page.get_text("rawdict")
                    page_has_text = False
                    for block in text_dict.get("blocks", []):
                        if block["type"] == 0:
                            block_text = ""
                            for line in block.get("lines", []):
                                for span in line.get("spans", []):
                                    text = span.get("text", "")
                                    block_text += text
                                    bbox = span.get("bbox", (0, 0, 0, 0))
                                    coords = CoordBounds(
                                        x0=bbox[0],
                                        y0=bbox[1],
                                        x1=bbox[2],
                                        y1=bbox[3]
                                    )
                                    key = text[:50] if text else f"unnamed_{len(paragraph_coords)}"
                                    if key not in paragraph_coords:
                                        paragraph_coords[key] = coords

                            if block_text.strip():
                                page_has_text = True
                                text_chunks.append(block_text)

                    if not page_has_text:
                        simple_text = page.get_text()
                        if simple_text:
                            text_chunks.append(simple_text)
                except Exception:
                    simple_text = page.get_text()
                    text_chunks.append(simple_text)

            doc.close()

        else:
            # Fallback using PyPDF2 to extract plain text (no coordinates)
            reader = PdfReader(pdf_path)
            max_page = len(reader.pages)
            for page_num in range(max_page):
                page = reader.pages[page_num]
                text_chunks.append(f"\n--- PAGE {page_num+1} ---\n")
                try:
                    page_text = page.extract_text() or ""
                except Exception:
                    page_text = ""
                text_chunks.append(page_text)

        # Concatenate and truncate to a safe length for the model
        full_text = "".join(text_chunks)[:_MAX_CHARS]
        return full_text, max_page, paragraph_coords

    except Exception as e:
        raise Exception(f"Failed to extract PDF: {str(e)}")


def _heuristic_extraction(text: str) -> Dict:
    import re
    nodes = []
    edges = []
    lines = text.splitlines()
    cur_block = None
    cur_type = None
    cur_text_lines = []
    cur_page = 1
    cur_section = ""

    for line in lines:
        m = re.match(r"^--- PAGE (\d+) ---", line)
        if m:
            cur_page = int(m.group(1))
            continue

        section_match = re.match(r"^\s*(\d+(?:\.\d+)*)\s+(.+)$", line)
        if section_match and len(section_match.group(2)) >= 3:
            cur_section = f"{section_match.group(1)} {section_match.group(2)}".strip()

        header = re.match(
            r"^(Definition|Assumption|Lemma|Theorem|Claim|Proof)\b\s*([\w\.-]*)\s*[:.]?\s*(.*)",
            line
        )
        if header:
            if cur_block:
                nodes.append({
                    "id": cur_block,
                    "type": cur_type,
                    "text": "\n".join(cur_text_lines).strip(),
                    "page": cur_page,
                    "section": cur_section
                })
            cur_type = header.group(1)
            label = header.group(2) or ""
            header_text = header.group(3) or ""
            cur_block = f"{cur_type} {label}".strip() or str(uuid.uuid4())
            cur_text_lines = [header_text] if header_text else []
        else:
            if cur_block:
                cur_text_lines.append(line)

    if cur_block:
        nodes.append({
            "id": cur_block,
            "type": cur_type,
            "text": "\n".join(cur_text_lines).strip(),
            "page": cur_page,
            "section": cur_section
        })

    node_ids = [n["id"] for n in nodes]
    for node in nodes:
        for target_id in node_ids:
            if target_id == node["id"]:
                continue
            if target_id in node.get("text", ""):
                edges.append({
                    "source": node["id"],
                    "target": target_id,
                    "relation": "uses"
                })

    return {"nodes": nodes, "edges": edges}


def call_gemini_extraction(text: str, max_page: int) -> Dict:
    """
    Call Gemini API to extract logical blocks from paper text.
    
    Returns:
        Parsed JSON response with nodes and edges
    """
    extraction_prompt = f"""You are a logic extractor for academic papers. Given the following text from a research paper, identify formal logical blocks.

Allowed types (strict): Definition, Assumption, Lemma, Theorem, Claim, Proof.

For each block, extract:
- id: the exact label as written (e.g., "Lemma 4.2", "Theorem 1", "Definition 3")
- type: one of the allowed types
- text: the full statement, as verbatim as possible
- page: the page number where this block appears (1-indexed, must be between 1 and {max_page})
- section: the nearest section header (e.g., "4.1 Convergence Analysis")

Then map dependencies between blocks:
- edges: list of {{source, target, relation}}

Dependency rules:
- Only create an edge if the relationship is EXPLICIT in the text (e.g., "By Lemma 4.1", "Under Assumption 2", "Proof of Theorem 1").
- Allowed relations: "uses", "assumes", "proves", "builds on", "depends on".
- If a target node does not exist in your extracted nodes, DROP that edge. Do not invent nodes.
- If a proof is inline and unlabeled, skip it.

Output strict JSON matching this schema:
{{
  "nodes": [{{"id": "...", "type": "...", "text": "...", "page": 1, "section": "..."}}],
  "edges": [{{"source": "...", "target": "...", "relation": "..."}}]
}}

Paper text:
{text}"""

    try:
        def _run_model(model_name: str) -> str:
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(
                extraction_prompt,
                generation_config={
                    "temperature": 0.1,
                    "max_output_tokens": 8192,
                }
            )
            return response.text

        model_candidates = []
        if _DEFAULT_GEMINI_MODEL:
            model_candidates.append(_DEFAULT_GEMINI_MODEL)
        model_candidates.extend([
            "gemini-1.5-flash",
            "gemini-1.5-pro",
            "gemini-1.0-pro",
        ])
        model_candidates = [m for i, m in enumerate(model_candidates) if m and m not in model_candidates[:i]]

        response_text = None
        last_err = None
        for model_name in model_candidates:
            try:
                response_text = _run_model(model_name)
                if response_text:
                    break
            except Exception as err:
                last_err = err

        if not response_text:
            raise Exception(last_err or Exception("No response from Gemini"))

        # Try to parse JSON
        try:
            start = response_text.find("{")
            end = response_text.rfind("}") + 1
            if start >= 0 and end > start:
                json_str = response_text[start:end]
                result = json.loads(json_str)
                return result
            else:
                raise ValueError("No JSON found in response")
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse JSON: {str(e)}")

    except Exception as e:
        # If Gemini fails (model not available or network), fall back to a simple
        # heuristic extractor that finds headings like Theorem/Lemma/Definition.
        try:
            return _heuristic_extraction(text)
        except Exception:
            raise Exception(f"Gemini API call failed: {str(e)}")


def sanitize_graph_data(raw_data: Dict, paragraph_coords: Dict[str, CoordBounds]) -> GraphData:
    """
    Sanitize extracted graph data: validate node types, filter orphaned edges, attach coordinates.
    
    Returns:
        GraphData with validated nodes and edges
    """
    allowed_types = {"Definition", "Assumption", "Lemma", "Theorem", "Claim", "Proof"}
    
    # Parse nodes
    nodes = []
    valid_node_ids = set()
    
    for node_data in raw_data.get("nodes", []):
        # Validate type
        if node_data.get("type") not in allowed_types:
            continue

        # Clean up extracted text for readability
        raw_text = node_data.get("text", "") or ""
        def sanitize_extracted_text(text: str) -> str:
            import re
            # Fix spacing around common math/symbol patterns
            text = re.sub(r"-\s*\n", "", text)
            text = re.sub(r"\s*\n\s*", " ", text)
            text = re.sub(r"([a-zA-Z])([^a-zA-Z\s\d])", r"\1 \2", text)
            text = re.sub(r"([^a-zA-Z\s\d])([a-zA-Z])", r"\1 \2", text)
            text = re.sub(r"(\d)([a-zA-Z])", r"\1 \2", text)
            text = re.sub(r"\s+", " ", text)
            return text.strip()

        cleaned_text = sanitize_extracted_text(raw_text)

        # Create node with optional coords
        node = Node(
            id=node_data.get("id", ""),
            type=node_data.get("type", ""),
            text=cleaned_text,
            page=node_data.get("page", 1),
            section=node_data.get("section", ""),
            coords=None  # Will be set from paragraph_coords if available
        )
        
        # Try to attach coordinates from paragraph_coords
        text_key = node.text[:50] if node.text else ""
        if text_key in paragraph_coords:
            node.coords = paragraph_coords[text_key]
        
        nodes.append(node)
        valid_node_ids.add(node.id)
    
    # Parse and filter edges
    edges = []
    for edge_data in raw_data.get("edges", []):
        source = edge_data.get("source")
        target = edge_data.get("target")
        
        # Only keep edge if both endpoints exist
        if source in valid_node_ids and target in valid_node_ids:
            edge = Edge(
                source=source,
                target=target,
                relation=edge_data.get("relation", "")
            )
            edges.append(edge)
    
    return GraphData(
        nodes=nodes,
        edges=edges,
        paragraph_coords=paragraph_coords
    )


def process_pdf(file_path: str) -> GraphData:
    """
    Main pipeline: extract PDF → call Gemini → sanitize → return GraphData.
    
    Args:
        file_path: path to uploaded PDF
        
    Returns:
        GraphData with extracted nodes and edges
    """
    try:
        # Extract PDF text and coordinates
        text, max_page, paragraph_coords = extract_pdf_text(file_path)
        
        if not text.strip():
            raise ValueError("No extractable text found in PDF")
        
        # Call Gemini API
        raw_data = call_gemini_extraction(text, max_page)
        
        # Sanitize and return
        graph_data = sanitize_graph_data(raw_data, paragraph_coords)

        # If we got nothing, fall back to heuristic extraction
        if not graph_data.nodes:
            raw_data = _heuristic_extraction(text)
            graph_data = sanitize_graph_data(raw_data, paragraph_coords)
        
        return graph_data
        
    except Exception as e:
        raise Exception(f"PDF processing failed: {str(e)}")
