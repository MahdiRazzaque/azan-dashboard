const axios = require('axios');
const configService = require('@config');
const { ProviderFactory } = require('@providers');
const OutputFactory = require('../../outputs');

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

async function checkPythonService() {
     try {
        const ttsUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
        await axios.get(`${ttsUrl}/docs`, { timeout: 2000 });
        return { healthy: true, message: 'Online' };
    } catch (e) {
        return { healthy: false, message: 'Service Unreachable' };
    }
}

async function refresh(target = 'all', params = null) {
    _ensureInitialized();
    const updates = {};
    const promises = [];

    // Strategies
    const strategies = OutputFactory.getAllStrategies();
    
    const shouldCheckAll = (target === 'all');
    
    for (const meta of strategies) {
        if (meta.hidden) continue;
        
        if (shouldCheckAll || target.toLowerCase() === meta.id.toLowerCase()) {
             const strategy = OutputFactory.getStrategy(meta.id);
             promises.push(
                 strategy.healthCheck(params)
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
}

function getHealth() {
    _ensureInitialized();
    return healthCache;
}

module.exports = {
    refresh,
    getHealth,
    checkSource
};