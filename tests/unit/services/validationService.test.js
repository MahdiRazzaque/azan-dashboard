const { validateConfigSource } = require('../../../src/services/validationService');
const fetchers = require('../../../src/services/fetchers');
const { DateTime } = require('luxon');

jest.mock('../../../src/services/fetchers');

describe('ValidationService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        console.log.mockRestore();
    });

    it('should return if no sources are provided', async () => {
        const config = { location: {} };
        await expect(validateConfigSource(config)).resolves.not.toThrow();
        expect(fetchers.fetchMyMasjidBulk).not.toHaveBeenCalled();
    });

    describe('Primary Source Validation', () => {
        it('should validate primary MyMasjid successfully', async () => {
            const config = {
                sources: { primary: { type: 'mymasjid', masjidId: '123' } }
            };
            fetchers.fetchMyMasjidBulk.mockResolvedValue({});
            await validateConfigSource(config);
            expect(fetchers.fetchMyMasjidBulk).toHaveBeenCalled();
        });

        it('should throw error if MyMasjid masjidId is missing', async () => {
            const config = {
                sources: { primary: { type: 'mymasjid' } }
            };
            await expect(validateConfigSource(config)).rejects.toThrow('Masjid ID is required');
        });

        it('should validate primary Aladhan successfully', async () => {
            const config = {
                sources: { primary: { type: 'aladhan' } },
                location: { coordinates: { lat: 51.5, long: 0.1 } }
            };
            fetchers.fetchAladhanAnnual.mockResolvedValue({});
            await validateConfigSource(config);
            expect(fetchers.fetchAladhanAnnual).toHaveBeenCalled();
        });

        it('should throw error if Aladhan coordinates are missing', async () => {
            const config = {
                sources: { primary: { type: 'aladhan' } },
                location: {}
            };
            await expect(validateConfigSource(config)).rejects.toThrow('Coordinates are required');
        });
        
        it('should throw error if coordinates object is missing entirely', async () => {
             const config = {
                 sources: { primary: { type: 'aladhan' } }
             };
             await expect(validateConfigSource(config)).rejects.toThrow('Coordinates are required');
        });
    });

    describe('Backup Source Validation', () => {
        it('should validate backup MyMasjid successfully if enabled', async () => {
            const config = {
                sources: {
                    primary: { type: 'aladhan' },
                    backup: { type: 'mymasjid', masjidId: '456', enabled: true }
                },
                location: { coordinates: { lat: 0, long: 0 } }
            };
            fetchers.fetchAladhanAnnual.mockResolvedValue({});
            fetchers.fetchMyMasjidBulk.mockResolvedValue({});
            
            await validateConfigSource(config);
            expect(fetchers.fetchAladhanAnnual).toHaveBeenCalled();
            expect(fetchers.fetchMyMasjidBulk).toHaveBeenCalled();
        });

        it('should skip backup validation if enabled is false', async () => {
             const config = {
                 sources: {
                     primary: { type: 'aladhan' },
                     backup: { type: 'mymasjid', masjidId: '456', enabled: false }
                 },
                 location: { coordinates: { lat: 0, long: 0 } }
             };
             fetchers.fetchAladhanAnnual.mockResolvedValue({});
             
             await validateConfigSource(config);
             expect(fetchers.fetchAladhanAnnual).toHaveBeenCalled();
             expect(fetchers.fetchMyMasjidBulk).not.toHaveBeenCalled();
        });

        it('should throw error if backup MyMasjid masjidId is missing', async () => {
             const config = {
                 sources: {
                     primary: { type: 'aladhan' },
                     backup: { type: 'mymasjid', enabled: true }
                 },
                 location: { coordinates: { lat: 0, long: 0 } }
             };
             fetchers.fetchAladhanAnnual.mockResolvedValue({});
             
             await expect(validateConfigSource(config)).rejects.toThrow('Masjid ID is required for Backup');
        });

        it('should validate backup Aladhan successfully', async () => {
             const config = {
                 sources: {
                     primary: { type: 'mymasjid', masjidId: '123' },
                     backup: { type: 'aladhan', enabled: true }
                 },
                 location: { coordinates: { lat: 0, long: 0 } }
             };
             fetchers.fetchMyMasjidBulk.mockResolvedValue({});
             fetchers.fetchAladhanAnnual.mockResolvedValue({});
             
             await validateConfigSource(config);
             expect(fetchers.fetchMyMasjidBulk).toHaveBeenCalled();
             expect(fetchers.fetchAladhanAnnual).toHaveBeenCalled();
        });
    });
});
