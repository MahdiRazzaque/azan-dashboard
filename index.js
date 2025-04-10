import { app, initialiseServer } from './src/server/server.js';

// Hardcoded port with explicit comment about configuration source
const PORT = 3002; // Centrally configured here (not in MongoDB or .env)

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