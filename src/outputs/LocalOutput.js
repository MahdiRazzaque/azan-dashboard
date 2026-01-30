const BaseOutput = require('./BaseOutput');
const player = require('play-sound')({});
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const AUDIO_ROOT = path.resolve(__dirname, '../../public/audio');
const ALLOWED_AUDIO_PLAYERS = ['mpg123', 'omxplayer', 'aplay', 'mplayer', 'cvlc'];

class LocalOutput extends BaseOutput {
    /**
     * Retrieves the metadata for the local audio output strategy.
     *
     * @returns {Object} The strategy metadata including ID, label, and parameters.
     */
    static getMetadata() {
        return {
            id: 'local',
            label: 'Local Audio',
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
     * Executes the audio playback locally on the server host using the configured audio player.
     *
     * @param {Object} payload - The execution payload containing audio source information.
     * @param {Object} metadata - Additional metadata for the execution.
     * @param {AbortSignal} signal - An optional signal to abort the playback.
     * @returns {Promise<void>} A promise that resolves when playback is complete.
     */
    async execute(payload, metadata, signal) {
        const isTest = metadata?.isTest;
        const prefix = isTest ? '[Test Output: Local]' : '[Output: Local]';

        if (!payload.source) {
            return;
        }

        let filePath = payload.source.filePath;

        // Path resolution for tests or File Manager previews.
        if (!filePath) {
            if (payload.source.path) {
                // Construct the absolute path based on the relative path provided in the source.
                filePath = path.resolve(__dirname, '../../public/audio', payload.source.path);
            } else if (payload.type && payload.filename) {
                // Fallback to constructing the path from type and filename if an explicit path is missing.
                filePath = path.join(__dirname, `../../public/audio/${payload.type}/${payload.filename}`);
            }
        }

        if (!filePath) {
            console.warn(`${prefix} Playback skipped: No filePath provided and could not resolve from metadata`);
            return;
        }

        // Security: Path traversal protection
        const normalizedPath = path.resolve(filePath);
        if (!normalizedPath.startsWith(AUDIO_ROOT)) {
            console.error(`${prefix} SECURITY WARNING: Path traversal attempt blocked: ${payload.source?.path || filePath}`);
            throw new Error('Invalid audio path: Access denied');
        }
        filePath = normalizedPath;

        const audioPlayer = (payload.params && payload.params.audioPlayer) || 'mpg123';

        // Security: Audio player allowlist validation
        if (!ALLOWED_AUDIO_PLAYERS.includes(audioPlayer)) {
            console.error(`${prefix} SECURITY WARNING: Invalid audio player rejected: ${audioPlayer}`);
            throw new Error('Invalid audio player');
        }

        console.log(`${prefix} Starting playback: ${path.basename(filePath)}`);

        return new Promise((resolve, reject) => {
            const audioProcess = player.play(filePath, { player: audioPlayer }, (err) => {
                if (err) {
                    if (err.killed) {
                        console.warn(`${prefix} Playback killed due to timeout or manual abort`);
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
     * Performs a health check for the local audio output by verifying the availability 
     * of the audio player and access to audio hardware on Linux systems.
     *
     * @param {Object} requestedParams - The parameters to check.
     * @returns {Promise<Object>} The health status result.
     */
    async healthCheck(requestedParams) {
        console.log('[Output: Local] Starting health check');
        const ConfigService = require('../config');
        const config = ConfigService.get();

        // Use requested params (from UI test) or saved config or default
        const audioPlayer = (requestedParams && requestedParams.audioPlayer) ||
                           config.automation?.outputs?.local?.params?.audioPlayer ||
                           'mpg123';

        // Security: Audio player allowlist validation
        if (!ALLOWED_AUDIO_PLAYERS.includes(audioPlayer)) {
            console.warn(`[Output: Local] Health: Offline (Invalid Audio Player: ${audioPlayer})`);
            return { healthy: false, message: 'Invalid Audio Player' };
        }

        try {
            await new Promise((resolve, reject) => {
                execFile(audioPlayer, ['--version'], (error) => {
                    if (error) reject(error);
                    else resolve();
                });
            });

            // Linux-specific check for audio hardware access, particularly relevant in Docker environments.
            if (process.platform === 'linux') {
                if (!fs.existsSync('/dev/snd')) {
                    // Detect if the application is running inside a Docker container.
                    let isDocker = false;
                    try {
                         if (fs.existsSync('/.dockerenv')) {
                             isDocker = true;
                         } else {
                             const cgroup = fs.readFileSync('/proc/1/cgroup', 'utf8');
                             if (cgroup.includes('docker')) isDocker = true;
                         }
                    } catch (e) { }

                    if (isDocker) {
                        console.log('[Output: Local] Health: Offline (Docker: No Audio HW)');
                        return { healthy: false, message: 'Docker: No Audio HW' };
                    }
                    console.log('[Output: Local] Health: Offline (No Audio Device)');
                    return { healthy: false, message: 'No Audio Device' };
                }
            }

            console.log('[Output: Local] Health: Ready');
            return { healthy: true, message: 'Ready' };
        } catch (e) {
            console.log(`[Output: Local] Health: Offline (${audioPlayer} Not Found)`);
            return { healthy: false, message: `${audioPlayer} Not Found` };
        }
    }

    /**
     * Verifies the credentials for the local audio output strategy. 
     * As no credentials are typically required, this always returns a successful result.
     *
     * @param {Object} credentials - The credentials to verify.
     * @returns {Promise<Object>} The verification result.
     */
    async verifyCredentials(credentials) {
        console.log('[Output: Local] Verifying credentials');
        console.log('[Output: Local] Verification: OK');
        return { success: true };
    }
}

module.exports = LocalOutput;
