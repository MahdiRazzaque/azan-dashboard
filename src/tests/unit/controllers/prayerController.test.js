const prayerController = require('@controllers/prayerController');
const configService = require('@config');
const { getPrayersWithNext } = require('@services/core/prayerTimeService');

jest.mock('@config');
jest.mock('@services/core/prayerTimeService');

describe('prayerController Unit Tests', () => {
    let req, res;

    beforeEach(() => {
        req = {};
        res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };
        jest.clearAllMocks();
    });

    describe('getPrayers', () => {
        it('should return prayer times successfully', async () => {
            const mockConfig = { location: { timezone: 'UTC' } };
            configService.get.mockReturnValue(mockConfig);
            
            const mockResult = { prayers: { fajr: '05:00' }, next: { name: 'fajr' } };
            getPrayersWithNext.mockResolvedValue(mockResult);

            await prayerController.getPrayers(req, res);

            expect(configService.get).toHaveBeenCalled();
            expect(getPrayersWithNext).toHaveBeenCalledWith(mockConfig, 'UTC');
            expect(res.json).toHaveBeenCalledWith(mockResult);
        });

        it('should handle errors and return 500', async () => {
            const mockConfig = { location: { timezone: 'UTC' } };
            configService.get.mockReturnValue(mockConfig);
            
            const error = new Error('Test Error');
            getPrayersWithNext.mockRejectedValue(error);
            
            // Suppress console.error
            const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

            await prayerController.getPrayers(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Internal Server Error',
                message: 'Failed to retrieve prayer times. Please check logs.'
            });
            
            spy.mockRestore();
        });
    });
});
