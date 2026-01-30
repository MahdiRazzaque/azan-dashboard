const path = require('path');
const fs = require('fs');
const configService = require('@config'); // Singleton
const sseService = require('@services/system/sseService');
const audioAssetService = require('@services/system/audioAssetService');
const OutputFactory = require('@outputs');

const AUDIO_DIR = path.join(__dirname, '../../../public/audio');

/**
 * Resolves the audio source path and URL based on the trigger settings.
 * 
 * @param {Object} settings - The trigger settings for the specific prayer event.
 * @param {string} prayer - The name of the prayer.
 * @param {string} event - The type of event (e.g., preAdhan, adhan).
 * @returns {Object} An object containing the absolute file path and relative URL of the audio.
 */
const getAudioSource = (settings, prayer, event) => {
    if (settings.type === 'tts') {
        const filename = `tts_${prayer}_${event}.mp3`;
        return {
            filePath: path.join(AUDIO_DIR, 'cache', filename),
            url: `/public/audio/cache/${filename}`
        };
    } else if (settings.type === 'file') {
        const relativePath = settings.path;
        return {
            filePath: path.join(AUDIO_DIR, relativePath),
            url: `/public/audio/${relativePath}`
        };
    } else if (settings.type === 'url') {
        return {
            filePath: null, // URLs don't have local paths usually
            url: settings.url
        };
    }
    return { filePath: null, url: null };
};

/**
 * Helper to wrap a promise with a timeout and AbortController.
 * @param {Function} task - Function that returns a promise and accepts a signal.
 * @param {number} ms - Timeout in milliseconds.
 * @param {string} errorMsg - Error message if timeout occurs.
 * @returns {Promise<any>} The result of the task.
 */
const withTimeout = async (task, ms, errorMsg) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);

    try {
        const result = await task(controller.signal);
        clearTimeout(timer);
        return result;
    } catch (error) {
        clearTimeout(timer);
        if (error.name === 'AbortError') {
            throw new Error(errorMsg);
        }
        throw error;
    }
};

/**
 * Helper to delay execution.
 * @param {number} ms - Delay in milliseconds.
 * @param {AbortSignal} [signal] - Optional AbortSignal to cancel the delay.
 * @returns {Promise<void>}
 */
const delay = (ms, signal) => {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            return reject(new Error('Aborted'));
        }

        const timer = setTimeout(resolve, ms);

        signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new Error('Aborted'));
        }, { once: true });
    });
};

/**
 * Validates and prepares the audio asset for an automation event.
 * Attempts to regenerate TTS files if missing or invalid.
 * 
 * @param {Object} settings - The trigger settings.
 * @param {string} prayer - The name of the prayer.
 * @param {string} event - The type of event.
 * @param {Object} config - The system configuration.
 * @returns {Promise<{success: boolean, source?: Object}>} The validation result and source details.
 * @private
 */
const _validateAndPrepareAudio = async (settings, prayer, event, config) => {
    const source = getAudioSource(settings, prayer, event);

    if (settings.type === 'tts') {
        try {
            const ttsResult = await audioAssetService.ensureTTSFile(prayer, event, settings, config);
            if (!ttsResult.success) {
                console.error(`[Automation] Aborting ${prayer} ${event}: TTS generation failed (${ttsResult.message})`);
                sseService.broadcast({
                    type: 'LOG',
                    payload: { 
                        message: `Skipped ${prayer} ${event}: TTS Service Offline`, 
                        timestamp: new Date().toISOString(),
                        type: 'error'
                    }
                });
                return { success: false };
            }
        } catch (e) {
            console.error(`[Automation] Critical error during TTS preparation:`, e.message);
            return { success: false };
        }
    } else if (settings.type === 'file') {
        if (!source.filePath || !fs.existsSync(source.filePath)) {
            console.error(`[Automation] Aborting ${prayer} ${event}: Custom file missing (${source.filePath})`);
            sseService.broadcast({
                type: 'LOG',
                payload: { 
                    message: `Skipped ${prayer} ${event}: Custom file missing`, 
                    timestamp: new Date().toISOString(),
                    type: 'error'
                }
            });
            return { success: false };
        }
    }
    return { success: true, source };
};

