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
 * @param {Object} settings - The trigger settings object.
 * @param {string} prayer - The name of the prayer.
 * @param {string} event - The name of the event (e.g., 'azan', 'pre-azan').
 * @returns {Object} An object containing the filePath and url of the audio source.
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
 *
 * @param {Function} task - A function that returns a promise and accepts an AbortSignal.
 * @param {number} ms - The timeout duration in milliseconds.
 * @param {string} errorMsg - The error message to throw if the timeout is reached.
 * @returns {Promise<any>} A promise that resolves with the task result or rejects on timeout.
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
 *
 * @param {number} ms - The delay duration in milliseconds.
 * @param {AbortSignal} [signal] - An optional signal to abort the delay.
 * @returns {Promise<void>} A promise that resolves after the delay.
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
 * @param {Object} settings - The trigger settings object.
 * @param {string} prayer - The name of the prayer.
 * @param {string} event - The name of the event.
 * @param {Object} config - The current system configuration.
 * @returns {Promise<Object>} A promise that resolves to an object indicating success and providing the source.
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
        let exists = false;
        if (source.filePath) {
            try {
                await fs.promises.access(source.filePath);
                exists = true;
            } catch { /* ignore */ }
        }

        if (!exists) {
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
 * @param {Object} config - The current system configuration.
 * @param {Object} settings - The trigger settings object.
 * @returns {Object} An object containing the active targets and the maximum lead time required.
 */
const _getActiveTargets = (config, settings) => {
    const configuredTargets = settings.targets || [];
    const targets = new Set([...configuredTargets, 'browser']);
    
    let masterLeadTime = 0;
    const activeTargets = [];

    targets.forEach(targetId => {
        const outputConfig = config.automation?.outputs?.[targetId];
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
 * @param {Object} target - The target definition containing targetId and leadTime.
 * @param {number} masterLeadTime - The maximum lead time across all active targets.
 * @param {Object} payload - The execution payload.
 * @param {Object} executionMetadata - Metadata for the execution (e.g., isTest).
 * @returns {Promise<void>} A promise that resolves when the target execution is finished.
 */
const _executeTarget = async (target, masterLeadTime, payload, executionMetadata) => {
    const { targetId, leadTime } = target;
    try {
        const strategy = OutputFactory.getStrategy(targetId);
        const metadata = strategy.constructor.getMetadata();
        
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
 *
 * @param {string} prayer - The name of the prayer to trigger.
 * @param {string} event - The name of the event to trigger.
 * @returns {Promise<void>} A promise that resolves when all target executions have been settled.
 */
const triggerEvent = async (prayer, event) => {
    const config = configService.get();
    const settings = config.automation?.triggers?.[prayer]?.[event];
    
    if (!settings || !settings.enabled) {
        return;
    }

    const { success, source } = await _validateAndPrepareAudio(settings, prayer, event, config);
    if (!success) return;
    
    console.log(`[Automation] Triggering ${prayer} ${event}...`);
    sseService.broadcast({
        type: 'LOG',
        payload: { message: `Triggering ${prayer} ${event}`, timestamp: new Date().toISOString() }
    });

    const { activeTargets, masterLeadTime } = _getActiveTargets(config, settings);
    
    const payload = {
        prayer,
        event,
        source,
        baseUrl: config.automation.baseUrl
    };
    
    const executionMetadata = { isTest: false };

    const promises = activeTargets.map(target => 
        _executeTarget(target, masterLeadTime, payload, executionMetadata)
    );

    await Promise.allSettled(promises);
};

module.exports = {
    getAudioSource,
    triggerEvent
};