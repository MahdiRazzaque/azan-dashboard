const axios = require('axios');
const configService = require('@config');
const { ProviderFactory } = require('@providers');
const OutputFactory = require('../../outputs');
const asyncLock = require('@utils/asyncLock');

let healthCache = null;

/**
 * Ensures the health cache is initialised with default values.
 * @private
 */
function _ensureInitialized() {
    if (healthCache) return;

    healthCache = {
        tts: { healthy: false, message: 'Initialising...' },
        primarySource: { healthy: false, message: 'Initialising...' },
        backupSource: { healthy: false, message: 'Initialising...' },
        ports: { api: process.env.PORT || 3000, tts: 8000 },
        lastChecked: null
    };

    // Dynamically add strategy keys to healthCache for non-hidden outputs
    try {
        const strategies = OutputFactory.getAllStrategies();
        if (Array.isArray(strategies)) {
            strategies.forEach(meta => {
                if (!meta.hidden) {
                    healthCache[meta.id] = { healthy: false, message: 'Initialising...' };
                }
            });
        }
    } catch (e) {
        // Fallback for cases where OutputFactory might not be fully ready or mocked incorrectly
        console.warn('[HealthCheck] Failed to dynamically load strategies into cache:', e.message);
    }
}

/**
 * Validates the connectivity and functionality of a specific prayer time source.
 * Attempts to fetch annual times to confirm the provider is responding correctly.
 * 
 * @param {'primary' | 'backup'} target The source configuration to validate.
 * @returns {Promise<{healthy: boolean, message: string}>} The status of the source.
 */
async function checkSource(target) {
    const config = configService.get();
    const source = config.sources[target];

    if (!source) return { healthy: false, message: 'Not Configured' };
    if (target === 'backup' && source.enabled === false) return { healthy: false, message: 'Disabled' };

    try {
        const provider = ProviderFactory.create(source, config);
        const { DateTime } = require('luxon');
        const year = DateTime.now().setZone(config.location.timezone).year;
        await provider.getAnnualTimes(year);
        return { healthy: true, message: 'Online' };
    } catch (e) {
        return { healthy: false, message: e.message || 'Offline' };
    }
}

/**
 * Validates if the Python-based Text-to-Speech (TTS) service is reachable.
 * Checks the service documentation endpoint as a heartbeat mechanism.
 * 
 * @returns {Promise<{healthy: boolean, message: string}>} The status of the TTS service.
 */
async function checkPythonService() {
     try {
        const ttsUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
        await axios.get(`${ttsUrl}/docs`, { timeout: 2000 });
        return { healthy: true, message: 'Online' };
    } catch (e) {
        return { healthy: false, message: 'Service Unreachable' };
    }
}

/**
 * Orchestrates a system-wide or targeted health check refresh.
 * Updates the internal cache with new status reports for output strategies,
 * prayer time providers, and secondary microservices.
 * 
 * @param {string} [target='all'] The specific service or strategy ID to refresh.
 * @param {Object} [params] Optional transient credentials to override configuration.
 * @returns {Promise<Object>} The updated health cache.
 */
async function refresh(target = 'all', params = null) {
    _ensureInitialized();
    
    // De-duplicate simultaneous health check requests using AsyncLock
    // We include target and params (if any) in the key to allow specific checks to run concurrently
    // but identical ones to collapse.
    const lockKey = `health-refresh-${target}-${params ? JSON.stringify(params) : 'default'}`;

    return asyncLock.run(lockKey, async () => {
        const updates = {};
        const promises = [];

        // Strategies
        const strategies = OutputFactory.getAllStrategies();

        const shouldCheckAll = (target === 'all');

        for (const meta of strategies) {
            if (meta.hidden) continue;

            if (shouldCheckAll || target.toLowerCase() === meta.id.toLowerCase()) {
                const strategy = OutputFactory.getStrategy(meta.id);

                // REQ-006: Filter params based on each strategy's metadata requirements
                let strategyParams = null;
                if (params && meta.params) {
                    strategyParams = {};
                    meta.params.forEach(p => {
                        // Only pass parameters explicitly marked as required for health checks
                        if (p.requiredForHealth && params[p.key] !== undefined) {
                            strategyParams[p.key] = params[p.key];
                        }
                    });
                    // Pass null if no relevant parameters were found to allow internal config fallback
                    if (Object.keys(strategyParams).length === 0) {
                        strategyParams = null;
                    }
                }

                promises.push(
                    strategy.healthCheck(strategyParams)
                        .then(res => updates[meta.id] = res)
                        .catch(e => updates[meta.id] = { healthy: false, message: e.message })
                );
            }
        }

        // Legacy / Other services
        if (shouldCheckAll || target === 'tts') {
            promises.push(checkPythonService().then(res => updates.tts = res));
        }

        if (shouldCheckAll || target === 'primarySource') {
            promises.push(checkSource('primary').then(res => updates.primarySource = res));
        }
        if (shouldCheckAll || target === 'backupSource') {
            promises.push(checkSource('backup').then(res => updates.backupSource = res));
        }

        await Promise.all(promises);

        // Refresh ports
        try {
            const ttsUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
            const port = new URL(ttsUrl).port;
            if (port) healthCache.ports = { ...healthCache.ports, tts: port };
        } catch(e) {}
        healthCache.ports.api = process.env.PORT || 3000;

        healthCache = { ...healthCache, ...updates, lastChecked: new Date().toISOString() };
        return healthCache;
    });
}

/**
 * Retrieves the current health status from the application's internal cache.
 * Ensures the cache is initialised if this is the first retrieval.
 * 
 * @returns {Object} The current health cache.
 */
function getHealth() {
    _ensureInitialized();
    return healthCache;
}

module.exports = {
    refresh,
    getHealth,
    checkSource
};