const { configSchema } = require('../../../src/config/schemas');

describe('Config Schemas', () => {
    const validConfig = {
        location: {
            timezone: 'Europe/London',
            coordinates: { lat: 51.5, long: -0.1 }
        },
        calculation: {
            method: 15,
            madhab: 1,
            latitudeAdjustmentMethod: 0,
            midnightMode: 0
        },
        prayers: {
            fajr: { iqamahOffset: 20, roundTo: 15, fixedTime: null },
            dhuhr: { iqamahOffset: 15, roundTo: 15, fixedTime: null },
            asr: { iqamahOffset: 15, roundTo: 15, fixedTime: null },
            maghrib: { iqamahOffset: 10, roundTo: 5, fixedTime: null },
            isha: { iqamahOffset: 15, roundTo: 15, fixedTime: "20:00" }
        },
        sources: {
            primary: { type: 'aladhan' },
            backup: { type: 'mymasjid', masjidId: '123' }
        },
        data: { staleCheckDays: 7 },
        automation: {
            baseUrl: 'http://localhost',
            audioPlayer: 'mpg123',
            pythonServiceUrl: 'http://localhost',
            voiceMonkey: { enabled: false },
            triggers: {
                fajr: { 
                    preAdhan: { enabled: false, type: 'tts', targets: [] },
                    adhan: { enabled: false, type: 'tts', targets: [] },
                    preIqamah: { enabled: false, type: 'tts', targets: [] },
                    iqamah: { enabled: false, type: 'tts', targets: [] }
                },
                sunrise: {
                    preAdhan: { enabled: false, type: 'tts', targets: [] },
                    adhan: { enabled: false, type: 'tts', targets: [] }
                },
                dhuhr: { 
                    preAdhan: { enabled: false, type: 'tts', targets: [] },
                    adhan: { enabled: false, type: 'tts', targets: [] },
                    preIqamah: { enabled: false, type: 'tts', targets: [] },
                    iqamah: { enabled: false, type: 'tts', targets: [] }
                },
                asr: { 
                    preAdhan: { enabled: false, type: 'tts', targets: [] },
                    adhan: { enabled: false, type: 'tts', targets: [] },
                    preIqamah: { enabled: false, type: 'tts', targets: [] },
                    iqamah: { enabled: false, type: 'tts', targets: [] }
                },
                maghrib: { 
                    preAdhan: { enabled: false, type: 'tts', targets: [] },
                    adhan: { enabled: false, type: 'tts', targets: [] },
                    preIqamah: { enabled: false, type: 'tts', targets: [] },
                    iqamah: { enabled: false, type: 'tts', targets: [] }
                },
                isha: { 
                    preAdhan: { enabled: false, type: 'tts', targets: [] },
                    adhan: { enabled: false, type: 'tts', targets: [] },
                    preIqamah: { enabled: false, type: 'tts', targets: [] },
                    iqamah: { enabled: false, type: 'tts', targets: [] }
                }
            }
        }
    };

    it('should validate valid configuration', () => {
        const result = configSchema.safeParse(validConfig);
        expect(result.success).toBe(true);
    });

    it('should fail for invalid timezone', () => {
        const invalid = { ...validConfig, location: { ...validConfig.location, timezone: 'Invalid/Zone' } };
        const result = configSchema.safeParse(invalid);
        expect(result.success).toBe(false);
    });

    it('should transform string values to numbers in calculation section', () => {
        const withStrings = { 
            ...validConfig, 
            calculation: { 
                method: '15', 
                madhab: '1',
                latitudeAdjustmentMethod: '0',
                midnightMode: '0'
            } 
        };
        const result = configSchema.safeParse(withStrings);
        expect(result.success).toBe(true);
        expect(result.data.calculation.method).toBe(15);
        expect(result.data.calculation.madhab).toBe(1);
        expect(result.data.calculation.latitudeAdjustmentMethod).toBe(0);
        expect(result.data.calculation.midnightMode).toBe(0);
    });
    it('should fail for offsetMinutes > 60', () => {
        const config = { ...validConfig };
        config.automation.triggers.fajr.preAdhan.offsetMinutes = 90;
        const result = configSchema.safeParse(config);
        expect(result.success).toBe(false);
    });

    it('should allow offsetMinutes = 60', () => {
        const config = { ...validConfig };
        config.automation.triggers.fajr.preAdhan.offsetMinutes = 60;
        const result = configSchema.safeParse(config);
        expect(result.success).toBe(true);
    });
});
