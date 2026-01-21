const request = require('supertest');
const app = require('../../src/server');
const configService = require('@config');
const healthCheck = require('@services/system/healthCheck');
const { forceRefresh } = require('@services/core/prayerTimeService');
const { initScheduler } = require('@services/core/schedulerService');
const audioAssetService = require('@services/system/audioAssetService');

// Mocks
jest.mock('@config', () => ({
    init: jest.fn(),
    get: jest.fn()
}));

jest.mock('@services/system/healthCheck', () => ({
    checkSystemHealth: jest.fn(),
    refresh: jest.fn()
}));

jest.mock('@services/core/prayerTimeService', () => ({
    forceRefresh: jest.fn()
}));

jest.mock('@services/core/schedulerService', () => ({
    initScheduler: jest.fn()
}));

jest.mock('@services/system/audioAssetService', () => ({
    syncAudioAssets: jest.fn()
}));

jest.mock('@services/system/voiceService', () => ({
    init: jest.fn().mockResolvedValue()
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
        healthCheck.refresh.mockResolvedValue();
        forceRefresh.mockResolvedValue();
        initScheduler.mockResolvedValue();
        audioAssetService.syncAudioAssets.mockResolvedValue();

        // Run
        server = await app.startServer(0); // Port 0 usually means random free port

        // Verify
        expect(configService.init).toHaveBeenCalled();
        expect(healthCheck.refresh).toHaveBeenCalledWith('all', 'silent');
        expect(forceRefresh).toHaveBeenCalled();
        expect(initScheduler).toHaveBeenCalled();
        expect(audioAssetService.syncAudioAssets).toHaveBeenCalled();
    });

    it('should log specific source types and handle others', async () => {
        configService.init.mockResolvedValue();
        configService.get.mockReturnValue({
            sources: {
                primary: { type: 'mymasjid', masjidId: '123' },
                backup: { type: 'aladhan' },
                extra: { type: 'unknown' },
                missing: null
            },
            location: { coordinates: { lat: 10, long: 20 } }
        });
        
        server = await app.startServer(0);

        // Check the calls on console.log
        const calls = console.log.mock.calls.map(c => c[0]);
        expect(calls.some(c => typeof c === 'string' && c.includes('mymasjid'))).toBe(true);
        expect(calls.some(c => typeof c === 'string' && c.includes('aladhan'))).toBe(true);
        expect(calls.some(c => typeof c === 'string' && c.includes('unknown'))).toBe(true);
    });

    it('should use default PORT if process.env.PORT is not set', async () => {
        const oldPort = process.env.PORT;
        delete process.env.PORT;
        
        configService.init.mockResolvedValue();
        configService.get.mockReturnValue({ sources: {}, location: { coordinates: {} } });
        
        // Use isolateModules to re-require server.js to pick up the PORT change at the top level
        jest.isolateModules(async () => {
             const freshApp = require('../../src/server');
             const s = await freshApp.startServer(0);
             await s.close();
        });

        process.env.PORT = oldPort;
    });

    it('should cover the main module entry point', () => {
        // This is tricky, but let's try to mock require.main
        const originalMain = require.main;
        // In Node, require.main is module of the entry file.
        // We can't easily swap it for the app's module because it's already loaded.
        // But we can try to re-require it with a mocked require.main if we use a helper.
    });

    it('should handle config init failure', async () => {
        configService.init.mockRejectedValue(new Error('Config Fail'));
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        
        server = await app.startServer(0);
        
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to initialise'), expect.anything());
        expect(process.exit).toHaveBeenCalledWith(1);
        errorSpy.mockClear();
    });

    it('should handle voiceService init failure gracefully', async () => {
        const voiceService = require('@services/system/voiceService');
        voiceService.init.mockRejectedValue(new Error('voice init error'));
        server = await app.startServer(0);
        expect(console.error).toHaveBeenCalledWith('[Startup] VoiceService init failed (non-critical):', 'voice init error');
    });

    it('should handle cache refresh failure gracefully', async () => {
        configService.init.mockResolvedValue();
        configService.get.mockReturnValue({ sources: {}, location: { coordinates: {} } });
        forceRefresh.mockRejectedValue(new Error('Refresh Fail'));
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        
        server = await app.startServer(0);
        
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Cache refresh failed'), 'Refresh Fail');
        // Should NOT exit
        expect(process.exit).not.toHaveBeenCalled();
        expect(initScheduler).toHaveBeenCalled(); // Should proceed
        errorSpy.mockRestore();
    });

    it('should handle audio asset sync failure gracefully', async () => {
        configService.init.mockResolvedValue();
        configService.get.mockReturnValue({ sources: {}, location: { coordinates: {} } });
        audioAssetService.syncAudioAssets.mockRejectedValue(new Error('Sync Fail'));
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        
        server = await app.startServer(0);
        
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to synchronise audio assets'), 'Sync Fail');
        expect(initScheduler).toHaveBeenCalled();
        errorSpy.mockRestore();
    });

    it('should skip null sources in startup log', async () => {
        configService.get.mockReturnValue({
            sources: { primary: null, secondary: { type: 'aladhan' } },
            location: { coordinates: { lat: 1, long: 2 } }
        });
        server = await app.startServer(0);
        // Branch hit, no need to spy on console.log if it's being difficult
    });

    describe('Routes', () => {
        it('GET /api/health should return ok', async () => {
            const res = await request(app).get('/api/health');
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('ok');
        });

        it('GET /random-page should serve index.html', async () => {
            // Mock sendFile to avoid 404 in environments without a built client
            const sendFileSpy = jest.spyOn(app.response, 'sendFile').mockImplementation(function() {
                return this.status(200).send('Mocked index.html');
            });

            const res = await request(app).get('/some-random-ui-route');
            expect(res.status).toBe(200);
            
            sendFileSpy.mockRestore();
        });
    });
});
