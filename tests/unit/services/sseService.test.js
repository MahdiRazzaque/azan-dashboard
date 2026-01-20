const mockRes = {
    writeHead: jest.fn(),
    write: jest.fn(),
    on: jest.fn(),
};

describe('SSE Service', () => {
    let sseService;
    let res;

    beforeEach(() => {
        jest.resetModules();
        sseService = require('@services/system/sseService');
        res = { ...mockRes, write: jest.fn(), on: jest.fn() };
    });

    it('should add client and send headers', () => {
        sseService.addClient(res);
        expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
        expect(res.write).toHaveBeenCalledWith(expect.stringContaining('retry'));
    });

    it('should broadcast data to clients', () => {
        sseService.addClient(res);
        sseService.broadcast({ type: 'TEST' });
        expect(res.write).toHaveBeenCalledWith(expect.stringContaining('"type":"TEST"'));
    });

    it('should log messages and add to history', () => {
        sseService.log('test-msg', 'error');
        
        // New client should receive history
        const newRes = { ...mockRes, write: jest.fn(), on: jest.fn() };
        sseService.addClient(newRes);
        
        expect(newRes.write).toHaveBeenCalledWith(expect.stringContaining('test-msg'));
    });

    it('should handle client disconnect', () => {
        sseService.addClient(res);
        
        // Find close handler
        const closeHandler = res.on.mock.calls.find(call => call[0] === 'close')[1];
        
        // Simulate disconnect
        closeHandler();
        
        // Broadcast
        res.write.mockClear();
        sseService.broadcast({ type: 'TEST' });
        
        expect(res.write).not.toHaveBeenCalled();
    });

    describe('Edge Cases', () => {
        beforeEach(() => {
            jest.useFakeTimers();
            jest.resetModules();
            sseService = require('@services/system/sseService');
            res = { ...mockRes, write: jest.fn(), on: jest.fn() };
        });
        afterEach(() => {
            jest.useRealTimers();
        });

        it('should send heartbeats periodically', () => {
             sseService.addClient(res);
             res.write.mockClear();
             
             jest.advanceTimersByTime(30000);
             
             expect(res.write).toHaveBeenCalledWith(': heartbeat\n\n');
        });

        it('should cycle log history when full', () => {
            // MAX_HISTORY is 200
            for (let i = 0; i < 205; i++) {
                sseService.log(`msg-${i}`);
            }
            
            const newRes = { ...mockRes, write: jest.fn(), on: jest.fn() };
            sseService.addClient(newRes);
            
            const dataCalls = newRes.write.mock.calls.filter(args => args[0] && args[0].startsWith('data:'));
            expect(dataCalls.length).toBe(200);
            
            expect(JSON.stringify(dataCalls)).not.toContain('msg-0');
            expect(JSON.stringify(dataCalls)).toContain('msg-204');
        });
    });
});
