const { calculateIqamah, calculateNextPrayer } = require('@utils/calculations');
const { DateTime } = require('luxon');

describe('Calculation Utils', () => {
    const timezone = 'Europe/London';

    describe('calculateIqamah', () => {
        it('should throw error for invalid inputs', () => {
            expect(() => calculateIqamah(null, {}, timezone)).toThrow('Invalid arguments');
            expect(() => calculateIqamah('2023-01-01', null, timezone)).toThrow('Invalid arguments');
            expect(() => calculateIqamah('2023-01-01', {}, null)).toThrow('Invalid arguments');
        });

        it('should throw error for invalid ISO format', () => {
            expect(() => calculateIqamah('invalid-date', {}, timezone)).toThrow('Invalid prayerStartISO format');
        });

        it('should not round if roundTo is 0', () => {
            const prayerStart = DateTime.fromObject({ hour: 12, minute: 7 }, { zone: timezone }).toISO();
            const settings = { iqamahOffset: 10, roundTo: 0, fixedTime: null };
            const result = calculateIqamah(prayerStart, settings, timezone);
            const resDt = DateTime.fromISO(result).setZone(timezone);
            expect(resDt.minute).toBe(17);
        });

        it('should calculate dynamic offset', () => {
            // 12:00 -> +15 mins = 12:15. Round to 15 = 12:15.
            const prayerStart = DateTime.fromObject({ hour: 12, minute: 0 }, { zone: timezone }).toISO();
            const settings = { iqamahOffset: 15, roundTo: 15, fixedTime: null };
            
            const result = calculateIqamah(prayerStart, settings, timezone);
            const resDt = DateTime.fromISO(result).setZone(timezone);
            
            expect(resDt.hour).toBe(12);
            expect(resDt.minute).toBe(15);
        });

        it('should round up to next interval', () => {
             // 12:00 -> +12 mins = 12:12. Round to 15. Expect 12:15.
             const prayerStart = DateTime.fromObject({ hour: 12, minute: 0 }, { zone: timezone }).toISO();
             const settings = { iqamahOffset: 12, roundTo: 15, fixedTime: null };
             
             const result = calculateIqamah(prayerStart, settings, timezone);
             const resDt = DateTime.fromISO(result).setZone(timezone);
             
             expect(resDt.hour).toBe(12);
             expect(resDt.minute).toBe(15);
        });

        it('should handle rounding crossing hour boundary', () => {
             // 12:50 -> +5 mins = 12:55. Round to 10 -> 13:00.
             const prayerStart = DateTime.fromObject({ hour: 12, minute: 50 }, { zone: timezone }).toISO();
             const settings = { iqamahOffset: 5, roundTo: 10, fixedTime: null };
             
             const result = calculateIqamah(prayerStart, settings, timezone);
             const resDt = DateTime.fromISO(result).setZone(timezone);
             
             expect(resDt.hour).toBe(13);
             expect(resDt.minute).toBe(0);
        });

        it('should respect fixedTime', () => {
             const prayerStart = DateTime.fromObject({ hour: 18, minute: 0 }, { zone: timezone }).toISO();
             const settings = { iqamahOffset: 15, roundTo: 15, fixedTime: '20:00' };
             
             const result = calculateIqamah(prayerStart, settings, timezone);
             const resDt = DateTime.fromISO(result).setZone(timezone);
             
             expect(resDt.hour).toBe(20);
             expect(resDt.minute).toBe(0);
        });
    });

    describe('calculateNextPrayer', () => {
        const today = DateTime.fromObject({ year: 2023, month: 1, day: 1 }, { zone: timezone });
        
        const prayers = {
            fajr: { start: today.set({ hour: 5 }).toISO() },
            dhuhr: { start: today.set({ hour: 13 }).toISO() },
            asr: { start: today.set({ hour: 16 }).toISO() },
            maghrib: { start: today.set({ hour: 18 }).toISO() },
            isha: { start: today.set({ hour: 20 }).toISO() }
        };

        it('should return Dhuhr if now is before Dhuhr', () => {
             const now = today.set({ hour: 10 });
             const next = calculateNextPrayer(prayers, now);
             expect(next.name).toBe('dhuhr');
        });

        it('should return Fajr if now is before Fajr', () => {
             const now = today.set({ hour: 4 });
             const next = calculateNextPrayer(prayers, now);
             expect(next.name).toBe('fajr');
        });

        it('should return null if all passed', () => {
             const now = today.set({ hour: 21 });
             const next = calculateNextPrayer(prayers, now);
             expect(next).toBeNull();
        });

        it('should skip prayers without start time', () => {
            const incompletePrayers = {
                fajr: { start: today.set({ hour: 5 }).toISO() },
                dhuhr: { }, // Missing start
                asr: { start: today.set({ hour: 16 }).toISO() }
            };
            const now = today.set({ hour: 10 });
            const next = calculateNextPrayer(incompletePrayers, now);
            // Should skip dhuhr and find asr
            expect(next.name).toBe('asr');
        });
    });
});
