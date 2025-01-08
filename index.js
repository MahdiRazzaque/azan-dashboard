import { app, initialiseServer } from './src/server/server.js';
import { appConfig } from './src/config/config-validator.js';

const PORT = appConfig.PORT || 3002;

// Start the server
async function startServer() {
    try {
        const initialised = await initialiseServer();
        if (!initialised) {
            console.error("Failed to initialise server");
            process.exit(1);
        }

        app.listen(PORT, () => {
            console.log(`🚀 Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Error starting server:", error);
        process.exit(1);
    }
}

startServer();