/**
 * Identifies active targets and calculates the master lead time for an automation event.
 * 
 * @param {Object} config - The system configuration.
 * @param {Object} settings - The trigger settings.
 * @returns {{activeTargets: Array<Object>, masterLeadTime: number}} The active targets and timing details.
 * @private
 */
const _getActiveTargets = (config, settings) => {
    const configuredTargets = settings.targets || [];
    const targets = new Set([...configuredTargets, 'browser']);
    
    let masterLeadTime = 0;
    const activeTargets = [];

    targets.forEach(targetId => {
        const outputConfig = config.automation?.outputs?.[targetId];
        // 'browser' is implicitly enabled if not explicitly disabled
        const isEnabled = targetId === 'browser' ? (outputConfig?.enabled !== false) : outputConfig?.enabled;
        
        if (isEnabled) {
            const leadTime = outputConfig?.leadTimeMs || 0;
            if (leadTime > masterLeadTime) {
                masterLeadTime = leadTime;
            }
            activeTargets.push({ targetId, leadTime });
        }
    });

    return { activeTargets, masterLeadTime };
};

/**
 * Executes an automation event for a single target strategy.
 * 
 * @param {Object} target - The target details (id and lead time).
 * @param {number} masterLeadTime - The overall master lead time.
 * @param {Object} payload - The automation payload.
 * @param {Object} executionMetadata - Additional metadata for execution.
 * @returns {Promise<void>}
 * @private
 */
const _executeTarget = async (target, masterLeadTime, payload, executionMetadata) => {
    const { targetId, leadTime } = target;
    try {
        const strategy = OutputFactory.getStrategy(targetId);
        const metadata = strategy.constructor.getMetadata();
        
        // Perform health check (except for browser)
        if (targetId !== 'browser') {
            const health = await strategy.healthCheck();
            if (!health.healthy) {
                console.warn(`[Automation] Skipping target '${targetId}': Service is unhealthy (${health.message || 'Unknown error'})`);
                return;
            }
        }

        const waitDelay = masterLeadTime - leadTime;
        const timeoutMs = metadata.timeoutMs || 5000;
        
        await withTimeout(
            async (signal) => {
                if (waitDelay > 0) {
                    await delay(waitDelay, signal);
                }
                return strategy.execute(payload, executionMetadata, signal);
            },
            timeoutMs + waitDelay,
            `Strategy ${targetId} timed out after ${timeoutMs}ms`
        );
    } catch (error) {
        console.error(`[Automation] Error executing target '${targetId}' for ${payload.prayer} ${payload.event}:`, error.message);
    }
};

/**
 * Main entry point for triggering an automated prayer event.
 * Orchestrates audio preparation and output target execution.
 * 
 * @param {string} prayer - The name of the prayer.
 * @param {string} event - The type of event.
 * @returns {Promise<void>}
 */
const triggerEvent = async (prayer, event) => {
    const config = configService.get();
    const settings = config.automation?.triggers?.[prayer]?.[event];
    
    if (!settings || !settings.enabled) {
        return;
    }

    // 1. Audio Asset Validation & Preparation
    const { success, source } = await _validateAndPrepareAudio(settings, prayer, event, config);
    if (!success) return;
    
    console.log(`[Automation] Triggering ${prayer} ${event}...`);
    sseService.broadcast({
        type: 'LOG',
        payload: { message: `Triggering ${prayer} ${event}`, timestamp: new Date().toISOString() }
    });

    // 2. Target Selection and Execution Orchestration
    const { activeTargets, masterLeadTime } = _getActiveTargets(config, settings);
    
    const payload = {
        prayer,
        event,
        source,
        baseUrl: config.automation.baseUrl
    };
    
    const executionMetadata = { isTest: false };

    // Execute targets in parallel (each handles its own stagger delay)
    const promises = activeTargets.map(target => 
        _executeTarget(target, masterLeadTime, payload, executionMetadata)
    );

    await Promise.allSettled(promises);
};

module.exports = {
    getAudioSource,
    triggerEvent
};
