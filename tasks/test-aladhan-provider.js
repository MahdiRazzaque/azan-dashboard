import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchAndSaveAladhanData } from '../src/prayer/aladhan-provider.js';
import { DEFAULT_ALADHAN_CONFIG } from '../src/prayer/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configuration with London coordinates
const testConfig = {
    ...DEFAULT_ALADHAN_CONFIG,
    latitude: 51.5074,
    longitude: -0.1278,
    timezone: 'Europe/London'
};

// Test file path
const testFilePath = path.join(__dirname, '../test-prayer-times.json');

async function runTest() {
    console.log('🧪 Testing Aladhan provider with London coordinates...');
    
    try {
        // Fetch and save prayer times
        const data = await fetchAndSaveAladhanData(testConfig, testFilePath);
        
        console.log('✅ Successfully fetched and saved prayer times!');
        console.log(`📊 Data contains ${data.salahTimings.length} days of prayer times.`);
        
        // Display sample data for verification
        const sampleDay = data.salahTimings[0];
        console.log('\n📅 Sample day (first day in data):');
        console.log(`Date: Day ${sampleDay.day}, Month ${sampleDay.month}`);
        console.log(`Fajr: ${sampleDay.fajr}, Iqamah: ${sampleDay.iqamah_fajr}`);
        console.log(`Zuhr: ${sampleDay.zuhr}, Iqamah: ${sampleDay.iqamah_zuhr}`);
        console.log(`Asr: ${sampleDay.asr}, Iqamah: ${sampleDay.iqamah_asr}`);
        console.log(`Maghrib: ${sampleDay.maghrib}, Iqamah: ${sampleDay.iqamah_maghrib}`);
        console.log(`Isha: ${sampleDay.isha}, Iqamah: ${sampleDay.iqamah_isha}`);
        
        console.log('\n🔍 Verifying data structure...');
        if (data.details.sourceApi === 'aladhan' && 
            data.details.latitude === testConfig.latitude &&
            data.details.longitude === testConfig.longitude &&
            data.details.timezone === testConfig.timezone &&
            data.validated === true) {
            console.log('✅ Data structure verified!');
        } else {
            console.error('❌ Data structure verification failed!');
            console.error('Expected sourceApi: aladhan, got:', data.details.sourceApi);
            console.error('Expected latitude:', testConfig.latitude, 'got:', data.details.latitude);
            console.error('Expected longitude:', testConfig.longitude, 'got:', data.details.longitude);
            console.error('Expected timezone:', testConfig.timezone, 'got:', data.details.timezone);
            console.error('Expected validated: true, got:', data.validated);
        }
        
        // Clean up test file
        console.log('\n🧹 Cleaning up test file...');
        fs.unlinkSync(testFilePath);
        console.log('✅ Test file deleted.');
        
        console.log('\n✅ Test completed successfully!');
    } catch (error) {
        console.error('❌ Test failed:', error);
        
        // Clean up test file if it exists
        if (fs.existsSync(testFilePath)) {
            try {
                fs.unlinkSync(testFilePath);
                console.log('🧹 Test file deleted despite error.');
            } catch (e) {
                console.error('Failed to delete test file:', e);
            }
        }
    }
}

runTest(); 