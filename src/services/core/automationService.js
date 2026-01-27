const path = require('path');
const configService = require('@config'); // Singleton
const sseService = require('@services/system/sseService');
const OutputFactory = require('../../outputs');

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
 * Main entry point for triggering an automated prayer event.
 * Orchestrates output strategies.
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

    console.log(`[Automation] Triggering ${prayer} ${event}...`);
    
    sseService.broadcast({
        type: 'LOG',
        payload: { message: `Triggering ${prayer} ${event}`, timestamp: new Date().toISOString() }
    });

    const source = getAudioSource(settings, prayer, event);
    
    // Configured targets
    const configuredTargets = settings.targets || [];
    
    // Always include browser (implicit dispatch)
    const targets = new Set([...configuredTargets, 'browser']);
    
    // Calculate Master Lead Time
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

    const payload = {
        prayer,
        event,
        source,
        baseUrl: config.automation.baseUrl
    };
    
    const executionMetadata = { isTest: false };

    // Execute targets with stagger delays
    const promises = activeTargets.map(async ({ targetId, leadTime }) => {
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
            console.error(`[Automation] Error executing target '${targetId}' for ${prayer} ${event}:`, error.message);
        }
    });

    await Promise.allSettled(promises);
};

// Deprecated: Credentials verification is now handled by OutputFactory/Strategies and SystemController.
// Keeping export if needed but implementing as error or redirect?
// Ideally remove it.

module.exports = {
    getAudioSource,
    triggerEvent
};