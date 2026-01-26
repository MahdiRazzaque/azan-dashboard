const { DateTime } = require('luxon');
const { ProviderFactory } = require('@providers');

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

    const now = DateTime.now();
    
    // --- PRIMARY SOURCE VALIDATION ---
    const primarySource = newConfig.sources.primary;
    if (primarySource.type === 'aladhan') {
        const coords = newConfig.location?.coordinates;
        if (!coords || coords.lat === undefined || coords.long === undefined) {
             throw new Error("Coordinates are required for Aladhan source");
        }
    } else if (primarySource.type === 'mymasjid') {
        if (!primarySource.masjidId) {
            throw new Error("Masjid ID is required for MyMasjid source");
        }
    }

    console.log(`[Validation] Testing Primary source: ${primarySource.type}`);
    const primaryProvider = ProviderFactory.create(primarySource, newConfig);
    await primaryProvider.getAnnualTimes(now.year);

    // --- BACKUP SOURCE VALIDATION ---
    if (newConfig.sources.backup && newConfig.sources.backup.enabled !== false) {
        const backupSource = newConfig.sources.backup;
        
        if (backupSource.type === 'mymasjid' && !backupSource.masjidId) {
            throw new Error("Masjid ID is required for Backup MyMasjid source");
        }

        console.log(`[Validation] Testing Backup source: ${backupSource.type}`);
        const backupProvider = ProviderFactory.create(backupSource, newConfig);
        await backupProvider.getAnnualTimes(now.year);
    }
}

module.exports = {
    validateConfigSource
};
