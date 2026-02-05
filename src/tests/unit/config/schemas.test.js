const { configSchema, triggerEventSchema } = require('@config/schemas');

describe('Config Schemas', () => {
    describe('configSchema', () => {
        const validConfig = {
            location: {
                timezone: 'Europe/London',
                coordinates: { lat: 51.5, long: -0.1 }
            },
            prayers: {
                fajr: { iqamahOffset: 20, roundTo: 15, fixedTime: null },
                dhuhr: { iqamahOffset: 15, roundTo: 15, fixedTime: null },
                asr: { iqamahOffset: 15, roundTo: 15, fixedTime: null },
                maghrib: { iqamahOffset: 10, roundTo: 5, fixedTime: null },
                isha: { iqamahOffset: 15, roundTo: 15, fixedTime: "20:00" }
            },
            sources: {
                primary: { 
                    type: 'aladhan',
                    method: 15,
                    madhab: 1,
                    latitudeAdjustmentMethod: 0,
                    midnightMode: 0
                },
                backup: { type: 'mymasjid', masjidId: '94f1c71b-7f8a-4b9a-9e1d-3b5f6a7b8c9d' }
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

        it('should include default healthChecks in system block', () => {
            const result = configSchema.parse(validConfig);
            // console.log('Parsed Config:', JSON.stringify(result, null, 2));
            expect(result.system).toBeDefined();
            expect(result.system.healthChecks).toEqual({
                api: true,
                tts: true
            });
        });
    });

    describe('triggerEventSchema', () => {
        it('should accept template under 50 chars', () => {
            const result = triggerEventSchema.safeParse({
                enabled: true, type: 'tts', template: 'Hello world', targets: []
            });
            expect(result.success).toBe(true);
        });

        it('should reject template over 50 chars', () => {
            const longTemplate = 'A'.repeat(51);
            const result = triggerEventSchema.safeParse({
                enabled: true, type: 'tts', template: longTemplate, targets: []
            });
            expect(result.success).toBe(false);
        });
    });
});
