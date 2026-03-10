const axios = require('axios');
const crypto = require('crypto');
const configService = require('@config');
const { ProviderFactory } = require('@providers');
const OutputFactory = require('../../outputs');
const asyncLock = require('@utils/asyncLock');
const configUnmasker = require('@utils/configUnmasker');

let healthCache = null;

/**
 * Initialises the health cache with default values.
 * Exposing as a public method to allow explicit startup control.
 */
function init() {
    if (healthCache) return;

    healthCache = {
        api: { healthy: true, message: 'Ready', lastChecked: null },
        local: { healthy: true, message: 'Online', lastChecked: null },
        tts: { healthy: false, message: 'Initialising...', lastChecked: null },
        primarySource: { healthy: false, message: 'Initialising...', lastChecked: null },
        backupSource: { healthy: false, message: 'Initialising...', lastChecked: null },
        ports: { api: process.env.PORT || 3000, tts: 8000 }
    };

    // Dynamically add strategy keys to healthCache for non-hidden outputs
    try {
        const strategies = OutputFactory.getAllStrategies();
        if (Array.isArray(strategies)) {
            strategies.forEach(meta => {
                if (!meta.hidden) {
                    healthCache[meta.id] = { healthy: false, message: 'Initialising...', lastChecked: null };
                }
            });
        }
    } catch {
        // Fallback for cases where OutputFactory might not be fully ready or mocked incorrectly
        console.warn('[HealthCheck] Failed to dynamically load strategies into cache');
    }
}

/**
 * Ensures the health cache is initialised with default values.
 * @private
 */
function _ensureInitialized() {
    if (!healthCache) {
        init();
    }
}

/**
 * Validates the connectivity and functionality of a specific prayer time source.
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
        return await provider.healthCheck();
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
            await axios.get(`${ttsUrl}/docs`, { 
                timeout: 2000,
                maxContentLength: 5000000 
            });
            return { healthy: true, message: 'Online' };
    } catch {
        return { healthy: false, message: 'Service Unreachable' };
    }
}

/**
 * Orchestrates a targeted health check refresh.
 * Updates the internal cache with new status reports.
 * 
 * @param {string} target The specific service or strategy ID to refresh.
 * @param {Object} [params] Optional transient credentials to override configuration.
 * @param {Object} [options] Additional options.
 * @param {boolean} [options.force=false] Whether to force the check even if disabled.
 * @returns {Promise<Object>} The updated health cache for that target.
 * @private
 */
async function _refreshTarget(target, params = null, { force = false } = {}) {
    const config = configService.get();
    const healthChecks = config.system?.healthChecks || {};

    // API server is inherently healthy if this code is executing (exempt from monitoring toggle)
    if (target === 'api') return { healthy: true, message: 'Ready' };

    // Check if monitoring is enabled for this target
    if (!force && healthChecks[target] === false) {
        return { healthy: false, message: 'Monitoring Disabled' };
    }

    if (target === 'tts') return checkPythonService();
    if (target === 'primarySource') return checkSource('primary');
    if (target === 'backupSource') return checkSource('backup');

    // Handle Output Strategies
    try {
        const strategy = OutputFactory.getStrategy(target);
        if (!strategy) return { healthy: false, message: 'Unknown Service' };

        const meta = OutputFactory.getAllStrategies().find(s => s.id === target);
        
        // Filter params based on each strategy's metadata requirements
        let strategyParams = null;
        if (params && meta?.params) {
            strategyParams = {};
            meta.params.forEach(p => {
                if (p.requiredForHealth && params[p.key] !== undefined) {
                    strategyParams[p.key] = params[p.key];
                }
            });

            // Unmask secrets received from the UI
            configUnmasker.unmaskParams(target, strategyParams, config);

            if (Object.keys(strategyParams).length === 0) {
                strategyParams = null;
            }
        }

        return await strategy.healthCheck(strategyParams);
    } catch (e) {
        return { healthy: false, message: e.message };
    }
}

/**
 * Refreshes health status for one or all services.
 * 
 * @param {string} [target='all'] The specific service or strategy ID to refresh.
 * @param {Object} [params] Optional transient credentials.
 * @param {Object} [options] Additional options.
 * @param {boolean} [options.force=false] Whether to force the check.
 * @returns {Promise<Object>} The updated health cache.
 */
async function refresh(target = 'all', params = null, { force = false } = {}) {
    _ensureInitialized();
    
    // Use SHA-256 hash for params to avoid long keys and potential DoS via large JSON strings
    const paramsString = params ? JSON.stringify(params) : 'default';
    const paramsHash = crypto.createHash('sha256').update(paramsString).digest('hex');
    const lockKey = `health-refresh-${target}-${paramsHash}-${force}`;

    return asyncLock.run(lockKey, async () => {
        const updates = {};
        const targets = [];

        if (target === 'all') {
            targets.push('api', 'tts', 'primarySource', 'backupSource');
            OutputFactory.getAllStrategies().forEach(s => {
                if (!s.hidden) targets.push(s.id);
            });
        } else {
            targets.push(target);
        }

        const now = new Date().toISOString();
        const promises = targets.map(t => 
            _refreshTarget(t, params, { force })
                .then(res => {
                    // Only stamp lastChecked when a real check executed,
                    // not when monitoring was disabled (no actual check ran)
                    const lastChecked = res.message === 'Monitoring Disabled'
                        ? (healthCache[t]?.lastChecked || null)
                        : now;
                    updates[t] = { ...res, lastChecked };
                })
        );

        await Promise.all(promises);

        // Update cache — per-service lastChecked, no global timestamp
        healthCache = { 
            ...healthCache, 
            ...updates
        };

        // Refresh ports
        try {
            const ttsUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
            const port = new URL(ttsUrl).port;
            if (port) healthCache.ports.tts = port;
        } catch { /* ignore */ }
        healthCache.ports.api = process.env.PORT || 3000;

        return getHealth(); // Return a copy
    });
}

/**
 * Retrieves the current health status from the application's internal cache.
 * Returns a deep copy to prevent external mutation.
 * 
 * @returns {Object} The synchronised health state object.
 */
function getHealth() {
    _ensureInitialized();
    // Return deep copy to prevent external mutation of the shared state
    return JSON.parse(JSON.stringify(healthCache));
}

/**
 * Toggles automated health monitoring for a specific service.
 * 
 * @param {string} serviceId The ID of the service to toggle.
 * @param {boolean} enabled Whether monitoring should be enabled.
 */
async function toggle(serviceId, enabled) {
    const config = configService.get();
    const healthChecks = { ...(config.system?.healthChecks || {}) };
    healthChecks[serviceId] = enabled;
    await configService.update({ system: { healthChecks } });
}

/**
 * Runs a full health check on all services that have monitoring enabled.
 * Designed for daily maintenance routines.
 * 
 * @returns {Promise<Object>} The updated health cache.
 */
async function runDailyMaintenance() {
    console.log('[HealthCheck] Running daily health maintenance...');
    return refresh('all', null, { force: false });
}

/**
 * Runs a full health check on all monitored services during server startup.
 * 
 * @returns {Promise<Object>} The initial system health state.
 */
async function runStartupChecks() {
    console.log('[HealthCheck] Running startup health checks...');
    // Startup checks are forced to ensure initial state is populated
    return refresh('all', null, { force: true });
}

module.exports = {
    init,
    refresh,
    getHealth,
    checkSource,
    toggle,
    runDailyMaintenance,
    runStartupChecks
};