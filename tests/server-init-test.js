/**
 * Server Initialization Logic Test
 * 
 * Tests the server initialization logic for Task 10
 * - Tests server startup with missing config.json
 * - Tests server startup with invalid config.json
 * - Tests initialization of prayer services after setup
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initialiseServer, initializePrayerServices } from '../src/server/server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.join(__dirname, '../config.json');
const PRAYER_TIMES_PATH = path.join(__dirname, '../prayer_times.json');
const BACKUP_DIR = path.join(__dirname, '../backups');
const BACKUP_CONFIG_PATH = path.join(__dirname, '../config.json.bak');
const BACKUP_PRAYER_TIMES_PATH = path.join(__dirname, '../prayer_times.json.bak');

/**
 * Backup configuration files
 */
function backupFiles() {
    console.log('📦 Backing up configuration files...');
    
    if (fs.existsSync(CONFIG_PATH)) {
        fs.copyFileSync(CONFIG_PATH, BACKUP_CONFIG_PATH);
        console.log('✅ Backed up config.json');
    } else {
        console.log('⚠️ No config.json to back up');
    }
    
    if (fs.existsSync(PRAYER_TIMES_PATH)) {
        fs.copyFileSync(PRAYER_TIMES_PATH, BACKUP_PRAYER_TIMES_PATH);
        console.log('✅ Backed up prayer_times.json');
    } else {
        console.log('⚠️ No prayer_times.json to back up');
    }
}

/**
 * Restore configuration files
 */
function restoreFiles() {
    console.log('🔄 Restoring configuration files...');
    
    if (fs.existsSync(BACKUP_CONFIG_PATH)) {
        fs.copyFileSync(BACKUP_CONFIG_PATH, CONFIG_PATH);
        fs.unlinkSync(BACKUP_CONFIG_PATH);
        console.log('✅ Restored config.json');
    } else {
        console.log('⚠️ No config.json backup to restore');
        
        // If no backup but original exists, delete it
        if (fs.existsSync(CONFIG_PATH)) {
            fs.unlinkSync(CONFIG_PATH);
            console.log('🗑️ Deleted config.json');
        }
    }
    
    if (fs.existsSync(BACKUP_PRAYER_TIMES_PATH)) {
        fs.copyFileSync(BACKUP_PRAYER_TIMES_PATH, PRAYER_TIMES_PATH);
        fs.unlinkSync(BACKUP_PRAYER_TIMES_PATH);
        console.log('✅ Restored prayer_times.json');
    } else {
        console.log('⚠️ No prayer_times.json backup to restore');
        
        // If no backup but original exists, delete it
        if (fs.existsSync(PRAYER_TIMES_PATH)) {
            fs.unlinkSync(PRAYER_TIMES_PATH);
            console.log('🗑️ Deleted prayer_times.json');
        }
    }
}

/**
 * Create an invalid config file
 */
function createInvalidConfig() {
    console.log('📝 Creating invalid config.json...');
    fs.writeFileSync(CONFIG_PATH, '{"invalid": "config"}', 'utf8');
    console.log('✅ Created invalid config.json');
}

/**
 * Test server initialization with missing config
 */
async function testMissingConfig() {
    console.log('\n🧪 Test 1: Server initialization with missing config.json');
    
    // Delete config.json if it exists
    if (fs.existsSync(CONFIG_PATH)) {
        fs.unlinkSync(CONFIG_PATH);
        console.log('🗑️ Deleted config.json for test');
    }
    
    // Initialize server
    const result = await initialiseServer();
    
    console.log(`✅ Server initialization ${result ? 'succeeded' : 'failed'}`);
    console.log('Server should have started without Initialising prayer services');
    
    // Check if prayer services initialization would fail
    const servicesResult = await initializePrayerServices();
    console.log(`Prayer services initialization ${servicesResult ? 'succeeded (unexpected)' : 'failed (expected)'}`);
    
    return result;
}

/**
 * Test server initialization with invalid config
 */
async function testInvalidConfig() {
    console.log('\n🧪 Test 2: Server initialization with invalid config.json');
    
    // Create invalid config.json
    createInvalidConfig();
    
    // Initialize server
    const result = await initialiseServer();
    
    console.log(`✅ Server initialization ${result ? 'succeeded' : 'failed'}`);
    console.log('Server should have started without Initialising prayer services');
    
    // Check if prayer services initialization would fail
    const servicesResult = await initializePrayerServices();
    console.log(`Prayer services initialization ${servicesResult ? 'succeeded (unexpected)' : 'failed (expected)'}`);
    
    return result;
}

/**
 * Run the tests
 */
async function runTests() {
    try {
        console.log('🚀 Starting Server Initialization Logic Tests');
        
        // Backup existing files
        backupFiles();
        
        // Run tests
        await testMissingConfig();
        await testInvalidConfig();
        
        console.log('\n✅ Tests completed');
    } catch (error) {
        console.error('\n❌ Tests failed with error:', error);
    } finally {
        // Restore files
        restoreFiles();
    }
}

// Run the tests
runTests().catch(console.error); 