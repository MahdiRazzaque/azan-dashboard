import { validateAladhanConfig } from '../src/prayer/aladhan-provider.js';
import { DEFAULT_ALADHAN_CONFIG } from '../src/prayer/constants.js';

// Test cases
const testCases = [
    {
        name: "Valid configuration",
        config: {
            ...DEFAULT_ALADHAN_CONFIG,
            latitude: 51.5074,
            longitude: -0.1278,
            timezone: 'Europe/London'
        },
        shouldBeValid: true
    },
    {
        name: "Missing latitude",
        config: {
            ...DEFAULT_ALADHAN_CONFIG,
            longitude: -0.1278,
            timezone: 'Europe/London'
        },
        shouldBeValid: false
    },
    {
        name: "Invalid latitude (too high)",
        config: {
            ...DEFAULT_ALADHAN_CONFIG,
            latitude: 100,
            longitude: -0.1278,
            timezone: 'Europe/London'
        },
        shouldBeValid: false
    },
    {
        name: "Invalid latitude (too low)",
        config: {
            ...DEFAULT_ALADHAN_CONFIG,
            latitude: -100,
            longitude: -0.1278,
            timezone: 'Europe/London'
        },
        shouldBeValid: false
    },
    {
        name: "Missing longitude",
        config: {
            ...DEFAULT_ALADHAN_CONFIG,
            latitude: 51.5074,
            timezone: 'Europe/London'
        },
        shouldBeValid: false
    },
    {
        name: "Invalid longitude (too high)",
        config: {
            ...DEFAULT_ALADHAN_CONFIG,
            latitude: 51.5074,
            longitude: 200,
            timezone: 'Europe/London'
        },
        shouldBeValid: false
    },
    {
        name: "Invalid longitude (too low)",
        config: {
            ...DEFAULT_ALADHAN_CONFIG,
            latitude: 51.5074,
            longitude: -200,
            timezone: 'Europe/London'
        },
        shouldBeValid: false
    },
    {
        name: "Missing timezone",
        config: {
            ...DEFAULT_ALADHAN_CONFIG,
            latitude: 51.5074,
            longitude: -0.1278
        },
        shouldBeValid: false
    },
    {
        name: "Invalid calculation method ID",
        config: {
            ...DEFAULT_ALADHAN_CONFIG,
            latitude: 51.5074,
            longitude: -0.1278,
            timezone: 'Europe/London',
            calculationMethodId: 999 // Invalid ID
        },
        shouldBeValid: false
    },
    {
        name: "Missing iqamah offsets",
        config: {
            latitude: 51.5074,
            longitude: -0.1278,
            timezone: 'Europe/London',
            calculationMethodId: 3,
            asrJuristicMethodId: 0,
            latitudeAdjustmentMethodId: null,
            midnightModeId: 0
            // iqamahOffsets missing
        },
        shouldBeValid: false
    },
    {
        name: "Invalid iqamah offset (negative)",
        config: {
            ...DEFAULT_ALADHAN_CONFIG,
            latitude: 51.5074,
            longitude: -0.1278,
            timezone: 'Europe/London',
            iqamahOffsets: {
                ...DEFAULT_ALADHAN_CONFIG.iqamahOffsets,
                fajr: -5 // Negative offset
            }
        },
        shouldBeValid: false
    },
    {
        name: "Invalid iqamah offset (too large)",
        config: {
            ...DEFAULT_ALADHAN_CONFIG,
            latitude: 51.5074,
            longitude: -0.1278,
            timezone: 'Europe/London',
            iqamahOffsets: {
                ...DEFAULT_ALADHAN_CONFIG.iqamahOffsets,
                fajr: 150 // Too large offset
            }
        },
        shouldBeValid: false
    }
];

// Run tests
console.log('🧪 Running Aladhan configuration validation tests...\n');
let passCount = 0;
let failCount = 0;

testCases.forEach((testCase, index) => {
    console.log(`Test ${index + 1}: ${testCase.name}`);
    const result = validateAladhanConfig(testCase.config);
    
    if (result.isValid === testCase.shouldBeValid) {
        console.log(`✅ PASS - Validation result: ${result.isValid}`);
        if (!result.isValid) {
            console.log(`   Error message: ${result.error}`);
        }
        passCount++;
    } else {
        console.log(`❌ FAIL - Expected ${testCase.shouldBeValid} but got ${result.isValid}`);
        if (!result.isValid) {
            console.log(`   Error message: ${result.error}`);
        }
        failCount++;
    }
    console.log();
});

console.log(`Tests completed: ${passCount} passed, ${failCount} failed`);
if (failCount === 0) {
    console.log('✅ All validation tests passed!');
} else {
    console.log('❌ Some validation tests failed.');
} 