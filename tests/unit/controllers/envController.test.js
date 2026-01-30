const { updateEnv } = require('@controllers/envController');
const envManager = require('@utils/envManager');
const configService = require('@config');
const { envUpdateSchema } = require('@config/schemas');

jest.mock('@utils/envManager');
jest.mock('@config');

describe('EnvController', () => {
    let req, res;

    beforeEach(() => {
        req = {
            body: {}
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
        jest.clearAllMocks();
    });

    it('should update environment variable successfully', async () => {
        req.body = { key: 'BASE_URL', value: 'https://example.com' };
        
        await updateEnv(req, res);

        expect(envManager.setEnvValue).toHaveBeenCalledWith('BASE_URL', 'https://example.com');
        expect(configService.reload).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            message: 'BASE_URL updated successfully'
        }));
    });

    it('should return 400 if validation fails', async () => {
        req.body = { key: 'invalid-key', value: '' }; // Validation should fail based on schema
        
        await updateEnv(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            message: 'Validation failed'
        }));
    });

    it('should return 500 if an internal error occurs', async () => {
        req.body = { key: 'BASE_URL', value: 'https://example.com' };
        envManager.setEnvValue.mockImplementation(() => { throw new Error('Internal oops'); });

        await updateEnv(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            message: 'Internal server error'
        }));
    });
});
