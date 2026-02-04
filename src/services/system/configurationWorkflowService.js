const configService = require('@config');
const sseService = require('@services/system/sseService');
const { forceRefresh } = require('@services/core/prayerTimeService');
const schedulerService = require('@services/core/schedulerService');
const audioAssetService = require('@services/system/audioAssetService');
const healthCheck = require('@services/system/healthCheck');
const { validateConfigSource } = require('@services/core/validationService');
const OutputFactory = require('../../outputs');
const encryption = require('@utils/encryption');
const { ProviderFactory } = require('@providers');
const configUnmasker = require('@utils/configUnmasker');

/**
 * Service responsible for orchestrating the configuration update workflow.
 * Handles unmasking, validation, persistence, health checks, and service reloads.
 */
class ConfigurationWorkflowService {
    /**
     * Executes the full configuration update transaction.
     * 
     * @param {Object} newConfig - The new configuration data from the request.
     * @returns {Promise<Object>} Success message and metadata.
     * @throws {Error} If validation or synchronisation fails.
     */
    async executeUpdate(newConfig) {
        const previousConfig = configService.get();
        
        // 1. Unmask secrets received from the UI (preserve existing ones if masked)
        configUnmasker.unmaskSecrets(newConfig, previousConfig);

        // Detect if prayer-affecting settings have changed
        const sourcesChanged = JSON.stringify(previousConfig.sources) !== JSON.stringify(newConfig.sources);
        const locationChanged = JSON.stringify(previousConfig.location) !== JSON.stringify(newConfig.location);
        const requiresRefresh = sourcesChanged || locationChanged;

        // 2. Validate the incoming configuration source
        if (requiresRefresh) {
            sseService.broadcast({ type: 'PROCESS_UPDATE', payload: { label: 'Validating Configuration...' } });
            await validateConfigSource(newConfig);
        }

        // 3. Save to Disk
        sseService.broadcast({ type: 'PROCESS_UPDATE', payload: { label: 'Saving to Disk...' } });
        await configService.update(newConfig);

        // 4. Refresh Cache ONLY if source or location has changed
        let result = { meta: { skip: true } };
        if (requiresRefresh) {
            sseService.broadcast({ type: 'PROCESS_UPDATE', payload: { label: 'Refreshing Prayer Data...' } });
            result = await forceRefresh(configService.get());
        }
        
        // 5. Synchronise audio assets
        sseService.broadcast({ type: 'PROCESS_UPDATE', payload: { label: 'Generating Audio Assets...' } });
        let syncResult = { warnings: [] };
        try {
            syncResult = await audioAssetService.syncAudioAssets();
        } catch (err) {
            // REQ-002: Soft-fail. Do not roll back config if sync fails.
            syncResult.warnings.push(`Audio Synchronisation Warning: ${err.message}`);
        }

        // 6. Re-initialise the scheduler
        sseService.broadcast({ type: 'PROCESS_UPDATE', payload: { label: 'Restarting Scheduler...' } });
        await schedulerService.initScheduler(); 

        // 7. Generate warnings
        // REQ-002: Use cached health status only to avoid network calls during save
        const warnings = await this._collectWarnings(syncResult, healthCheck.getHealth(), configService.get());

        sseService.broadcast({ type: 'PROCESS_UPDATE', payload: { label: 'Configuration Saved' } });
        
        return {
            message: 'Settings updated successfully.',
            meta: result.meta,
            warnings: warnings
        };
    }
        
    /**
     * Identifies which services are active based on the given configuration.
     * @param {Object} config - The configuration object to analyse for active services.
     * @returns {Set<string>} A set of identifiers for all active services identified within the config.
     * @private
     */
    _getUsedServices(config) {
        const usedServices = new Set();
        if (config.automation?.triggers) {
            Object.values(config.automation.triggers).forEach(prayerTriggers => {
                Object.values(prayerTriggers).forEach(trigger => {
                    if (!trigger.enabled) return;
                    if (trigger.type === 'tts') usedServices.add('tts');
                    if (trigger.targets) {
                        trigger.targets.forEach(t => {
                            if (t !== 'browser') usedServices.add(t);
                        });
                    }
                });
            });
        }
        return usedServices;
    }

    /**
     * Collects all warnings from various components after a configuration update.
     * @param {Object} syncResult - The result object from the synchronisation process.
     * @param {Object} health - The health status of relevant system components.
     * @param {Object} finalConfig - The final merged configuration object to validate.
     * @returns {Promise<Array<string>>} A promise that resolves to an array of warning strings.
     * @private
     */
    async _collectWarnings(syncResult, health, finalConfig) {
        const warnings = [...(syncResult.warnings || [])];
        const strategies = OutputFactory.getAllStrategies();
        
        // For polymorphic validation, we need audio file metadata
        const audioFiles = []; 

        if (finalConfig.automation && finalConfig.automation.triggers) {
            Object.entries(finalConfig.automation.triggers).forEach(([prayer, triggers]) => {
                Object.entries(triggers).forEach(([type, trigger]) => {
                    if (!trigger.enabled) return;
                    const prayerName = prayer.charAt(0).toUpperCase() + prayer.slice(1);
                    const typeName = type.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                    const niceName = `${prayerName} ${typeName}`;

                    if (trigger.type === 'tts' && !health.tts?.healthy) {
                        warnings.push(`${niceName}: TTS Service is offline`);
                    }

                    (trigger.targets || []).forEach(targetId => {
                        const strategy = strategies.find(s => s.id === targetId);
                        if (!strategy || targetId === 'browser') return;
                        
                        const outputConfig = finalConfig.automation?.outputs?.[targetId];
                        const strategyHealth = health[targetId];

                        if (!outputConfig || !outputConfig.enabled) {
                            warnings.push(`${niceName}: ${strategy.label} output is disabled in settings`);
                        } else if (strategyHealth && !strategyHealth.healthy) {
                            warnings.push(`${niceName}: ${strategy.label} output is offline (${strategyHealth.message || 'unreachable'})`);
                        }
    
                        try {
                            const instance = OutputFactory.getStrategy(targetId);
                            const strategyWarnings = instance.validateTrigger(trigger, {
                                audioFiles,
                                prayer,
                                triggerType: type,
                                niceName
                            });
                            warnings.push(...strategyWarnings);
                        } catch (e) {}
                    });
                });
            });
        }

        // Check overall integration health
        strategies.forEach(strategy => {
            if (strategy.hidden || strategy.id === 'browser') return;
            const outputConfig = finalConfig.automation?.outputs?.[strategy.id];
            if (outputConfig?.enabled) {
                const status = health[strategy.id];
                if (status && !status.healthy) {
                    const msg = `${strategy.label} Integration: ${status.message || 'Offline'}`;
                    if (!warnings.some(w => w.includes(msg))) {
                        warnings.push(msg);
                    }
                }
            }
        });

        return warnings;
    }
}

module.exports = new ConfigurationWorkflowService();