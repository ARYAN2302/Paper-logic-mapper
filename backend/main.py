import os
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import tempfile
from extractor import process_pdf
from models import GraphData

app = FastAPI(title="Paper Logic Mapper API")

# Enable CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok"}


@app.post("/extract")
async def extract_pdf(file: UploadFile = File(...)) -> GraphData:
    """
    Extract logical structure from a PDF file.
    
    Args:
        file: PDF file (multipart/form-data)
        
    Returns:
        GraphData with nodes and edges
    """
    # Validate file
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")
    
    # Check file size (max 20MB)
    file_content = await file.read()
    if len(file_content) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size exceeds 20MB limit")
    
    temp_path = None
    try:
        # Save to temporary file
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(file_content)
            temp_path = tmp.name
        
        # Process PDF
        graph_data = process_pdf(temp_path)
        
        return graph_data
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")
    finally:
        # Clean up temp file
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
