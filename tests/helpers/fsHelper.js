const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const configService = require('@config'); 

const fsHelper = {
    tempDir: null,

    /**
     * Creates a temporary directory with a valid default.json
     * and injects the paths into the ConfigService singleton.
     * @returns {Promise<string>} Path to temp directory
     */
    async createTempConfig() {
        // Create a temporary directory
        this.tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'azan-test-'));
        
        // Define paths
        const configPath = path.join(this.tempDir, 'default.json');
        const localPath = path.join(this.tempDir, 'local.json');

        // Write a valid default.json (using minimal valid structure derived from default.json)
        const defaultConfig = {
             "location": { "timezone": "Europe/London", "coordinates": { "lat": 51.5, "long": -0.1 } },
             "calculation": { "method": "MoonsightingCommittee", "madhab": "Hanafi" },
             "prayers": {
                "fajr":    { "iqamahOffset": 20, "roundTo": 15, "fixedTime": null },
                "dhuhr":   { "iqamahOffset": 15, "roundTo": 15, "fixedTime": null },
                "asr":     { "iqamahOffset": 15, "roundTo": 15, "fixedTime": null },
                "maghrib": { "iqamahOffset": 10, "roundTo": 5,  "fixedTime": null },
                "isha":    { "iqamahOffset": 15, "roundTo": 15, "fixedTime": null }
             },
             "sources": { "primary": { "type": "aladhan" }, "backup": { "type": "mymasjid", "masjidId": "123" } },
             "data": { "staleCheckDays": 7 },
             "automation": { 
                 "baseUrl": "http://localhost", 
                 "audioPlayer": "mpg123", 
                 "pythonServiceUrl": "http://localhost:8000",
                 "voiceMonkey": { "enabled": false },
                 "triggers": {
                    "fajr": {
                        "preAdhan": { "enabled": false, "offsetMinutes": 15, "type": "tts", "template": "{minutes} minutes", "targets": ["local"] },
                        "adhan": { "enabled": false, "type": "file", "path": "adhan.mp3", "targets": ["local"] },
                        "preIqamah": { "enabled": false, "offsetMinutes": 5, "type": "tts", "template": "Iqamah in {minutes}", "targets": ["local"] },
                        "iqamah": { "enabled": false, "type": "tts", "template": "Time for Iqamah", "targets": ["local"] }
                    },
                    "sunrise": {
                        "preAdhan": { "enabled": false, "offsetMinutes": 15, "type": "tts", "template": "{minutes} minutes", "targets": ["local"] },
                        "adhan": { "enabled": false, "type": "tts", "template": "Sunrise", "targets": ["local"] }
                    },
                    "dhuhr": {
                        "preAdhan": { "enabled": false, "offsetMinutes": 15, "type": "tts", "template": "{minutes} minutes", "targets": ["local"] },
                        "adhan": { "enabled": false, "type": "file", "path": "adhan.mp3", "targets": ["local"] },
                        "preIqamah": { "enabled": false, "offsetMinutes": 5, "type": "tts", "template": "Iqamah in {minutes}", "targets": ["local"] },
                        "iqamah": { "enabled": false, "type": "tts", "template": "Time for Iqamah", "targets": ["local"] }
                    },
                    "asr": {
                        "preAdhan": { "enabled": false, "offsetMinutes": 15, "type": "tts", "template": "{minutes} minutes", "targets": ["local"] },
                        "adhan": { "enabled": false, "type": "file", "path": "adhan.mp3", "targets": ["local"] },
                        "preIqamah": { "enabled": false, "offsetMinutes": 5, "type": "tts", "template": "Iqamah in {minutes}", "targets": ["local"] },
                        "iqamah": { "enabled": false, "type": "tts", "template": "Time for Iqamah", "targets": ["local"] }
                    },
                    "maghrib": {
                        "preAdhan": { "enabled": false, "offsetMinutes": 15, "type": "tts", "template": "{minutes} minutes", "targets": ["local"] },
                        "adhan": { "enabled": false, "type": "file", "path": "adhan.mp3", "targets": ["local"] },
                        "preIqamah": { "enabled": false, "offsetMinutes": 5, "type": "tts", "template": "Iqamah in {minutes}", "targets": ["local"] },
                        "iqamah": { "enabled": false, "type": "tts", "template": "Time for Iqamah", "targets": ["local"] }
                    },
                    "isha": {
                        "preAdhan": { "enabled": false, "offsetMinutes": 15, "type": "tts", "template": "{minutes} minutes", "targets": ["local"] },
                        "adhan": { "enabled": false, "type": "file", "path": "adhan.mp3", "targets": ["local"] },
                        "preIqamah": { "enabled": false, "offsetMinutes": 5, "type": "tts", "template": "Iqamah in {minutes}", "targets": ["local"] },
                        "iqamah": { "enabled": false, "type": "tts", "template": "Time for Iqamah", "targets": ["local"] }
                    }
                 }
             }
        };
        await fs.writeFile(configPath, JSON.stringify(defaultConfig));

        // Inject paths into ConfigService
        configService._configPath = configPath;
        configService._localPath = localPath;
        
        // Reset and Init
        configService.reset();
        return this.tempDir;
    },

    /**
     * Cleans up the temporary directory and resets ConfigService.
     */
    async cleanupTempConfig() {
        if (this.tempDir) {
            // Using force: true and recursive: true is equivalent to rm -rf
            await fs.rm(this.tempDir, { recursive: true, force: true });
            this.tempDir = null;
        }
        configService.reset();
    }
};

module.exports = fsHelper;
