const { validateConfigSource } = require('@services/core/validationService');
const { ProviderFactory } = require('@providers');
const { DateTime } = require('luxon');

jest.mock('@providers');

describe('ValidationService', () => {
    const mockConfig = {
        location: { coordinates: { lat: 51.5, long: -0.1 } },
        sources: {
            primary: { type: 'aladhan' },
            backup: { type: 'mymasjid', masjidId: '123' }
        }
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should validate primary and backup sources', async () => {
        const mockProvider = { getAnnualTimes: jest.fn().mockResolvedValue({}) };
        ProviderFactory.create.mockReturnValue(mockProvider);

        await validateConfigSource(mockConfig);

        expect(ProviderFactory.create).toHaveBeenCalledTimes(2);
        expect(mockProvider.getAnnualTimes).toHaveBeenCalledTimes(2);
    });

    it('should throw error if primary source fails', async () => {
        const mockProvider = { getAnnualTimes: jest.fn().mockRejectedValue(new Error('Fetch failed')) };
        ProviderFactory.create.mockReturnValue(mockProvider);

        await expect(validateConfigSource(mockConfig)).rejects.toThrow('Fetch failed');
    });

    it('should throw error if backup source fails', async () => {
        const primaryProvider = { getAnnualTimes: jest.fn().mockResolvedValue({}) };
        const backupProvider = { getAnnualTimes: jest.fn().mockRejectedValue(new Error('Backup failed')) };
        
        ProviderFactory.create
            .mockReturnValueOnce(primaryProvider)
            .mockReturnValueOnce(backupProvider);

        await expect(validateConfigSource(mockConfig)).rejects.toThrow('Backup failed');
    });

    it('should skip backup validation if disabled', async () => {
        const configWithDisabledBackup = {
            ...mockConfig,
            sources: {
                primary: { type: 'aladhan' },
                backup: { type: 'mymasjid', enabled: false }
            }
        };
        const mockProvider = { getAnnualTimes: jest.fn().mockResolvedValue({}) };
        ProviderFactory.create.mockReturnValue(mockProvider);

        await validateConfigSource(configWithDisabledBackup);

        expect(ProviderFactory.create).toHaveBeenCalledTimes(1);
    });
});
