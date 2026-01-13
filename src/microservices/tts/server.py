from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import subprocess
import os
import asyncio
import sys

app = FastAPI()

# Calculate cache directory relative to this file
# src/microservices/tts/server.py -> ../../../public/audio/cache
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CACHE_DIR = os.path.abspath(os.path.join(BASE_DIR, "../../../public/audio/cache"))

if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR)

class TTSRequest(BaseModel):
    text: str
    voice: str = "ar-DZ-IsmaelNeural"
    filename: str

@app.post("/generate-tts")
async def generate_tts(request: TTSRequest):
    filepath = os.path.join(CACHE_DIR, request.filename)
    
    # Try to find edge-tts executable relative to the running python interpreter
    # This ensures we use the one installed in the same venv
    python_dir = os.path.dirname(sys.executable)
    edge_tts_path = os.path.join(python_dir, "edge-tts")
    
    if os.name == 'nt' and not edge_tts_path.endswith('.exe'):
        edge_tts_path += ".exe"
    
    # If not found specifically there, fallback to PATH lookup "edge-tts"
    if not os.path.exists(edge_tts_path):
        edge_tts_path = "edge-tts"

    cmd = [
        edge_tts_path,
        "--text", request.text,
        "--write-media", filepath,
        "--voice", request.voice
    ]
    
    #print(f"Executing: {' '.join(cmd)}")
    print(f"[TTS Service] Generating TTS: {request.text} with voice {request.voice}")
    
    try:
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        
        if process.returncode != 0:
            error_msg = stderr.decode()
            print(f"Error: {error_msg}")
            raise Exception(f"edge-tts failed: {error_msg}")
            
        return {
            "status": "success", 
            "filepath": filepath,
            "url": f"/audio/cache/{request.filename}" # Hint for frontend usage
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # Use port 8000 as per PRD
    uvicorn.run(app, host="0.0.0.0", port=8000)
