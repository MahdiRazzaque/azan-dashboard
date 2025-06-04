/**
 * Test script for iqamah time calculation logic
 */
import {
    parseTimeToMinutes,
    formatMinutesToTime,
    roundMinutesAccordingToRules,
    calculateIqamahTime,
    calculateAllIqamahTimes
} from '../src/utils/time-calculator.js';

// Helper function to print test results
function printTestResult(name, passed, input, result, expected) {
    console.log(`${passed ? '✅' : '❌'} ${name}: ${input} => ${result}, expected ${expected}`);
}

console.log('\n=== TIME CALCULATOR UTILITY TESTS ===\n');

// Test parseTimeToMinutes
console.log('🧪 Testing parseTimeToMinutes:');
const parseTests = [
    { input: '05:30', expected: 330 },
    { input: '00:00', expected: 0 },
    { input: '23:59', expected: 1439 },
    { input: '12:45', expected: 765 },
    { input: 'invalid', expected: 0 },
    { input: null, expected: 0 }
];

parseTests.forEach(test => {
    const result = parseTimeToMinutes(test.input);
    const passed = result === test.expected;
    printTestResult('parseTimeToMinutes', passed, `"${test.input}"`, result, test.expected);
});

// Test formatMinutesToTime
console.log('\n🧪 Testing formatMinutesToTime:');
const formatTests = [
    { input: 330, expected: '05:30' },
    { input: 0, expected: '00:00' },
    { input: 1439, expected: '23:59' },
    { input: 765, expected: '12:45' },
    { input: 1500, expected: '01:00' }, // Test overflow
    { input: -60, expected: '23:00' }   // Test negative
];

formatTests.forEach(test => {
    const result = formatMinutesToTime(test.input);
    const passed = result === test.expected;
    printTestResult('formatMinutesToTime', passed, test.input, `"${result}"`, `"${test.expected}"`);
});

// Test roundMinutesAccordingToRules
console.log('\n🧪 Testing roundMinutesAccordingToRules:');
const roundingTests = [
    { input: 330, shouldRound: true, expected: 330 },  // 5:30 -> 5:30
    { input: 337, shouldRound: true, expected: 330 },  // 5:37 -> 5:30
    { input: 352, shouldRound: true, expected: 345 },  // 5:52 -> 5:45
    { input: 323, shouldRound: true, expected: 330 },  // 5:23 -> 5:30
    { input: 307, shouldRound: true, expected: 300 },  // 5:07 -> 5:00
    { input: 305, shouldRound: true, expected: 300 },  // 5:05 -> 5:00
    { input: 337, shouldRound: false, expected: 337 }, // No rounding
    { input: 1439, shouldRound: true, expected: 0 }    // 23:59 -> 0:00
];

console.log('Rounding rules:');
console.log('- 00:00 to 07:29 -> round to 00');
console.log('- 07:30 to 22:29 -> round to 15');
console.log('- 22:30 to 37:29 -> round to 30');
console.log('- 37:30 to 52:29 -> round to 45');
console.log('- 52:30 to 59:59 -> round to next hour 00');

let allRoundingTestsPassed = true;
roundingTests.forEach(test => {
    const result = roundMinutesAccordingToRules(test.input, test.shouldRound);
    const passed = result === test.expected;
    if (!passed) allRoundingTestsPassed = false;
    
    // Convert minutes to HH:MM for better readability
    const inputTime = formatMinutesToTime(test.input);
    const resultTime = formatMinutesToTime(result);
    const expectedTime = formatMinutesToTime(test.expected);
    
    printTestResult(
        'roundMinutesAccordingToRules', 
        passed, 
        `${inputTime} (${test.input} min, shouldRound=${test.shouldRound})`, 
        `${resultTime} (${result} min)`, 
        `${expectedTime} (${test.expected} min)`
    );
});

// Test calculateIqamahTime
console.log('\n🧪 Testing calculateIqamahTime:');
const iqamahTests = [
    { azanTime: '05:30', offset: 20, prayer: 'fajr', expected: '05:45' },
    { azanTime: '12:15', offset: 10, prayer: 'zuhr', expected: '12:30' },
    { azanTime: '15:45', offset: 10, prayer: 'asr', expected: '16:00' },
    { azanTime: '18:30', offset: 5, prayer: 'maghrib', expected: '18:35' }, // No rounding for maghrib
    { azanTime: '20:00', offset: 15, prayer: 'isha', expected: '20:15' },
    { azanTime: '23:50', offset: 15, prayer: 'isha', expected: '00:00' }    // Test midnight crossover
];

