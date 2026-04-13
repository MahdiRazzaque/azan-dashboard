const BaseOutput = require('./BaseOutput');
const player = require('play-sound')({});
const { execFile } = require('child_process');
const fs = require('fs').promises;

const ALLOWED_AUDIO_PLAYERS = ['mpg123', 'omxplayer', 'aplay', 'mplayer', 'cvlc'];

/**
 * Strategy for playing audio locally on the server host.
 */
class LocalOutput extends BaseOutput {

    /**
      * Helper to detect if running in WSL (Windows Subsystem for Linux).
      * @returns {Promise<boolean>} True if running in WSL, false otherwise.
      */
    async _isWSL() {
        if (process.platform !== 'linux') return false;
        try {
            const version = await fs.readFile('/proc/version', 'utf8');
            return version.toLowerCase().includes('microsoft') || version.toLowerCase().includes('wsl');
        } catch {
            return false;
        }
    }

    /**
     * Retrieves the metadata for the local audio output strategy.
     * @returns {Object} The metadata object containing configuration details.
     */
    static getMetadata() {
        return {
            id: 'local',
            label: 'Local Audio',
            supportedSourceTypes: ['file', 'url'],
            timeoutMs: 30000,
            defaultLeadTimeMs: 0,
            hidden: false,
            params: [
                {
                    key: 'audioPlayer',
                    type: 'select',
                    label: 'Audio Player',
                    default: 'mpg123',
                    options: ALLOWED_AUDIO_PLAYERS,
                    sensitive: false,
                    requiredForHealth: true,
                    subtext: "Only change this if you know what you're doing"
                }
            ]
        };
    }

    /**
     * Plays audio from a local file.
     * @param {Object} payload - Payload with normalized source ({ type: 'file', filePath, url }).
     * @param {Object} metadata - Execution metadata.
     * @param {AbortSignal} [signal] - Abort signal.
     * @returns {Promise<void>}
     */
    async _executeFromFile(payload, metadata, signal) {
        return this._playAudio(payload.source.filePath, payload, metadata, signal);
    }

    /**
     * Plays audio from a remote URL (mpg123 supports HTTP/HTTPS natively).
     * @param {Object} payload - Payload with normalized source ({ type: 'url', url }).
     * @param {Object} metadata - Execution metadata.
     * @param {AbortSignal} [signal] - Abort signal.
     * @returns {Promise<void>}
     */
    async _executeFromUrl(payload, metadata, signal) {
        return this._playAudio(payload.source.url, payload, metadata, signal);
    }

    /**
     * Core playback logic shared by both file and URL sources.
     * @param {string} audioSource - File path or URL to play.
     * @param {Object} payload - Full execution payload.
     * @param {Object} metadata - Execution metadata.
     * @param {AbortSignal} [signal] - Abort signal.
     * @returns {Promise<void>}
     */
    async _playAudio(audioSource, payload, metadata, signal) {
        const isTest = metadata?.isTest;
        const prefix = isTest ? '[Test Output: Local]' : '[Output: Local]';

        const audioPlayer = (payload.params && payload.params.audioPlayer) || 'mpg123';

        if (!ALLOWED_AUDIO_PLAYERS.includes(audioPlayer)) {
            throw new Error('Invalid audio player');
        }

        console.log(`${prefix} Starting playback: ${path.basename(audioSource)}`);

        const isWsl = await this._isWSL();
        const playOptions = { player: audioPlayer };

        if (isWsl && audioPlayer === 'mpg123') {
            playOptions.mpg123 = ['-o', 'pulse'];
            console.log(`${prefix} WSL detected: Forcing mpg123 pulse output`);
        }

        return new Promise((resolve, reject) => {
            const audioProcess = player.play(audioSource, playOptions, (err) => {
                if (err) {
                    if (err.killed) {
                        console.warn(`${prefix} Playback killed`);
                    } else {
                        console.error(`${prefix} Playback failed: ${err.message}`);
                    }
                    reject(err);
                } else {
                    console.log(`${prefix} Playback complete`);
                    resolve();
                }
            });

            if (signal) {
                if (signal.aborted) {
                    audioProcess.kill();
                    reject(new Error('Playback aborted'));
                } else {
                    signal.addEventListener('abort', () => {
                        audioProcess.kill();
                        reject(new Error('Playback aborted'));
                    }, { once: true });
                }
            }
        });
    }

    /**
     * Performs a health check for the local audio output.
     * @param {Object} requestedParams - The parameters to check.
     * @returns {Promise<Object>} The health status result.
     */
    async healthCheck(requestedParams) {
        console.log('[Output: Local] Starting health check');
        const ConfigService = require('../config');
        const config = ConfigService.get();

        const audioPlayer = (requestedParams && requestedParams.audioPlayer) ||
                           config.automation?.outputs?.local?.params?.audioPlayer ||
                           'mpg123';

        if (!ALLOWED_AUDIO_PLAYERS.includes(audioPlayer)) {
            return { healthy: false, message: 'Invalid Audio Player' };
        }

        try {
            await new Promise((resolve, reject) => {
                execFile(audioPlayer, ['--version'], (error) => {
                    if (error) reject(error);
                    else resolve();
                });
            });

            if (process.platform === 'linux') {
                const isWsl = await this._isWSL();
                
                if (isWsl) {
                    console.log('[Output: Local] WSL Environment detected - Bypassing /dev/snd check');
                } else {
                    console.log('[Output: Local] Checking for audio hardware access');
                    let hasSnd = true;
                    try {
                        await fs.access('/dev/snd');
                    } catch {
                        hasSnd = false;
                    }

                    if (!hasSnd) {
                        let isDocker = false;
                        try {
                            await fs.access('/.dockerenv');
                            isDocker = true;
                        } catch {
                            try {
                                const cgroup = await fs.readFile('/proc/1/cgroup', 'utf8');
                                if (cgroup.includes('docker')) isDocker = true;
                            } catch { /* ignore */ }
                        }

                        if (isDocker) {
                            console.log('[Output: Local] Health: Offline (Docker: No Audio HW)');
                            return { healthy: false, message: 'Docker: No Audio HW' };
                        }
                        
                        console.log('[Output: Local] Health: Offline (No Audio Device)');
                        return { healthy: false, message: 'No Audio Device' };
                    }
                }
            }

            console.log('[Output: Local] Health: Ready');
            return { healthy: true, message: 'Ready' };
        } catch {
            console.log(`[Output: Local] Health: Offline (${audioPlayer} Not Found)`);
            return { healthy: false, message: `${audioPlayer} Not Found` };
        }
    }

    /**
      * Verifies credentials for local audio (no credentials required).
      * @param {Object} _credentials - The credentials to verify.
      * @returns {Promise<Object>} Success response object.
      */
    async verifyCredentials(_credentials) {
        return { success: true };
    }

    /**
      * Validates audio asset compatibility with local playback.
      * @param {string} _filePath - Path to the audio file.
      * @param {Object} _metadata - Audio metadata.
      * @returns {Promise<{valid: boolean, lastChecked: string, issues: string[]}>} Validation result with compatibility status.
      */
    async validateAsset(_filePath, _metadata) {
        return {
            valid: true,
            lastChecked: new Date().toISOString(),
            issues: []
        };
    }
}

module.exports = LocalOutput;
