import edge_tts
import uuid
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import subprocess
import os
import asyncio
import sys

app = FastAPI()

# Calculate directories relative to this file
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.abspath(os.path.join(BASE_DIR, "../../../public/audio"))
CACHE_DIR = os.path.join(PUBLIC_DIR, "cache")
TEMP_DIR = os.path.join(PUBLIC_DIR, "temp")

# Ensure directories exist
for d in [CACHE_DIR, TEMP_DIR]:
    if not os.path.exists(d):
        os.makedirs(d)

class TTSRequest(BaseModel):
    text: str
    voice: str = "ar-DZ-IsmaelNeural"
    filename: str

class PreviewRequest(BaseModel):
    text: str
    voice: str
    filename: str | None = None  # Optional: If provided, use this instead of generating UUID

async def _get_edge_tts_path():
    """Helper to find edge-tts executable path"""
    python_dir = os.path.dirname(sys.executable)
    edge_tts_path = os.path.join(python_dir, "edge-tts")
    
    if os.name == 'nt' and not edge_tts_path.endswith('.exe'):
        edge_tts_path += ".exe"
    
    if os.path.exists(edge_tts_path):
        return edge_tts_path
    
    return "edge-tts"

@app.get("/voices")
async def get_voices():
    """FR-01: Return list of available edge-tts voices"""
    try:
        voices = await edge_tts.list_voices()
        # edge-tts list_voices returns a list of dictionaries in latest versions
        # We ensure they contain the keys expected by the frontend
        return voices
    except Exception as e:
        print(f"[TTS Service] Error listing voices: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/preview-tts")
async def preview_tts(request: PreviewRequest):
    """FR-02: Generate temporary preview audio with optional deterministic filename"""
    filename = request.filename if request.filename else f"preview_{uuid.uuid4().hex}.mp3"
    filepath = os.path.join(TEMP_DIR, filename)
    
    edge_tts_path = await _get_edge_tts_path()
    
    cmd = [
        edge_tts_path,
        "--text", request.text,
        "--write-media", filepath,
        "--voice", request.voice
    ]
    
    print(f"[TTS Service] Generating Preview: {request.text} with voice {request.voice}")
    
    try:
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        _, stderr = await process.communicate()
        
        if process.returncode != 0:
            error_msg = stderr.decode()
            print(f"Error: {error_msg}")
            raise Exception(f"edge-tts failed: {error_msg}")
            
        return {
            "status": "success", 
            "url": f"/public/audio/temp/{filename}"
        }
        
    except Exception as e:
        print(f"[TTS Service] Preview generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate-tts")
async def generate_tts(request: TTSRequest):
    filepath = os.path.join(CACHE_DIR, request.filename)
    edge_tts_path = await _get_edge_tts_path()

    cmd = [
        edge_tts_path,
        "--text", request.text,
        "--write-media", filepath,
        "--voice", request.voice
    ]
    
    print(f"[TTS Service] Generating TTS: {request.text} with voice {request.voice}")
    
    try:
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        _, stderr = await process.communicate()
        
        if process.returncode != 0:
            error_msg = stderr.decode()
            print(f"Error: {error_msg}")
            raise Exception(f"edge-tts failed: {error_msg}")
            
        return {
            "status": "success", 
            "filepath": filepath,
            "url": f"/public/audio/cache/{request.filename}"
        }
        
    except Exception as e:
        print(f"[TTS Service] TTS generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # Use port 8000 as per PRD
    uvicorn.run(app, host="0.0.0.0", port=8000)
