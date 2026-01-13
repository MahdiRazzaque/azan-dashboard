const sseService = require('../../src/services/sseService');
const config = require('../../src/config');
const path = require('path');

// Mock play-sound factory
const mockPlay = jest.fn((file, opts, cb) => {
    let callback = cb;
    if (typeof opts === 'function') callback = opts;
    
    if (callback) callback(null);
    return { kill: jest.fn() };
});
const mockPlayerFactory = jest.fn(() => ({
    play: mockPlay
}));

jest.mock('play-sound', () => mockPlayerFactory);

// Mock sseService
jest.mock('../../src/services/sseService', () => ({
    broadcast: jest.fn(),
    addClient: jest.fn()
}));

// Require service under test AFTER mocks
const automationService = require('../../src/services/automationService');

describe('Automation Flow Integration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Correct Config Structure based on actual implementation
        config.automation = {
            triggers: {
                fajr: {
                    azan: {
                        enabled: true,
                        type: 'file',
                        path: 'azan.mp3',
                        targets: ['browser', 'local']
                    }
                }
            }
        };
    });

    test('Triggering an event executes Browser and Local targets', async () => {
        const prayer = 'fajr';
        const event = 'azan';

        await automationService.triggerEvent(prayer, event);

        // Verify Browser Target (SSE)
        expect(sseService.broadcast).toHaveBeenCalledWith(expect.objectContaining({
            type: 'AUDIO_PLAY',
            payload: expect.objectContaining({
                url: expect.stringContaining('/audio/') 
            })
        }));

        // Verify Local Target
        expect(mockPlay).toHaveBeenCalled();
        const callArgs = mockPlay.mock.calls[0];
        // Ensure some path was passed
        expect(callArgs[0]).toMatch(/audio/);
    });
});
