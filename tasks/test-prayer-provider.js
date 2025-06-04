/**
 * Test script for the refactored prayer data provider
 */
import moment from 'moment';
import { initialisePrayerDataSource, getPrayerTimesData, getPrayerDataSourceInfo } from '../src/prayer/prayer-data-provider.js';

// Helper function to display prayer times
function displayPrayerTimes(times) {
    console.log('\nPrayer Times:');
    console.log('------------');
    console.log(`Fajr:    ${times.fajr}    (Iqamah: ${times.fajr_iqamah})`);
    console.log(`Sunrise: ${times.sunrise}`);
    console.log(`Zuhr:    ${times.zuhr}    (Iqamah: ${times.zuhr_iqamah})`);
    console.log(`Asr:     ${times.asr}     (Iqamah: ${times.asr_iqamah})`);
    console.log(`Maghrib: ${times.maghrib} (Iqamah: ${times.maghrib_iqamah})`);
    console.log(`Isha:    ${times.isha}    (Iqamah: ${times.isha_iqamah})`);
}

// Helper function to display source information
function displaySourceInfo(info) {
    console.log('\nPrayer Data Source:');
    console.log('------------------');
    console.log(`Source Type: ${info.sourceType}`);
    
    if (info.sourceType === 'mymasjid') {
        console.log(`Masjid Name: ${info.masjidName}`);
        console.log(`Guild ID: ${info.guildId}`);
    } else if (info.sourceType === 'aladhan') {
        console.log(`Location: ${info.latitude}, ${info.longitude}`);
        console.log(`Timezone: ${info.timezone}`);
        console.log(`Calculation Method: ${info.calculationMethod}`);
    }
    
    console.log(`Year: ${info.year}`);
}

async function runTest() {
    try {
        console.log('🧪 Testing refactored prayer data provider...');
        
        // Initialize the prayer data provider
        console.log('\nInitialising prayer data provider...');
        await initialisePrayerDataSource();
        
        // Get source information
        console.log('\nGetting prayer data source information...');
        const sourceInfo = getPrayerDataSourceInfo();
        displaySourceInfo(sourceInfo);
        
        // Get prayer times for today
        console.log('\nGetting prayer times for today...');
        const today = moment();
        const todayTimes = await getPrayerTimesData(today);
        displayPrayerTimes(todayTimes);
        
        // Get prayer times for tomorrow
        console.log('\nGetting prayer times for tomorrow...');
        const tomorrow = moment().add(1, 'day');
        const tomorrowTimes = await getPrayerTimesData(tomorrow);
        displayPrayerTimes(tomorrowTimes);
        
        console.log('\n✅ Test completed successfully!');
    } catch (error) {
        console.error('\n❌ Test failed:', error);
    }
}

// Run the test
runTest(); 