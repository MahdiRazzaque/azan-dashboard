import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { 
    CALCULATION_METHODS,
    ASR_JURISTIC_METHODS,
    LATITUDE_ADJUSTMENT_METHODS,
    MIDNIGHT_MODES
} from './aladhan/constants.js';
import { API_BASE_URL } from './aladhan/constants.js';

/**
 * Validates our constants against the Aladhan API by making test requests
 * with different parameters and checking for successful responses.
 */
async function validateConstants() {
    console.log('🔍 Validating Aladhan API constants...');
    
    try {
        // Test location (London)
        const testParams = {
            latitude: 51.5074,
            longitude: -0.1278,
            date: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD format
            timezone: 'Europe/London'
        };
        
        // Test each calculation method
        console.log('Testing calculation methods...');
        for (const [methodId, methodName] of Object.entries(CALCULATION_METHODS)) {
            try {
                const params = new URLSearchParams({
                    ...testParams,
                    method: methodId
                });
                
                const url = `${API_BASE_URL}/timings/${testParams.date}?${params.toString()}`;
                const response = await fetch(url);
                
                if (!response.ok) {
                    console.error(`❌ Method ${methodId} (${methodName}) failed: ${response.status} ${response.statusText}`);
                    continue;
                }
                
                const data = await response.json();
                if (data.code !== 200 || !data.data) {
                    console.error(`❌ Method ${methodId} (${methodName}) returned invalid data: ${JSON.stringify(data)}`);
                    continue;
                }
                
                console.log(`✅ Method ${methodId} (${methodName}) validated successfully`);
            } catch (error) {
                console.error(`❌ Error testing method ${methodId} (${methodName}):`, error.message);
            }
        }
        
        // Test each Asr juristic method
        console.log('\nTesting Asr juristic methods...');
        for (const [methodId, methodName] of Object.entries(ASR_JURISTIC_METHODS)) {
            try {
                const params = new URLSearchParams({
                    ...testParams,
                    method: 3, // Use MWL as default calculation method
                    school: methodId
                });
                
                const url = `${API_BASE_URL}/timings/${testParams.date}?${params.toString()}`;
                const response = await fetch(url);
                
                if (!response.ok) {
                    console.error(`❌ Asr method ${methodId} (${methodName}) failed: ${response.status} ${response.statusText}`);
                    continue;
                }
                
                const data = await response.json();
                if (data.code !== 200 || !data.data) {
                    console.error(`❌ Asr method ${methodId} (${methodName}) returned invalid data: ${JSON.stringify(data)}`);
                    continue;
                }
                
                console.log(`✅ Asr method ${methodId} (${methodName}) validated successfully`);
            } catch (error) {
                console.error(`❌ Error testing Asr method ${methodId} (${methodName}):`, error.message);
            }
        }
        
        // Test each latitude adjustment method
        console.log('\nTesting latitude adjustment methods...');
        for (const [methodId, methodName] of Object.entries(LATITUDE_ADJUSTMENT_METHODS)) {
            try {
                const params = new URLSearchParams({
                    ...testParams,
                    method: 3, // Use MWL as default calculation method
                    latitudeAdjustmentMethod: methodId
                });
                
                const url = `${API_BASE_URL}/timings/${testParams.date}?${params.toString()}`;
                const response = await fetch(url);
                
                if (!response.ok) {
                    console.error(`❌ Latitude adjustment ${methodId} (${methodName}) failed: ${response.status} ${response.statusText}`);
                    continue;
                }
                
                const data = await response.json();
                if (data.code !== 200 || !data.data) {
                    console.error(`❌ Latitude adjustment ${methodId} (${methodName}) returned invalid data: ${JSON.stringify(data)}`);
                    continue;
                }
                
                console.log(`✅ Latitude adjustment ${methodId} (${methodName}) validated successfully`);
            } catch (error) {
                console.error(`❌ Error testing latitude adjustment ${methodId} (${methodName}):`, error.message);
            }
        }
        
        // Test each midnight mode
        console.log('\nTesting midnight modes...');
        for (const [modeId, modeName] of Object.entries(MIDNIGHT_MODES)) {
            try {
                const params = new URLSearchParams({
                    ...testParams,
                    method: 3, // Use MWL as default calculation method
                    midnightMode: modeId
                });
                
                const url = `${API_BASE_URL}/timings/${testParams.date}?${params.toString()}`;
                const response = await fetch(url);
                
                if (!response.ok) {
                    console.error(`❌ Midnight mode ${modeId} (${modeName}) failed: ${response.status} ${response.statusText}`);
                    continue;
                }
                
                const data = await response.json();
                if (data.code !== 200 || !data.data) {
                    console.error(`❌ Midnight mode ${modeId} (${modeName}) returned invalid data: ${JSON.stringify(data)}`);
                    continue;
                }
                
                console.log(`✅ Midnight mode ${modeId} (${modeName}) validated successfully`);
            } catch (error) {
                console.error(`❌ Error testing midnight mode ${modeId} (${modeName}):`, error.message);
            }
        }
        
        console.log('\n✅ Constants validation completed');
    } catch (error) {
        console.error('❌ Error during constants validation:', error);
    }
}

// Run the validation if this script is executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    validateConstants();
}

export { validateConstants }; 