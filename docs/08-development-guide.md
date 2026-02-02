# 8. Development Guide

This guide is for developers who wish to extend the Azan Dashboard or contribute to the codebase.

## Development Workflow

### Coding Standards
*   **Linting:** ESLint is enforced for both the Backend (Node.js) and Frontend (React). Please ensure all code passes linting rules before committing.
    *   **Backend:** Run `npm run lint` in the root directory.
    *   **Frontend:** Run `npm run lint` in the `client/` directory.
*   **Imports:** Use CommonJS (`require`) for the backend (Node.js compatibility) and ES Modules (`import`) for the frontend (Vite/React).
*   **Path Aliases:** Use path aliases for cleaner imports:
    *   **Backend:** `@adapters`, `@services`, `@config`, `@utils`.
    *   **Frontend:** `@/` (points to `client/src/`).
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
*   **Helpers:** Use `tests/helpers/mockFactory.js` to generate standardised mocks for services and config.
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

## Extending Prayer Providers

The dashboard supports a discovery-driven provider architecture. To add a new prayer time source:

1.  **Create a Provider Class:** In `src/providers/`, create a new class extending `BaseProvider`.
2.  **Implement `getAnnualTimes(year)`:** Calculate or fetch prayer times.
3.  **Implement `static getMetadata()`:** Return a JSON schema describing the provider's capabilities and parameters.
    ```javascript
    static getMetadata() {
        return {
            id: 'my-new-provider',
            label: 'My New Provider',
            description: 'Short description for UI',
            requiresCoordinates: true, // Show provider parameters requiring coordinates
            parameters: [
                {
                    key: 'apiKey',
                    type: 'password', // text, number, select, password
                    label: 'API Key',
                    sensitive: true, // Will be stripped from local.json
                    constraints: { required: true }
                }
            ]
        };
    }
    ```
4.  **Register in `ProviderFactory.js`:** 
    - Add to the `create()` method's switch statement.
    - Add to the `getRegisteredProviders()` return array.

The frontend will automatically discover the new provider and render the appropriate configuration fields via the `SourceConfigurator` and `DynamicField` components.

## Adding an Output Integration

The system uses a polymorphic **Strategy Pattern** to handle audio outputs. To add a new integration (e.g., MQTT, Home Assistant):

1.  **Create Strategy Class:** In `src/outputs/`, extend `BaseOutput`.
    ```javascript
    const BaseOutput = require('./BaseOutput');
    const OutputFactory = require('./OutputFactory');

    class MyOutput extends BaseOutput {
        static getMetadata() {
            return {
                id: 'myoutput', // Unique ID
                label: 'My Integration', // UI Label
                timeoutMs: 5000,
                params: [
                    { key: 'brokerUrl', type: 'string', label: 'Broker URL', sensitive: false },
                    { key: 'apiKey', type: 'string', label: 'API Key', sensitive: true }
                ]
            };
        }

        async execute(payload, metadata) {
            // Implement execution logic (e.g., network request)
            // payload contains { prayer, event, source: { url, filePath } }
        }
        
        async healthCheck(requestedParams) {
            // Implement connectivity check
            return { healthy: true, message: 'Connected' };
        }

        async verifyCredentials(credentials) {
            // Verify specific credentials (optional)
            return { success: true };
        }

        async validateAsset(filePath, metadata) {
            // Implement format validation logic (optional, defaults to valid)
            return { valid: true, lastChecked: new Date().toISOString(), issues: [] };
        }
    }
    
    // Auto-register
    OutputFactory.register(MyOutput);
    module.exports = MyOutput;
    ```
2.  **Register:** Add `require('./MyOutput')` to `src/outputs/index.js`.
3.  **UI Discovery:** The frontend automatically renders configuration cards based on `getMetadata()`. No frontend code changes are required.

## Known Issues & Limitations
*   **Audio Hardware on Docker Desktop:** As noted in deployment, mapping `/dev/snd` relies on Linux ALSA. Windows/Mac users cannot use the "Local" target effectively in Docker.
*   **VoiceMonkey Latency:** Alexa announcements depend on VoiceMonkey's cloud API, which can introduce a 1-3 second delay.
*   **Storage Quota:** The virtual quota system relies on recursive directory scanning, which may be slow if thousands of files are uploaded (though unlikely in this use case).
*   **MyMasjid Year Boundary:** Unlike the Aladhan source (which supports querying specific years), MyMasjid data is fetched relative to the current system year. Consequently, on **December 31st after Isha**, the system cannot look ahead to January 1st until the server clock actually passes midnight. The "Next Prayer" countdown will temporarily disappear during this window and automatically reappear at 00:00.

## Future Improvements
*   **Multi-User Support:** Currently, there is only one Admin account. Future updates could add "View Only" users.
*   **MQTT Integration:** Support for triggering generic MQTT topics for broader smart home integration (Home Assistant).
*   **PWA Support:** Turning the frontend into a Progressive Web App for better offline resilience on tablets.

## Contributing
1.  Fork the repository.
2.  Create a feature branch.
3.  Ensure code passes linting (`npm run lint`) and tests (`npm test`).
4.  Submit a Pull Request with a clear description of the change.
