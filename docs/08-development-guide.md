# 8. Development Guide

This guide is for developers who wish to extend the Azan Dashboard or contribute to the codebase.

## Development Workflow

### Project Standards
*   **Imports:** Use CommonJS (`require`) for the backend (Node.js compatibility) and ES Modules (`import`) for the frontend (Vite/React).
*   **State Management:** The backend uses a Singleton pattern for Configuration management (`ConfigService`). The frontend relies on React Context (`SettingsContext`) to maintain a "draft" state before saving.

### Branching Strategy
*   **`main`:** Stable, production-ready code.
*   **`develop`:** Integration branch for new features.
*   **`feature/xyz`:** Individual feature branches.

## Testing Strategy

The project aims for **>90% Code Coverage** on the backend logic.

### 1. Unit Tests (`tests/unit/`)
*   **Scope:** Services (`prayerTimeService`, `schedulerService`), Utils (`calculations`, `auth`), and Configuration logic.
*   **Mocking:** All external dependencies (File System, Network requests, System Time) MUST be mocked using Jest.
*   **Command:** `npm run test`

### 2. Integration Tests (`tests/integration/`)
*   **Scope:** API Routes. Uses `supertest` to fire requests against a running Express instance.
*   **Environment:** Uses a temporary directory for config/data files to avoid messing up your local setup.

### 3. Coverage Report
To generate a coverage report:
```bash
npm run test:coverage
```
Open `coverage/lcov-report/index.html` to view the detailed breakdown.

## Known Issues & Limitations
*   **Audio Hardware on Docker Desktop:** As noted in deployment, mapping `/dev/snd` relies on Linux ALSA. Windows/Mac users cannot use the "Local" target effectively in Docker.
*   **VoiceMonkey Latency:** Alexa announcements depend on VoiceMonkey's cloud API, which can introduce a 1-3 second delay.
*   **Storage Quota:** The virtual quota system relies on recursive directory scanning, which may be slow if thousands of files are uploaded (though unlikely in this use case).

## Future Improvements
*   **Multi-User Support:** Currently, there is only one Admin account. Future updates could add "View Only" users.
*   **MQTT Integration:** Support for triggering generic MQTT topics for broader smart home integration (Home Assistant).
*   **PWA Support:** Turning the frontend into a Progressive Web App for better offline resilience on tablets.

## Contributing
1.  Fork the repository.
2.  Create a feature branch.
3.  Ensure all tests pass (`npm test`).
4.  Submit a Pull Request with a clear description of the change.