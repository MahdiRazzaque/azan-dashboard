const configService = require('@config');
const { z } = require('zod');
const { DateTime } = require('luxon');
const { getPrayersWithNext, getPrayerCalendarWindow } = require('@services/core/prayerTimeService');

const prayerCalendarQuerySchema = z.object({
    cursorDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(
        (value) => DateTime.fromISO(value).isValid,
        { message: 'cursorDate is not a valid calendar date.' }
    ).optional(),
    direction: z.enum(['future', 'past']).optional()
}).refine(
    ({ cursorDate, direction }) => Boolean(cursorDate) === Boolean(direction),
    { message: 'Invalid prayer calendar query parameters.' }
);

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
            const parsedQuery = prayerCalendarQuerySchema.safeParse(req.query || {});
            if (!parsedQuery.success) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'Invalid prayer calendar query parameters.'
                });
            }

            const config = configService.get();
            const timezone = config.location.timezone;
            const requestDate = DateTime.now().setZone(timezone);
            
            // Retrieve calculated prayer times and determine the next event based on the current time
            const result = await getPrayersWithNext(config, timezone, requestDate);
            const calendar = await getPrayerCalendarWindow(config, timezone, parsedQuery.data, requestDate);
            res.json({
                ...result,
                calendar
            });
            
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
