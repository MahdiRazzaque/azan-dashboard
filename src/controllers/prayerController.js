const configService = require('@config');
const { getPrayersWithNext } = require('@services/core/prayerTimeService');

/**
 * Controller for prayer-related operations, handling retrieval of prayer times.
 */
const prayerController = {
    /**
     * Retrieves prayer times for the current date, including the next upcoming prayer.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     * @returns {Promise<void>} A promise that resolves when the response is sent.
     */
    getPrayers: async (req, res) => {
        try {
            const config = configService.get();
            const timezone = config.location.timezone;
            
            // Retrieve calculated prayer times and determine the next event based on the current time
            const result = await getPrayersWithNext(config, timezone);
            res.json(result);
            
        } catch (error) {
            console.error('[PrayerController] Error:', error.message);
            res.status(500).json({ 
                error: 'Internal Server Error', 
                message: 'Failed to retrieve prayer times. Please check logs.' 
            });
        }
    }
};

module.exports = prayerController;
