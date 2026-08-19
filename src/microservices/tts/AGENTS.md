# TTS Microservice

Python FastAPI service for text-to-speech generation using Microsoft Edge TTS (`edge-tts` library). Runs as a separate process managed by supervisord in Docker, or manually via `npm run tts:start` in development.

## FILES

| File                   | Role                                                   |
| ---------------------- | ------------------------------------------------------ |
| `server.py`            | FastAPI application — 3 endpoints                      |
| `requirements.txt`     | Python dependencies (`fastapi`, `uvicorn`, `edge-tts`) |
| `test_sanitisation.py` | Path traversal sanitization tests                      |
| `test_security.py`     | Security-focused tests                                 |
| `venv/`                | Python virtual environment (gitignored)                |

## ENDPOINTS

| Method | Path            | Purpose                      | Returns                                          |
| ------ | --------------- | ---------------------------- | ------------------------------------------------ |
| `GET`  | `/voices`       | List available TTS voices    | JSON array of voice objects                      |
| `POST` | `/generate-tts` | Generate audio file to cache | Writes to `PUBLIC_DIR/cache/`, returns file path |
| `POST` | `/preview-tts`  | Generate temporary preview   | Writes to `PUBLIC_DIR/temp/`, returns file path  |

## REQUEST MODELS

```python
class TTSRequest:
    text: str        # Text to speak
    voice: str       # Voice ID (e.g., "en-US-JennyNeural")
    filename: str    # Output filename

class PreviewRequest:
    text: str        # Text to speak
    voice: str       # Voice ID
```

## DIRECTORY CONSTANTS

| Constant     | Path                  | Purpose                              |
| ------------ | --------------------- | ------------------------------------ |
| `PUBLIC_DIR` | `../../public/audio/` | Served audio files                   |
| `CACHE_DIR`  | `PUBLIC_DIR/cache/`   | Generated TTS files                  |
| `TEMP_DIR`   | `PUBLIC_DIR/temp/`    | Preview files (cleaned periodically) |

## SECURITY

- **Path traversal protection** — `os.path.basename()` strips directory components from filenames.
- **No auth** — Internal service only, not exposed externally. Accessible only from Node backend.

## DEPLOYMENT

| Mode        | How                                                                                |
| ----------- | ---------------------------------------------------------------------------------- |
| Docker      | Supervisord runs `uvicorn server:app --host 0.0.0.0 --port 8000`                   |
| Development | `npm run tts:start` or manual `uvicorn server:app --port 8000` from this directory |

## CONVENTIONS

- **Node backend is the only consumer** — `audioAssetService.js` calls this service via HTTP.
- **edge-tts library** — Microsoft Edge's TTS engine. Free, no API key required.
- **File output only** — Service writes audio to disk, returns file path. Node serves the files via Express static.

## EDITING THIS SERVICE

- Changes here require restarting the Python process (supervisord will auto-restart in Docker).
- Test path sanitization: `python -m pytest test_sanitisation.py`.
- Test security: `python -m pytest test_security.py`.
- Dependencies: `pip install -r requirements.txt` (use venv).
