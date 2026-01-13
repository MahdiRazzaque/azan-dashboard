const sseService = require('../services/sseService');

const initLogger = () => {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console.log = function(...args) {
        const message = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
        
        // Broadcast to SSE
        sseService.log(message, 'info');
        
        // Original behavior
        originalLog.apply(console, args);
    };

    console.error = function(...args) {
        const message = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
        
        sseService.log(message, 'error');
        originalError.apply(console, args);
    };

    console.warn = function(...args) {
        const message = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
        
        sseService.log(message, 'warn');
        originalWarn.apply(console, args);
    };
};

module.exports = initLogger;
