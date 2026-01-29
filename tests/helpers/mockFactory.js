/**
 * Centralised Mock Factory for Azan Dashboard Tests
 */

const createMockConfig = (overrides = {}) => ({
    sources: { 
        primary: { type: 'aladhan', method: 2, madhab: 1 }, 
        backup: { type: 'mymasjid', masjidId: '94f1c71b-7f8a-4b9a-9e1d-3b5f6a7b8c9d' } 
    },
    location: { 
        coordinates: { lat: 51.5, long: -0.1 },
        timezone: 'Europe/London'
    },
    timings: {
        fajr: { angle: 18 },
        isha: { angle: 18 }
    },
    prayers: {
        fajr: {}, dhuhr: {}, asr: {}, maghrib: {}, isha: {}
    },
    automation: {
        baseUrl: 'http://localhost',
        pythonServiceUrl: 'http://localhost',
        outputs: {
            local: { enabled: true, leadTimeMs: 0 },
            voicemonkey: { enabled: false, leadTimeMs: 0, params: {} }
        },
        triggers: {
            fajr: { 
                preAdhan: { enabled: false, type: 'tts', targets: [] },
                adhan: { enabled: false, type: 'tts', targets: [] },
                preIqamah: { enabled: false, type: 'tts', targets: [] },
                iqamah: { enabled: false, type: 'tts', targets: [] }
            }
        }
    },
    ...overrides
});

const createMockConfigService = (config = createMockConfig()) => ({
    get: jest.fn(() => config),
    update: jest.fn().mockResolvedValue(),
    reload: jest.fn().mockResolvedValue(),
    init: jest.fn().mockResolvedValue()
});

const createMockSchedulerService = () => ({
    initScheduler: jest.fn().mockResolvedValue(),
    hotReload: jest.fn().mockResolvedValue(),
    getJobs: jest.fn(() => [
        { jobName: 'Test Job', nextInvocation: '2024-01-01T00:00:00.000Z' }
    ]),
    stopAll: jest.fn().mockResolvedValue()
});

const createMockPrayerTimeService = () => ({
    getPrayerTimes: jest.fn(),
    getPrayersWithNext: jest.fn(),
    forceRefresh: jest.fn(() => Promise.resolve({ meta: { success: true, timestamp: Date.now() } })),
    readCache: jest.fn(() => ({}))
});

const createMockAutomationService = () => ({
    getAudioSource: jest.fn(),
    handleLocal: jest.fn().mockResolvedValue(),
    handleVoiceMonkey: jest.fn().mockResolvedValue(),
    broadcastToClients: jest.fn().mockResolvedValue(),
    triggerEvents: jest.fn().mockResolvedValue()
});

const createMockSSEService = () => ({
    broadcast: jest.fn(),
    log: jest.fn(),
    addClient: jest.fn()
});

const createMockAudioAssetService = () => ({
    syncAudioAssets: jest.fn().mockResolvedValue({ warnings: [] }),
    resolveTemplate: jest.fn((t) => t),
    previewTTS: jest.fn().mockResolvedValue({ url: 'http://temp.mp3' })
});

const createMockHealthCheck = () => ({
    getHealth: jest.fn(() => ({ 
        tts: { healthy: true }, 
        local: { healthy: true }, 
        voicemonkey: { healthy: true } 
    })),
    refresh: jest.fn().mockResolvedValue(),
    checkSource: jest.fn(() => Promise.resolve({ healthy: true }))
});

const createMockDiagnosticsService = () => ({
    getAutomationStatus: jest.fn(() => Promise.resolve({ lastTrigger: 'never' })),
    getTTSStatus: jest.fn(() => Promise.resolve({ status: 'ok' }))
});

const createMockEnvManager = () => ({
    isConfigured: jest.fn(() => true),
    setEnvValue: jest.fn().mockResolvedValue(),
    deleteEnvValue: jest.fn().mockResolvedValue(),
    generateSecret: jest.fn(() => 'gen-secret'),
    getEnv: jest.fn(() => ({}))
});

const createMockAuthUtils = () => ({
    hashPassword: jest.fn(() => 'hashed'),
    verifyPassword: jest.fn(() => true) 
});

const createMockProvider = (results = {}) => ({
    getAnnualTimes: jest.fn().mockResolvedValue(results),
    deduplicateRequest: jest.fn((k, f) => f())
});

const createMockProviderFactory = (mockProvider = createMockProvider()) => ({
    create: jest.fn(() => mockProvider)
});

module.exports = {
    createMockConfig,
    createMockConfigService,
    createMockSchedulerService,
    createMockPrayerTimeService,
    createMockAutomationService,
    createMockSSEService,
    createMockAudioAssetService,
    createMockHealthCheck,
    createMockDiagnosticsService,
    createMockEnvManager,
    createMockAuthUtils,
    createMockProvider,
    createMockProviderFactory
};
