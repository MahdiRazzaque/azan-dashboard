/**
 * Prayer Configuration Save and Data Refresh Test
 * 
 * Tests the functionality of the prayer-config-manager.js module
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { updatePrayerSourceConfig, getAllPrayerSourceSettings } from '../src/prayer/prayer-config-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.join(__dirname, '../config.json');
const PRAYER_TIMES_PATH = path.join(__dirname, '../prayer_times.json');
const BACKUP_DIR = path.join(__dirname, '../backups');

// Helper function to check if backups were created
function findLatestBackup() {
    if (!fs.existsSync(BACKUP_DIR)) {
        return null;
    }
    
    const backupDirs = fs.readdirSync(BACKUP_DIR)
        .filter(dir => dir.startsWith('backup-'))
        .sort()
        .reverse();
    
    return backupDirs.length > 0 ? path.join(BACKUP_DIR, backupDirs[0]) : null;
}

// Helper function to read config
function readConfig() {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

// Helper function to read prayer times
function readPrayerTimes() {
    return JSON.parse(fs.readFileSync(PRAYER_TIMES_PATH, 'utf8'));
}

async function runTests() {
    console.log('🧪 Starting Prayer Configuration Save and Data Refresh Tests');
    
    try {
        // Test 1: Get all prayer source settings
        console.log('\n📋 Test 1: Get all prayer source settings');
        const allSettings = await getAllPrayerSourceSettings();
        console.log('Current source:', allSettings.source);
        console.log('MyMasjid settings:', allSettings.mymasjid);
        console.log('Aladhan settings:', allSettings.aladhan ? 'Available' : 'Not available');
        
        // Test 2: Update to MyMasjid source (if not already)
        if (allSettings.source !== 'mymasjid' && allSettings.mymasjid?.guildId) {
            console.log('\n📋 Test 2: Switch to MyMasjid source');
            
            const myMasjidSettings = {
                source: 'mymasjid',
                guildId: allSettings.mymasjid.guildId
            };
            
            console.log('Updating to MyMasjid source with guildId:', myMasjidSettings.guildId);
            const result = await updatePrayerSourceConfig(myMasjidSettings);
            
            console.log('Update result:', result.success ? '✅ Success' : '❌ Failed');
            console.log('Message:', result.message);
            
            if (!result.success) {
                console.error('Error details:', result.error);
            } else {
                // Verify config was updated
                const updatedConfig = readConfig();
                console.log('Updated source in config:', updatedConfig.prayerData.source);
                
                // Verify prayer times were refreshed
                const prayerTimes = readPrayerTimes();
                console.log('Prayer times source API:', prayerTimes.details.sourceApi);
                
                // Check if backup was created
                const latestBackup = findLatestBackup();
                console.log('Backup created:', latestBackup ? '✅ Yes' : '❌ No');
            }
        } else {
            console.log('\n📋 Test 2: Skipped (already using MyMasjid source or no guildId available)');
        }
        
        // Test 3: Update to Aladhan source (if not already)
        if (allSettings.source !== 'aladhan') {
            console.log('\n📋 Test 3: Switch to Aladhan source');
            
            // Use New York City coordinates as a valid test case
            const aladhanSettings = {
                source: 'aladhan',
                latitude: 40.7128,
                longitude: -74.0060,
                timezone: 'America/New_York',
                calculationMethodId: 2, // ISNA
                asrJuristicMethodId: 0, // Shafi'i
                latitudeAdjustmentMethodId: 3, // Angle Based
                midnightModeId: 0, // Standard
                iqamahOffsets: {
                    fajr: 20,
                    zuhr: 10,
                    asr: 10,
                    maghrib: 5,
                    isha: 15
                }
            };
            
            console.log('Updating to Aladhan source with coordinates:', 
                aladhanSettings.latitude, aladhanSettings.longitude);
            const result = await updatePrayerSourceConfig(aladhanSettings);
            
            console.log('Update result:', result.success ? '✅ Success' : '❌ Failed');
            console.log('Message:', result.message);
            
            if (!result.success) {
                console.error('Error details:', result.error);
            } else {
                // Verify config was updated
                const updatedConfig = readConfig();
                console.log('Updated source in config:', updatedConfig.prayerData.source);
                
                // Verify prayer times were refreshed
                const prayerTimes = readPrayerTimes();
                console.log('Prayer times source API:', prayerTimes.details.sourceApi);
                
                // Check if backup was created
                const latestBackup = findLatestBackup();
                console.log('Backup created:', latestBackup ? '✅ Yes' : '❌ No');
            }
        } else {
            console.log('\n📋 Test 3: Skipped (already using Aladhan source)');
        }
        
        // Test 4: Test validation with invalid settings
        console.log('\n📋 Test 4: Test validation with invalid settings');
        
        const invalidSettings = {
            source: 'aladhan',
            latitude: 200, // Invalid latitude (out of range)
            longitude: 45,
            timezone: 'UTC',
            calculationMethodId: 2,
            asrJuristicMethodId: 0,
            latitudeAdjustmentMethodId: 3,
            midnightModeId: 0,
            iqamahOffsets: {
                fajr: 20,
                zuhr: 10,
                asr: 10,
                maghrib: 5,
                isha: 15
            }
        };
        
        const validationResult = await updatePrayerSourceConfig(invalidSettings);
        console.log('Validation result:', validationResult.success ? '❌ Unexpectedly passed' : '✅ Failed as expected');
        console.log('Message:', validationResult.message);
        
        if (!validationResult.success) {
            console.log('Error type:', validationResult.error?.type);
            if (validationResult.error?.details) {
                console.log('Validation errors:', validationResult.error.details.map(e => `${e.field}: ${e.message}`).join(', '));
            }
        }
        
        console.log('\n✅ Tests completed');
    } catch (error) {
        console.error('\n❌ Test failed with error:', error);
    }
}

runTests().catch(console.error); 