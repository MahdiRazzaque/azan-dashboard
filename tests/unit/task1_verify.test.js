const constants = require('../../src/utils/constants');
const config = require('../../src/config');

describe('Task 1 Verification', () => {
    test('Constants are exported correctly', () => {
        expect(constants.CALCULATION_METHODS[2]).toBe("Islamic Society of North America (ISNA)");
        expect(constants.ASR_JURISTIC_METHODS[1]).toBe("Hanafi");
        expect(constants.API_BASE_URL).toBe("http://api.aladhan.com/v1");
        expect(constants.IQAMAH_PRAYERS).toContain("fajr");
    });

    test('Config includes data.staleCheckDays', () => {
        expect(config.data).toBeDefined();
        expect(config.data.staleCheckDays).toBe(7);
    });
});
