const app = require('../../src/server');
const configService = require('../../src/config');
const { checkSystemHealth } = require('../../src/services/healthCheck');
const { forceRefresh } = require('../../src/services/prayerTimeService');
const { initScheduler } = require('../../src/services/schedulerService');

// Mocks
jest.mock('../../src/config', () => ({
    init: jest.fn(),
    get: jest.fn()
}));

jest.mock('../../src/services/healthCheck', () => ({
    checkSystemHealth: jest.fn()
}));

jest.mock('../../src/services/prayerTimeService', () => ({
    forceRefresh: jest.fn()
}));

jest.mock('../../src/services/schedulerService', () => ({
    initScheduler: jest.fn()
}));

describe('Server Startup', () => {
    let server;
    
    beforeAll(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(process, 'exit').mockImplementation(() => {});
    });

    afterEach(async () => {
        if (server) await server.close();
        jest.clearAllMocks();
    });

    it('should start server and initialize services', async () => {
        // Setup mocks
        configService.init.mockResolvedValue();
        configService.get.mockReturnValue({
            sources: {
                primary: { type: 'aladhan' },
                backup: { type: 'calculational' }
            },
            location: { coordinates: { lat: 0, long: 0 } }
        });
        checkSystemHealth.mockResolvedValue();
        forceRefresh.mockResolvedValue();
        initScheduler.mockResolvedValue();

        // Run
        server = await app.startServer(0); // Port 0 usually means random free port

        // Verify
        expect(configService.init).toHaveBeenCalled();
        expect(checkSystemHealth).toHaveBeenCalled();
        expect(forceRefresh).toHaveBeenCalled();
        expect(initScheduler).toHaveBeenCalled();
    });

    it('should log specific source types', async () => {
        configService.init.mockResolvedValue();
        configService.get.mockReturnValue({
            sources: {
                primary: { type: 'mymasjid', masjidId: '123' },
                backup: { type: 'aladhan' } // Will trigger the aladhan case
            },
            location: { coordinates: { lat: 10, long: 20 } }
        });
        
        server = await app.startServer(0);

        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('mymasjid'));
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('aladhan'));
    });

    it('should handle config init failure', async () => {
        configService.init.mockRejectedValue(new Error('Config Fail'));
        
        server = await app.startServer(0);
        
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Failed to initialize'), expect.anything());
        expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle cache refresh failure gracefully', async () => {
        configService.init.mockResolvedValue();
        configService.get.mockReturnValue({ sources: {}, location: { coordinates: {} } });
        forceRefresh.mockRejectedValue(new Error('Refresh Fail'));
        
        server = await app.startServer(0);
        
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Cache refresh failed'), 'Refresh Fail');
        // Should NOT exit
        expect(process.exit).not.toHaveBeenCalled();
        expect(initScheduler).toHaveBeenCalled(); // Should proceed
    });
});
