const configService = require('../config');
const { getPrayersWithNext } = require('../services/prayerTimeService');

/**
 * Controller for Prayer related operations.
 */
const prayerController = {
    /**
     * Get prayer times for today and the next upcoming prayer.
     */
    getPrayers: async (req, res) => {
        try {
            const config = configService.get();
            const timezone = config.location.timezone;
            
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
