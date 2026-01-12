const { calculateIqamah } = require('../../src/utils/calculations');
const { DateTime } = require('luxon');

describe('Iqamah Calculation Logic', () => {
    const timezone = 'Europe/London';

    test('should use fixedTime when provided', () => {
        const prayerStart = '2023-10-01T18:03:00.000+01:00'; // Maghrib in BST
        const settings = { iqamahOffset: 10, roundTo: 10, fixedTime: '20:00' };
        
        const result = calculateIqamah(prayerStart, settings, timezone);
        const dt = DateTime.fromISO(result).setZone(timezone);
        
        expect(dt.toFormat('HH:mm')).toBe('20:00');
        expect(dt.toISODate()).toBe('2023-10-01');
    });

    test('should apply offset and round up', () => {
        const prayerStart = '2023-10-01T12:03:00Z'; // 12:03
        // Offset 10 => 12:13. RoundTo 15 => 12:15.
        const settings = { iqamahOffset: 10, roundTo: 15, fixedTime: null };
        
        const result = calculateIqamah(prayerStart, settings, 'UTC');
        const dt = DateTime.fromISO(result).setZone('UTC');
        
        expect(dt.toFormat('HH:mm')).toBe('12:15');
    });

    test('should not round if already on interval', () => {
        const prayerStart = '2023-10-01T12:05:00Z'; 
        // Offset 10 => 12:15. RoundTo 15 => 12:15. No change.
        const settings = { iqamahOffset: 10, roundTo: 15, fixedTime: null };
        
        const result = calculateIqamah(prayerStart, settings, 'UTC');
        const dt = DateTime.fromISO(result).setZone('UTC');
        
        expect(dt.toFormat('HH:mm')).toBe('12:15');
    });

    test('should round up to the next hour correctly', () => {
        const prayerStart = '2023-10-01T12:45:00Z'; 
        // Offset 10 => 12:55. RoundTo 15 => 13:00.
        const settings = { iqamahOffset: 10, roundTo: 15, fixedTime: null };
        
        const result = calculateIqamah(prayerStart, settings, 'UTC');
        const dt = DateTime.fromISO(result).setZone('UTC');
        
        expect(dt.toFormat('HH:mm')).toBe('13:00');
    });

    test('should handle invalid inputs gracefully', () => {
        expect(() => calculateIqamah(null, {}, 'UTC')).toThrow();
    });
});
