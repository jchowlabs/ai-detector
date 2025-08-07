# main.py
import os
import tempfile
import asyncio
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from dotenv import load_dotenv
from realitydefender import RealityDefender
import nest_asyncio

# Enable nested event loops
nest_asyncio.apply()

# Load environment variables
load_dotenv()

app = FastAPI(title="AI Detector",)

# Mount static files
app.mount("/static", StaticFiles(directory="."), name="static")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Reality Defender API configuration
API_KEY = os.getenv("API_KEY")

@app.get("/", response_class=HTMLResponse)
async def home():
    """Serve the main HTML page"""
    with open("index.html", "r") as f:
        return f.read()

@app.post("/analyze")
async def analyze_image(file: UploadFile = File(...)):
    """
    Analyze media file using Reality Defender API
    Supports images, videos, audio files, and text documents
    """
    try:
        # Validate file type and size
        file_extension = os.path.splitext(file.filename)[1].lower()
        content_type = file.content_type
        
        # Define allowed types and size limits
        allowed_extensions = {
            'image': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
            'video': ['.mp4', '.mov'],
            'audio': ['.flac', '.wav', '.mp3', '.m4a', '.aac', '.alac', '.ogg']
        }
        
        size_limits = {
            'image': 50 * 1024 * 1024,  # 50MB
            'video': 250 * 1024 * 1024,  # 250MB
            'audio': 20 * 1024 * 1024,  # 20MB
        }
        
        # Determine file type
        file_type = None
        for ftype, extensions in allowed_extensions.items():
            if file_extension in extensions:
                file_type = ftype
                break
        
        if not file_type:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {file_extension}")
        
        # Check file size
        file.file.seek(0, 2)  # Seek to end
        file_size = file.file.tell()
        file.file.seek(0)  # Reset to beginning
        
        if file_size > size_limits[file_type]:
            max_size_mb = size_limits[file_type] / (1024 * 1024)
            raise HTTPException(status_code=400, detail=f"File size exceeds {max_size_mb}MB limit for {file_type} files")
        
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_file_path = tmp_file.name
        
        try:
            # Initialize Reality Defender client
            rd = RealityDefender(api_key=API_KEY)
            
            # Upload the file and get request ID
            response = await rd.upload(file_path=tmp_file_path)
            request_id = response["request_id"]
            
            # Get results (this polls automatically)
            result = await rd.get_result(request_id)
            
            # Clean up the client
            await rd.cleanup()
            
            # Return simplified result
            return {
                "status": result.get("status", "unknown"),
                "score": result.get("score", 0),
                "models": [
                    {
                        "name": model.get("name", "Unknown Model"),
                        "status": model.get("status", "unknown"),
                        "score": model.get("score", 0)
                    }
                    for model in result.get("models", [])
                ],
                "media_id": response.get("media_id", ""),
                "request_id": request_id,
                "file_type": file_type
            }
            
        finally:
            # Clean up temporary file
            os.unlink(tmp_file_path)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    # Run the app
    uvicorn.run(app, host="127.0.0.1", port=5000)