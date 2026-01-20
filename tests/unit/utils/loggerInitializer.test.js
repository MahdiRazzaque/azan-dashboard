const initLogger = require('@utils/loggerInitializer');
const sseService = require('@services/system/sseService');

jest.mock('@services/system/sseService', () => ({
    log: jest.fn()
}));

describe('Logger Initializer', () => {
    let originalLog, originalError, originalWarn;

    beforeEach(() => {
        originalLog = console.log;
        originalError = console.error;
        originalWarn = console.warn;
    });

    afterEach(() => {
        console.log = originalLog;
        console.error = originalError;
        console.warn = originalWarn;
        jest.clearAllMocks();
    });

    test('should wrap console.log and call sseService', () => {
        const spy = jest.fn();
        console.log = spy;

        initLogger();

        console.log('test message');
        expect(sseService.log).toHaveBeenCalledWith('test message', 'info');
        expect(spy).toHaveBeenCalledWith('test message');
    });

    test('should handle objects in console.log', () => {
        const spy = jest.fn();
        console.log = spy;

        initLogger();

        const obj = { key: 'value' };
        console.log('Obj:', obj);
        
        expect(sseService.log).toHaveBeenCalledWith('Obj: {"key":"value"}', 'info');
        expect(spy).toHaveBeenCalledWith('Obj:', obj);
    });

    test('should wrap console.error', () => {
        const spy = jest.fn();
        console.error = spy;
        
        initLogger();
        
        console.error('error msg');
        expect(sseService.log).toHaveBeenCalledWith('error msg', 'error');
        expect(spy).toHaveBeenCalledWith('error msg');
    });

    test('should wrap console.warn', () => {
        const spy = jest.fn();
        console.warn = spy;
        
        initLogger();
        
        console.warn('warn msg');
        expect(sseService.log).toHaveBeenCalledWith('warn msg', 'warn');
        expect(spy).toHaveBeenCalledWith('warn msg');
    });
});
