const fs = require('fs');
const service = require('@services/system/diagnosticsService');
const prayerTimeService = require('@services/core/prayerTimeService');
const { DateTime } = require('luxon');

jest.mock('fs', () => ({
    ...jest.requireActual('fs'),
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
    promises: {
        readFile: jest.fn(),
        access: jest.fn()
    }
}));
jest.mock('@services/core/prayerTimeService');

describe('Diagnostics Service (Async Refactor)', () => {
    const mockConfig = {
        location: { timezone: 'UTC' },
        automation: {
            triggers: {
                fajr: {
                    preAdhan: { enabled: true, type: 'tts', template: 'Test', offsetMinutes: 5 }
                }
            }
        }
    };

    it('should use fs.promises in getTTSStatus', async () => {
        fs.promises.access.mockResolvedValue(); // both files exist
        fs.promises.readFile.mockResolvedValue(JSON.stringify({
            text: 'Test',
            generatedAt: '2023-01-01T00:00:00Z'
        }));

        const result = await service.getTTSStatus(mockConfig);
        
        expect(fs.promises.readFile).toHaveBeenCalled();
        expect(result.fajr.preAdhan.status).toBe('GENERATED');
    });
});