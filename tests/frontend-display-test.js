/**
 * Frontend Prayer Display Test
 * 
 * Tests the frontend prayer display updates for Task 11
 * - Tests prayer time display with data from both sources
 * - Verifies source information is shown correctly
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PRAYER_TIMES_PATH = path.join(__dirname, '../prayer_times.json');

/**
 * Read the prayer_times.json file
 * @returns {Object} The prayer times data
 */
function readPrayerTimesFile() {
    try {
        const data = fs.readFileSync(PRAYER_TIMES_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading prayer_times.json:', error);
        return null;
    }
}

/**
 * Test the prayer times data structure
 */
function testPrayerTimesStructure() {
    console.log('\n🧪 Test 1: Prayer Times Data Structure');
    
    const prayerTimes = readPrayerTimesFile();
    if (!prayerTimes) {
        console.error('❌ Failed to read prayer_times.json');
        return false;
    }
    
    // Check details object
    if (!prayerTimes.details) {
        console.error('❌ Missing details object in prayer_times.json');
        return false;
    }
    
    console.log('✅ Details object present');
    
    // Check source API
    if (!prayerTimes.details.sourceApi) {
        console.error('❌ Missing sourceApi in details');
        return false;
    }
    
    console.log(`✅ Source API: ${prayerTimes.details.sourceApi}`);
    
    // Check source-specific details
    if (prayerTimes.details.sourceApi === 'mymasjid') {
        console.log(`✅ Masjid Name: ${prayerTimes.details.masjidName || 'Not specified'}`);
        console.log(`✅ Guild ID: ${prayerTimes.details.guildId || 'Not specified'}`);
    } else if (prayerTimes.details.sourceApi === 'aladhan') {
        console.log(`✅ Latitude: ${prayerTimes.details.latitude}`);
        console.log(`✅ Longitude: ${prayerTimes.details.longitude}`);
        console.log(`✅ Timezone: ${prayerTimes.details.timezone}`);
        console.log(`✅ Calculation Method: ${prayerTimes.details.calculationMethodName}`);
    }
    
    // Check salahTimings array
    if (!prayerTimes.salahTimings || !Array.isArray(prayerTimes.salahTimings)) {
        console.error('❌ Missing or invalid salahTimings array');
        return false;
    }
    
    console.log(`✅ salahTimings array present with ${prayerTimes.salahTimings.length} entries`);
    
    // Check first entry
    const firstEntry = prayerTimes.salahTimings[0];
    if (!firstEntry) {
        console.error('❌ No entries in salahTimings array');
        return false;
    }
    
    console.log('✅ Sample prayer times entry:');
    console.log(`   Day: ${firstEntry.day}, Month: ${firstEntry.month}`);
    console.log(`   Fajr: ${firstEntry.fajr}, Iqamah: ${firstEntry.iqamah_fajr}`);
    console.log(`   Zuhr: ${firstEntry.zuhr}, Iqamah: ${firstEntry.iqamah_zuhr}`);
    console.log(`   Asr: ${firstEntry.asr}, Iqamah: ${firstEntry.iqamah_asr}`);
    console.log(`   Maghrib: ${firstEntry.maghrib}, Iqamah: ${firstEntry.iqamah_maghrib}`);
    console.log(`   Isha: ${firstEntry.isha}, Iqamah: ${firstEntry.iqamah_isha}`);
    
    return true;
}

/**
 * Test the API endpoint response
 */
async function testApiEndpoint() {
    console.log('\n🧪 Test 2: API Endpoint Response');
    
    try {
        // Import fetch for Node.js environment
        const fetch = (await import('node-fetch')).default;
        
        // Start the server (this is just a simulation, in reality you would need to start the server separately)
        console.log('ℹ️ Note: This test assumes the server is already running on http://localhost:3002');
        console.log('ℹ️ If the server is not running, please start it before running this test');
        
        // Fetch prayer times
        console.log('🔄 Fetching prayer times from API...');
        const response = await fetch('http://localhost:3002/api/prayer-times');
        
        if (!response.ok) {
            console.error(`❌ API request failed with status ${response.status}`);
            return false;
        }
        
        const data = await response.json();
        console.log('✅ API request successful');
        
        // Debug: Print the actual response data
        console.log('📄 API Response Data:');
        console.log(JSON.stringify(data, null, 2));
        
        // Check structure - note that nextPrayer can be null if all prayers for the day have passed
        if (!data.startTimes || !data.iqamahTimes || data.nextPrayer === undefined) {
            console.error('❌ Missing required fields in API response');
            return false;
        }
        
        console.log('✅ API response contains required fields');
        
        // Check source information
        if (!data.source) {
            console.error('❌ Missing source information in API response');
            return false;
        }
        
        console.log('✅ Source information present in API response:');
        console.log(`   Source Type: ${data.source.sourceType}`);
        
        if (data.source.sourceType === 'mymasjid') {
            console.log(`   Masjid Name: ${data.source.masjidName || 'Not specified'}`);
            console.log(`   Guild ID: ${data.source.guildId || 'Not specified'}`);
        } else if (data.source.sourceType === 'aladhan') {
            console.log(`   Latitude: ${data.source.latitude}`);
            console.log(`   Longitude: ${data.source.longitude}`);
            console.log(`   Timezone: ${data.source.timezone}`);
            console.log(`   Calculation Method: ${data.source.calculationMethod}`);
        }
        
        return true;
    } catch (error) {
        console.error('❌ Error testing API endpoint:', error);
        return false;
    }
}

/**
 * Run all tests
 */
async function runTests() {
    console.log('🚀 Starting Frontend Prayer Display Tests');
    
    let success = true;
    
    // Test prayer times data structure
    if (!testPrayerTimesStructure()) {
        success = false;
    }
    
    // Test API endpoint response
    try {
        if (!await testApiEndpoint()) {
            success = false;
        }
    } catch (error) {
        console.error('❌ Error running API endpoint test:', error);
        success = false;
    }
    
    console.log(`\n${success ? '✅ All tests passed' : '❌ Some tests failed'}`);
}

// Run tests
runTests().catch(console.error); 