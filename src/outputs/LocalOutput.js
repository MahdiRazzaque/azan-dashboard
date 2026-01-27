const BaseOutput = require('./BaseOutput');
const player = require('play-sound')({});
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const OutputFactory = require('./OutputFactory');

class LocalOutput extends BaseOutput {
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
                    type: 'string', 
                    label: 'Audio Player', 
                    default: 'mpg123', 
                    sensitive: false,
                    requiredForHealth: true,
                    subtext: "Only change this if you know what you're doing"
                }
            ]
        };
    }

    async execute(payload, metadata, signal) {
        const isTest = metadata?.isTest;
        const prefix = isTest ? '[Test Output: Local]' : '[Output: Local]';
        
        if (!payload.source) {
            return;
        }

        let filePath = payload.source.filePath;

        // Path Resolution for tests or File Manager previews
        if (!filePath) {
            if (payload.source.path) {
                filePath = path.join(__dirname, '../../public/audio', payload.source.path);
            } else if (payload.type && payload.filename) {
                filePath = path.join(__dirname, `../../public/audio/${payload.type}/${payload.filename}`);
            }
        }

        if (!filePath) {
            console.warn(`${prefix} Playback skipped: No filePath provided and could not resolve from metadata`);
            return;
        }

        console.log(`${prefix} Starting playback: ${path.basename(filePath)}`);

        const audioPlayer = (payload.params && payload.params.audioPlayer) || 'mpg123';

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

    async healthCheck(requestedParams) {
        console.log('[Output: Local] Starting health check');
        const ConfigService = require('../config');
        const config = ConfigService.get();
        
        // Use requested params (from UI test) or saved config or default
        const audioPlayer = (requestedParams && requestedParams.audioPlayer) || 
                           config.automation?.outputs?.local?.params?.audioPlayer || 
                           'mpg123';

        try {
            await new Promise((resolve, reject) => {
                exec(`${audioPlayer} --version`, (error) => {
                    if (error) reject(error);
                    else resolve();
                });
            });

            // Linux/Docker specific check
            if (process.platform === 'linux') {
                if (!fs.existsSync('/dev/snd')) {
                    // Check for Docker
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

    async verifyCredentials(credentials) {
        console.log('[Output: Local] Verifying credentials');
        console.log('[Output: Local] Verification: OK');
        return { success: true };
    }
}

// Auto-register
OutputFactory.register(LocalOutput);

module.exports = LocalOutput;
