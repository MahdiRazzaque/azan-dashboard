const { envUpdateSchema } = require('@config/schemas');
const envManager = require('@utils/envManager');
const configService = require('@config');

/**
 * Updates an environment variable.
 * Only allows specific keys (e.g., BASE_URL).
 * 
 * @param {import('express').Request} req - The express request object.
 * @param {import('express').Response} res - The express response object.
 */
const updateEnv = async (req, res) => {
    try {
        // Validate request body
        const validated = envUpdateSchema.parse(req.body);
        
        // Update .env file and current process
        envManager.setEnvValue(validated.key, validated.value);
        
        // Reload environment in ConfigService
        await configService.reloadEnv();
        
        res.json({
            success: true,
            message: `${validated.key} updated successfully`,
            data: {
                [validated.key]: validated.value
            }
        });
    } catch (error) {
        if (error.name === 'ZodError') {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: error.errors
            });
        }
        
        console.error('[EnvController] Error updating environment variable:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

module.exports = {
    updateEnv
};
