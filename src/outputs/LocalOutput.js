const BaseOutput = require('./BaseOutput');
const player = require('play-sound')({});
const { execFile } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

const AUDIO_ROOT = path.resolve(__dirname, '../../public/audio');
const ALLOWED_AUDIO_PLAYERS = ['mpg123', 'omxplayer', 'aplay', 'mplayer', 'cvlc'];

/**
 * Strategy for playing audio locally on the server host.
 */
class LocalOutput extends BaseOutput {

    /**
     * Helper to detect if running in WSL (Windows Subsystem for Linux)
     */
    async _isWSL() {
        if (process.platform !== 'linux') return false;
        try {
            const version = await fs.readFile('/proc/version', 'utf8');
            return version.toLowerCase().includes('microsoft') || version.toLowerCase().includes('wsl');
        } catch (e) {
            return false;
        }
    }

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

        if (!payload.source) return;

        let filePath = payload.source.filePath;

        // Path resolution logic
        if (!filePath) {
            if (payload.source.path) {
                filePath = path.resolve(__dirname, '../../public/audio', payload.source.path);
            } else if (payload.type && payload.filename) {
                filePath = path.join(__dirname, `../../public/audio/${payload.type}/${payload.filename}`);
            }
        }

        if (!filePath) {
            console.warn(`${prefix} Playback skipped: No filePath provided`);
            return;
        }

        // Security: Path traversal protection
        const normalizedPath = path.resolve(filePath);
        if (!normalizedPath.startsWith(AUDIO_ROOT)) {
            console.error(`${prefix} SECURITY WARNING: Path traversal attempt blocked`);
            throw new Error('Invalid audio path: Access denied');
        }
        filePath = normalizedPath;

        const audioPlayer = (payload.params && payload.params.audioPlayer) || 'mpg123';

        if (!ALLOWED_AUDIO_PLAYERS.includes(audioPlayer)) {
            throw new Error('Invalid audio player');
        }

        console.log(`${prefix} Starting playback: ${path.basename(filePath)}`);

        // Detect WSL and inject the PulseAudio flag if using mpg123
        const isWsl = await this._isWSL();
        const playOptions = { player: audioPlayer };

        if (isWsl && audioPlayer === 'mpg123') {
            // "play-sound" library allows passing player-specific args using the player name as the key
            playOptions.mpg123 = ['-o', 'pulse'];
            console.log(`${prefix} WSL detected: Forcing mpg123 pulse output`);
        }
        // --- WSL FIX END ---

        return new Promise((resolve, reject) => {
            const audioProcess = player.play(filePath, playOptions, (err) => {
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

        const audioPlayer = (requestedParams && requestedParams.audioPlayer) ||
                           config.automation?.outputs?.local?.params?.audioPlayer ||
                           'mpg123';

        if (!ALLOWED_AUDIO_PLAYERS.includes(audioPlayer)) {
            return { healthy: false, message: 'Invalid Audio Player' };
        }

        try {
            // 1. Check if player binary exists
            await new Promise((resolve, reject) => {
                execFile(audioPlayer, ['--version'], (error) => {
                    if (error) reject(error);
                    else resolve();
                });
            });

            // 2. Hardware Access Check (Modified for WSL)
            if (process.platform === 'linux') {
                const isWsl = await this._isWSL();
                
                if (isWsl) {
                    // --- WSL FIX ---
                    console.log('[Output: Local] WSL Environment detected - Bypassing /dev/snd check');
                } else {
                    // Standard Linux Check
                    console.log('[Output: Local] Checking for audio hardware access');
                    let hasSnd = true;
                    try {
                        await fs.access('/dev/snd');
                    } catch (e) {
                        hasSnd = false;
                    }

                    if (!hasSnd) {
                        // Docker check logic...
                        let isDocker = false;
                        try {
                            await fs.access('/.dockerenv');
                            isDocker = true;
                        } catch (e) {
                            try {
                                const cgroup = await fs.readFile('/proc/1/cgroup', 'utf8');
                                if (cgroup.includes('docker')) isDocker = true;
                            } catch (err) {}
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
        return { success: true };
    }

    /**
     * Validates an audio asset for compatibility with local playback.
     * Local playback is generally considered compatible with all audio formats supported by the installed player.
     * 
     * @param {string} filePath - Path to the audio file.
     * @param {Object} metadata - Audio metadata.
     * @returns {Promise<{valid: boolean, lastChecked: string, issues: string[]}>} A promise that resolves to the validation result.
     */
    async validateAsset(filePath, metadata) {
        return {
            valid: true,
            lastChecked: new Date().toISOString(),
            issues: []
        };
    }
}

module.exports = LocalOutput;