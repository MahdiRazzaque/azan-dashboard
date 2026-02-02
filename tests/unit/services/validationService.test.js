const { validateConfigSource } = require('@services/core/validationService');
const { ProviderFactory } = require('@providers');
const { DateTime } = require('luxon');

jest.mock('@providers');

describe('ValidationService Comprehensive', () => {
    const mockConfig = {
        location: { coordinates: { lat: 51.5, long: -0.1 } },
        sources: {
            primary: { type: 'aladhan' },
            backup: { enabled: true, type: 'mymasjid' }
        }
    };

    const mockAladhanClass = {
        getMetadata: jest.fn().mockReturnValue({ id: 'aladhan', label: 'Aladhan', requiresCoordinates: true }),
        getConfigSchema: jest.fn().mockReturnValue({ parse: jest.fn() })
    };

    beforeEach(() => {
        jest.clearAllMocks();
        ProviderFactory.getProviderClass.mockReturnValue(mockAladhanClass);
    });

    it('should skip if backup is missing', async () => {
        const configNoBackup = { 
            location: { coordinates: { lat: 51.5, long: -0.1 } },
            sources: { primary: { type: 'aladhan' } } 
        };
        mockAladhanClass.getConfigSchema().parse.mockReturnValue({});
        const mockProvider = { getAnnualTimes: jest.fn().mockResolvedValue({}) };
        ProviderFactory.create.mockReturnValue(mockProvider);
        
        await validateConfigSource(configNoBackup);
        expect(ProviderFactory.create).toHaveBeenCalledTimes(1);
    });

    it('should handle issues array being empty in ZodError', async () => {
        const zodError = new Error('Zod validation failed');
        zodError.name = 'ZodError';
        zodError.issues = []; 
        mockAladhanClass.getConfigSchema().parse.mockImplementation(() => { throw zodError; });

        await expect(validateConfigSource(mockConfig)).rejects.toThrow('Validation Failed: ');
    });
});