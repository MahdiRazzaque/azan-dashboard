const { validateConfigSource } = require('@services/core/validationService');
const { ProviderFactory } = require('@providers');
const { DateTime } = require('luxon');

jest.mock('@providers');

describe('ValidationService', () => {
    const mockConfig = {
        location: { coordinates: { lat: 51.5, long: -0.1 } },
        sources: {
            primary: { type: 'aladhan', method: 15, madhab: 1 },
            backup: { type: 'mymasjid', masjidId: '94f1c71b-7f8a-4b9a-9e1d-3b5f6a7b8c9d' }
        }
    };

    const mockAladhanClass = {
        getMetadata: jest.fn().mockReturnValue({ id: 'aladhan', label: 'Aladhan', requiresCoordinates: true }),
        getConfigSchema: jest.fn().mockReturnValue({ parse: jest.fn() })
    };
    const mockMyMasjidClass = {
        getMetadata: jest.fn().mockReturnValue({ id: 'mymasjid', label: 'MyMasjid', requiresCoordinates: false }),
        getConfigSchema: jest.fn().mockReturnValue({ parse: jest.fn() })
    };

    beforeEach(() => {
        jest.clearAllMocks();
        ProviderFactory.getProviderClass.mockImplementation((type) => {
            if (type === 'aladhan') return mockAladhanClass;
            if (type === 'mymasjid') return mockMyMasjidClass;
            return null;
        });
    });

    it('should validate primary and backup sources', async () => {
        const mockProvider = { getAnnualTimes: jest.fn().mockResolvedValue({}) };
        ProviderFactory.create.mockReturnValue(mockProvider);

        await validateConfigSource(mockConfig);

        expect(ProviderFactory.getProviderClass).toHaveBeenCalledTimes(2);
        expect(ProviderFactory.create).toHaveBeenCalledTimes(2);
        expect(mockProvider.getAnnualTimes).toHaveBeenCalledTimes(2);
    });

    it('should throw error if primary source fails', async () => {
        const mockProvider = { getAnnualTimes: jest.fn().mockRejectedValue(new Error('Fetch failed')) };
        ProviderFactory.create.mockReturnValue(mockProvider);

        await expect(validateConfigSource(mockConfig)).rejects.toThrow('PRIMARY Source (Aladhan) Connection Failed: Fetch failed');
    });

    it('should throw error if backup source fails', async () => {
        const primaryProvider = { getAnnualTimes: jest.fn().mockResolvedValue({}) };
        const backupProvider = { getAnnualTimes: jest.fn().mockRejectedValue(new Error('Backup failed')) };
        
        ProviderFactory.create
            .mockReturnValueOnce(primaryProvider)
            .mockReturnValueOnce(backupProvider);

        await expect(validateConfigSource(mockConfig)).rejects.toThrow('BACKUP Source (MyMasjid) Connection Failed: Backup failed');
    });

    it('should skip backup validation if disabled', async () => {
        const configWithDisabledBackup = {
            ...mockConfig,
            sources: {
                primary: { type: 'aladhan', method: 15, madhab: 1 },
                backup: { type: 'mymasjid', enabled: false }
            }
        };
        const mockProvider = { getAnnualTimes: jest.fn().mockResolvedValue({}) };
        ProviderFactory.create.mockReturnValue(mockProvider);

        await validateConfigSource(configWithDisabledBackup);

        expect(ProviderFactory.create).toHaveBeenCalledTimes(1);
    });
});
