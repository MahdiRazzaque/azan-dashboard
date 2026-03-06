const prayerController = require('@controllers/prayerController');
const configService = require('@config');
const { getPrayersWithNext, getPrayerCalendarWindow } = require('@services/core/prayerTimeService');

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
            const mockCalendar = { '2026-03-06': { fajr: { start: '2026-03-06T05:00:00Z', iqamah: '2026-03-06T05:30:00Z' } } };
            getPrayersWithNext.mockResolvedValue(mockResult);
            getPrayerCalendarWindow.mockResolvedValue(mockCalendar);

            await prayerController.getPrayers(req, res);

            expect(configService.get).toHaveBeenCalled();
            expect(getPrayersWithNext).toHaveBeenCalledWith(mockConfig, 'UTC', expect.any(Object));
            expect(getPrayerCalendarWindow).toHaveBeenCalledWith(mockConfig, 'UTC', {}, expect.any(Object));
            expect(res.json).toHaveBeenCalledWith({ ...mockResult, calendar: mockCalendar });
        });

        it('should forward a valid cursorDate and direction query to the calendar service', async () => {
            const mockConfig = { location: { timezone: 'UTC' } };
            configService.get.mockReturnValue(mockConfig);
            req = {
                query: {
                    cursorDate: '2026-03-13',
                    direction: 'future'
                }
            };

            const mockResult = { prayers: { fajr: '05:00' }, nextPrayer: { name: 'fajr' } };
            const mockCalendar = {
                '2026-03-14': { fajr: { start: '2026-03-14T05:00:00Z', iqamah: '2026-03-14T05:30:00Z' } }
            };
            getPrayersWithNext.mockResolvedValue(mockResult);
            getPrayerCalendarWindow.mockResolvedValue(mockCalendar);

            await prayerController.getPrayers(req, res);

            expect(getPrayerCalendarWindow).toHaveBeenCalledWith(mockConfig, 'UTC', {
                cursorDate: '2026-03-13',
                direction: 'future'
            }, expect.any(Object));
            expect(res.json).toHaveBeenCalledWith({ ...mockResult, calendar: mockCalendar });
        });

        it('should reject an invalid cursorDate query', async () => {
            req = {
                query: {
                    cursorDate: '13-03-2026',
                    direction: 'future'
                }
            };

            await prayerController.getPrayers(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Bad Request',
                message: 'Invalid prayer calendar query parameters.'
            });
            expect(getPrayersWithNext).not.toHaveBeenCalled();
            expect(getPrayerCalendarWindow).not.toHaveBeenCalled();
        });

        it('should reject a request that only includes direction without cursorDate', async () => {
            req = {
                query: {
                    direction: 'past'
                }
            };

            await prayerController.getPrayers(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Bad Request',
                message: 'Invalid prayer calendar query parameters.'
            });
            expect(getPrayersWithNext).not.toHaveBeenCalled();
            expect(getPrayerCalendarWindow).not.toHaveBeenCalled();
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
