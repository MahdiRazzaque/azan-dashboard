import { initializeServer } from './src/server/server.js';

// Start the server
initializeServer().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
});