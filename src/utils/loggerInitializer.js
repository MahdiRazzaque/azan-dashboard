const sseService = require('@services/system/sseService');

/**
 * Initialises the global logger by overriding standard console methods.
 * Captures console output and broadcasts it via the SSE service while 
 * maintaining the original console functionality.
 * 
 * @returns {void}
 */
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
