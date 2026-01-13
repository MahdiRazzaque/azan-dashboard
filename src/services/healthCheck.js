const { exec } = require('child_process');
const axios = require('axios');

async function checkSystemHealth() {
    console.log('Performing System Health Check...');
    const results = {
        mpg123: false,
        ttsService: false
    };

    // Check 1: mpg123
    try {
        await new Promise((resolve, reject) => {
            exec('mpg123 --version', (error) => {
                if (error) reject(error);
                else resolve();
            });
        });
        results.mpg123 = true;
        console.log('✅ mpg123 is installed and available.');
    } catch (e) {
        console.warn('⚠️ mpg123 not found. Local audio playback will fail.');
    }

    // Check 2: Python TTS Service
    // Checks standard port 8000
    try {
        await axios.get('http://127.0.0.1:8000/docs', { timeout: 2000 });
        results.ttsService = true;
        console.log('✅ Python TTS Service is reachable.');
    } catch (e) {
        console.warn('⚠️ Python TTS Service not reachable (http://127.0.0.1:8000). TTS generation will fail.');
    }

    return results;
}

module.exports = { checkSystemHealth };
