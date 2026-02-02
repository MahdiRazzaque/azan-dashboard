const path = require('path');
const fs = require('fs');
const configService = require('@config'); // Singleton
const sseService = require('@services/system/sseService');
const audioAssetService = require('@services/system/audioAssetService');
const OutputFactory = require('@outputs');

const AUDIO_DIR = path.join(__dirname, '../../../public/audio');

/**
 * Resolves the audio source path and URL based on the trigger settings.
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
            } catch (e) {}
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