let allIqamahTestsPassed = true;
iqamahTests.forEach(test => {
    const result = calculateIqamahTime(test.azanTime, test.offset, test.prayer);
    const passed = result === test.expected;
    if (!passed) allIqamahTestsPassed = false;
    printTestResult(
        'calculateIqamahTime', 
        passed, 
        `"${test.azanTime}" + ${test.offset} min (${test.prayer})`, 
        `"${result}"`, 
        `"${test.expected}"`
    );
});

// Test calculateAllIqamahTimes
console.log('\n🧪 Testing calculateAllIqamahTimes:');
const prayerTimes = {
    fajr: '05:30',
    zuhr: '12:15',
    asr: '15:45',
    maghrib: '18:30',
    isha: '20:00'
};

const iqamahOffsets = {
    fajr: 20,
    zuhr: 10,
    asr: 10,
    maghrib: 5,
    isha: 15
};

const expectedIqamahTimes = {
    iqamah_fajr: '05:45',
    iqamah_zuhr: '12:30',
    iqamah_asr: '16:00',
    iqamah_maghrib: '18:35',
    iqamah_isha: '20:15'
};

const allIqamahTimes = calculateAllIqamahTimes(prayerTimes, iqamahOffsets);
console.log('All Iqamah Times:', allIqamahTimes);

// Check if all expected iqamah times match
let allBatchTestsPassed = true;
for (const [prayer, expectedTime] of Object.entries(expectedIqamahTimes)) {
    const actualTime = allIqamahTimes[prayer];
    const passed = actualTime === expectedTime;
    if (!passed) allBatchTestsPassed = false;
    printTestResult('Batch calculation', passed, prayer, `"${actualTime}"`, `"${expectedTime}"`);
}

// Test edge cases
console.log('\n🧪 Testing edge cases:');

// Case 1: Midnight crossover
console.log('\nMidnight crossover:');
const midnightCrossoverTest = calculateIqamahTime('23:50', 20, 'isha');
const midnightCrossoverPassed = midnightCrossoverTest === '00:15';
printTestResult('Midnight crossover', midnightCrossoverPassed, 'Isha at 23:50 + 20 minutes', midnightCrossoverTest, '"00:15"');

// Case 2: Exactly on rounding boundaries
console.log('\nExact rounding boundaries:');
const boundary1 = formatMinutesToTime(roundMinutesAccordingToRules(parseTimeToMinutes('07:30')));
const boundary2 = formatMinutesToTime(roundMinutesAccordingToRules(parseTimeToMinutes('07:15')));
const boundary3 = formatMinutesToTime(roundMinutesAccordingToRules(parseTimeToMinutes('07:45')));
const boundary4 = formatMinutesToTime(roundMinutesAccordingToRules(parseTimeToMinutes('07:00')));

printTestResult('Boundary test', boundary1 === '07:30', '07:30', boundary1, '07:30');
printTestResult('Boundary test', boundary2 === '07:15', '07:15', boundary2, '07:15');
printTestResult('Boundary test', boundary3 === '07:45', '07:45', boundary3, '07:45');
printTestResult('Boundary test', boundary4 === '07:00', '07:00', boundary4, '07:00');

// Case 3: Invalid inputs
console.log('\nInvalid inputs:');
const invalidTime = calculateIqamahTime('invalid', 10, 'fajr');
const nullTime = calculateIqamahTime(null, 10, 'fajr');
const invalidPrayer = calculateIqamahTime('05:30', 10, 'invalid');

printTestResult('Invalid time', invalidTime === '00:15', 'invalid time', invalidTime, '00:15');
printTestResult('Null time', nullTime === '00:15', 'null time', nullTime, '00:15');
printTestResult('Invalid prayer', invalidPrayer === '05:45', 'invalid prayer', invalidPrayer, '05:45');

// Summary
console.log('\n=== TEST SUMMARY ===');
const allTestsPassed = allRoundingTestsPassed && allIqamahTestsPassed && allBatchTestsPassed;
console.log(`${allTestsPassed ? '✅ All tests passed!' : '❌ Some tests failed!'}`);
if (!allTestsPassed) {
    console.log('Please check the test output above for details.');
} else {
    console.log('\n🎉🎉🎉 SUCCESS! All tests passed! 🎉🎉🎉');
} 