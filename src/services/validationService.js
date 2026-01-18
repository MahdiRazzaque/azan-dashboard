const { DateTime } = require('luxon');
const fetchers = require('./fetchers');

/**
 * Validates configuration sources by testing API connectivity.
 * Used during settings updates to ensure new configuration is functional.
 * 
 * @param {object} newConfig - The proposed configuration object
 * @throws {Error} If validation fails or sources are unreachable
 */
async function validateConfigSource(newConfig) {
    if (!newConfig.sources || !newConfig.sources.primary) {
        return;
    }

    const sourceType = newConfig.sources.primary.type;
    const now = DateTime.now();
    
    // Construct a temporary config for fetchers to use
    // Deep clone to avoid side effects
    const tempConfig = JSON.parse(JSON.stringify(newConfig));
    
    // --- PRIMARY SOURCE VALIDATION ---
    if (sourceType === 'mymasjid') {
        const masjidId = newConfig.sources.primary.masjidId;
        if (!masjidId) {
            throw new Error("Masjid ID is required for MyMasjid source");
        }
        
        console.log(`[Validation] Testing Primary MyMasjid with ID: ${masjidId}`);
        await fetchers.fetchMyMasjidBulk(tempConfig); 
    } else if (sourceType === 'aladhan') {
        const coords = newConfig.location?.coordinates;
        if (!coords || coords.lat === undefined || coords.long === undefined) {
             throw new Error("Coordinates are required for Aladhan source");
        }
        console.log(`[Validation] Testing Primary Aladhan with Coordinates: ${JSON.stringify(coords)}`);
        await fetchers.fetchAladhanAnnual(tempConfig, now.year);
    }

    // --- BACKUP SOURCE VALIDATION ---
    if (newConfig.sources.backup && newConfig.sources.backup.enabled !== false) {
        const backupSource = newConfig.sources.backup;
        const backupType = backupSource.type;

        if (backupType === 'mymasjid') {
            if (!backupSource.masjidId) {
                throw new Error("Masjid ID is required for Backup MyMasjid source");
            }
            console.log(`[Validation] Testing Backup MyMasjid with ID: ${backupSource.masjidId}`);
            await fetchers.fetchMyMasjidBulk(tempConfig);
        } else if (backupType === 'aladhan') {
            console.log(`[Validation] Testing Backup Aladhan with Coordinates: ${JSON.stringify(newConfig.location.coordinates)}`);
            await fetchers.fetchAladhanAnnual(tempConfig, now.year);
        }
    }
}

module.exports = {
    validateConfigSource
};
