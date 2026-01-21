const fetchers = require('@adapters/prayerApiAdapter');

// Mock requestQueue to avoid delays in fetcher tests
jest.mock('@utils/requestQueue', () => ({
    aladhanQueue: { schedule: (fn) => fn() },
    myMasjidQueue: { schedule: (fn) => fn() }
}));

// Mock Config
const mockConfig = {
    location: {
        coordinates: { lat: 51.5, long: -0.1 },
        timezone: 'Europe/London'
    },
    calculation: {
        method: 'ISNA',
        madhab: 'Shafi'
    },
    sources: {
        primary: { type: 'mymasjid', masjidId: 'test-guid' },
        backup: { type: 'mymasjid', masjidId: 'backup-guid' } 
    }
};

describe('Fetchers Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch = jest.fn();
        
        // Suppress console logs during fetch tests
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    describe('fetchAladhanAnnual', () => {
        const mockResponse = {
            code: 200,
            status: 'OK',
            data: {
                "1": [{
                    date: { 
                        gregorian: { 
                            date: '01-01-2024', 
                            day: '01',
                            month: { number: 1 },
                            year: '2024'
                        } 
                    },
                    timings: {
                        Fajr: '05:00 (BST)',
                        Sunrise: '07:00 (BST)',
                        Dhuhr: '12:00 (BST)',
                        Asr: '15:00 (BST)',
                        Sunset: '18:00 (BST)',
                        Maghrib: '18:00 (BST)',
                        Isha: '19:30 (BST)',
                        Imsak: '04:50 (BST)',
                        Midnight: '00:00 (BST)'
                    },
                    meta: { timezone: 'Europe/London' }
                }]
            }
        };

        it('should fetch and parse Aladhan data', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockResponse)
            });

            const result = await fetchers.fetchAladhanAnnual(mockConfig, 2024);
            
            expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('latitude=51.5'));
            
            // Check mapped result
            expect(result['2024-01-01']).toBeDefined();
            expect(result['2024-01-01'].fajr).toContain('T05:00:00');
        });

        it('should use default values for unknown Aladhan adjustments and modes', async () => {
            const malformedConfig = {
                ...mockConfig,
                calculation: {
                    ...mockConfig.calculation,
                    latitudeAdjustmentMethod: 'InvalidAdjustment',
                    midnightMode: 'InvalidMode'
                }
            };
            
            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    code: 200,
                    status: 'OK',
                    data: { 
                        "1": [{ 
                            date: { 
                                gregorian: { 
                                    date: '01-01-2024', 
                                    day: '01', 
                                    month: { number: 1 }, 
                                    year: '2024' 
                                } 
                            }, 
                            timings: { Fajr: '05:00', Dhuhr: '12:00', Asr: '15:00', Maghrib: '18:00', Isha: '19:00', Sunrise: '06:00', Sunset: '18:10', Imsak: '04:50', Midnight: '23:00' },
                            meta: { timezone: 'Europe/London' }
                        }] 
                    }
                })
            });

            await fetchers.fetchAladhanAnnual(malformedConfig, 2024);
            
            // Should contain defaults (0)
            expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('latitudeAdjustmentMethod=0'));
            expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('midnightMode=0'));
        });

        it('should throw on API error', async () => {
             global.fetch.mockResolvedValue({
                ok: false,
                statusText: 'Not Found'
            });
            await expect(fetchers.fetchAladhanAnnual(mockConfig, 2024)).rejects.toThrow('Aladhan API Error');
        });

        it('should throw on validation failure', async () => {
            global.fetch.mockResolvedValue({
               ok: true,
               json: () => Promise.resolve({ data: "Invalid Structure" })
           });
           await expect(fetchers.fetchAladhanAnnual(mockConfig, 2024)).rejects.toThrow('Aladhan Schema Validation Failed');
       });

       it('should handle Aladhan configuration with direct IDs (numbers)', async () => {
           global.fetch.mockResolvedValue({
               ok: true,
               json: () => Promise.resolve(mockResponse)
           });
           const numericConfig = {
               ...mockConfig,
               calculation: { method: 1, madhab: 1, latitudeAdjustmentMethod: 3, midnightMode: 1 }
           };
           await fetchers.fetchAladhanAnnual(numericConfig, 2024);
           expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('method=1'));
           expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('school=1'));
           expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('latitudeAdjustmentMethod=3'));
           expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('midnightMode=1'));
       });

       it('should map Aladhan method and adjustment names to IDs', async () => {
           global.fetch.mockResolvedValue({
               ok: true,
               json: () => Promise.resolve(mockResponse)
           });
           const namedConfig = {
               ...mockConfig,
               location: { ...mockConfig.location, coordinates: { lat: 52, long: 0 } },
               calculation: { 
                   method: 'Muslim World League', 
                   madhab: 'Hanafi', 
                   latitudeAdjustmentMethod: 'Middle of the Night',
                   midnightMode: 'Jafari'
               }
           };
           await fetchers.fetchAladhanAnnual(namedConfig, 2024);
           expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('method=3')); // MWL
           expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('school=1')); // Hanafi
           expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('latitudeAdjustmentMethod=1')); // MOTN
           expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('midnightMode=1')); // Jafari
       });

       it('should handle missing adjustment or midnight mode names', async () => {
           global.fetch.mockResolvedValue({
               ok: true,
               json: () => Promise.resolve(mockResponse)
           });
           const emptyConfig = {
               ...mockConfig,
               location: { ...mockConfig.location, coordinates: { lat: 53, long: 0 } },
               calculation: { 
                   method: 3, 
                   madhab: 1, 
                   latitudeAdjustmentMethod: null,
                   midnightMode: undefined
               }
           };
           await fetchers.fetchAladhanAnnual(emptyConfig, 2024);
           expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('latitudeAdjustmentMethod=0'));
           expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('midnightMode=0'));
       });

       it('should use default calculation method and madhab for unknown names', async () => {
           global.fetch.mockResolvedValue({
               ok: true,
               json: () => Promise.resolve(mockResponse)
           });
           const unknownConfig = {
               ...mockConfig,
               calculation: { method: 'UnknownMethod', madhab: 'UnknownMadhab' }
           };
           await fetchers.fetchAladhanAnnual(unknownConfig, 2024);
           // Default ISNA is 2, Default Shafi is 0
           expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('method=2'));
           expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('school=0'));
       });

       it('should handle partial string matches for methods', async () => {
           global.fetch.mockResolvedValue({
               ok: true,
               json: () => Promise.resolve(mockResponse)
           });
           
           const specificConfig = {
               ...mockConfig,
               calculation: { method: 'Karachi', madhab: 'Hanafi' }
           };
           
           await fetchers.fetchAladhanAnnual(specificConfig, 2024);
           // Karachi is ID 1 (University of Islamic Sciences, Karachi), Hanafi is 1
           expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('method=1'));
           expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('school=1'));
       });
    });

    describe('fetchMyMasjidBulk', () => {
         const mockResponse = {
             model: {
                 salahTimings: [
                     {
                         day: 1, month: 1,
                         fajr: [{ salahName: 'Fajr', salahTime: '05:00', iqamahTime: '05:30' }],
                         zuhr: [{ salahName: 'Dhuhr', salahTime: '12:30', iqamahTime: null }],
                         asr: [{ salahName: 'Asr', salahTime: '15:30', iqamahTime: null }],
                         maghrib: [{ salahName: 'Maghrib', salahTime: '17:00', iqamahTime: null }],
                         isha: [{ salahName: 'Isha', salahTime: '19:00', iqamahTime: null }],
                         shouruq: [{ salahName: 'Sunrise', salahTime: '07:00', iqamahTime: null }]
                     }
                 ]
             }
         };

         it('should fetch and parse MyMasjid data', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockResponse)
            });

            const result = await fetchers.fetchMyMasjidBulk(mockConfig);
            expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('GetMasjidTimings'));
            
            const currentYear = new Date().getFullYear();
            const key = `${currentYear}-01-01`;
            expect(result[key]).toBeDefined();
            expect(result[key].iqamah.fajr).toContain('T05:30:00');
         });

         it('should handle missing config gracefully', async () => {
             const badConfig = { ...mockConfig, sources: { primary: { type: 'other' }, backup: null } };
             const result = await fetchers.fetchMyMasjidBulk(badConfig);
             expect(result).toEqual({});
             expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('no valid configuration'));
         });

         it('should throw on API error', async () => {
             global.fetch.mockResolvedValue({
                 ok: false,
                 statusText: 'Server Error'
             });
             await expect(fetchers.fetchMyMasjidBulk(mockConfig)).rejects.toThrow('MyMasjid API Error');
         });

         it('should throw specific message for 400 error', async () => {
              global.fetch.mockResolvedValue({ ok: false, status: 400 });
              await expect(fetchers.fetchMyMasjidBulk(mockConfig)).rejects.toThrow('Invalid Masjid ID');
         });

         it('should throw specific message for 404 error', async () => {
              global.fetch.mockResolvedValue({ ok: false, status: 404 });
              await expect(fetchers.fetchMyMasjidBulk(mockConfig)).rejects.toThrow('Masjid ID not found');
         });

         it('should throw on validation failure', async () => {
            global.fetch.mockResolvedValue({
               ok: true,
               json: () => Promise.resolve({ model: "Bad" })
           });
           await expect(fetchers.fetchMyMasjidBulk(mockConfig)).rejects.toThrow('MyMasjid Schema Validation Failed');
       });

       it('should handle backup source if primary is not MyMasjid', async () => {
            const backupOnly = {
                ...mockConfig,
                sources: {
                    primary: { type: 'aladhan' },
                    backup: { type: 'mymasjid', masjidId: 'backup-id' }
                }
            };
            global.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockResponse) });
            await fetchers.fetchMyMasjidBulk(backupOnly);
            expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('GuidId=backup-id'));
       });

       it('should skip invalid dates in MyMasjid response', async () => {
           const badDateResponse = {
               model: {
                   salahTimings: [
                       { 
                           day: 32, month: 1, 
                           fajr: [{ salahName: 'Fajr', salahTime: '05:00', iqamahTime: '05:30' }], 
                           zuhr: [{ salahName: 'Dhuhr', salahTime: '12:00', iqamahTime: null }], 
                           asr: [{ salahName: 'Asr', salahTime: '15:00', iqamahTime: null }], 
                           maghrib: [{ salahName: 'Maghrib', salahTime: '18:00', iqamahTime: null }], 
                           isha: [{ salahName: 'Isha', salahTime: '20:00', iqamahTime: null }],
                           shouruq: [{ salahName: 'Shouruq', salahTime: '07:00', iqamahTime: null }]
                       }
                   ]
               }
           };
           global.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(badDateResponse) });
           const result = await fetchers.fetchMyMasjidBulk(mockConfig);
           expect(Object.keys(result).length).toBe(0);
       });

       it('should handle missing optional times', async () => {
           const partialResponse = {
               model: {
                   salahTimings: [
                       { 
                           day: 1, month: 1, 
                           fajr: [{ salahName: 'Fajr', salahTime: '05:00', iqamahTime: null }], 
                           zuhr: [{ salahName: 'Dhuhr', salahTime: '12:00', iqamahTime: null }], 
                           asr: [{ salahName: 'Asr', salahTime: '15:00', iqamahTime: null }], 
                           maghrib: [{ salahName: 'Maghrib', salahTime: '18:00', iqamahTime: null }], 
                           isha: [{ salahName: 'Isha', salahTime: '20:00', iqamahTime: null }],
                           shouruq: [{ salahName: 'Shouruq', salahTime: '07:00', iqamahTime: null }]
                       }
                   ]
               }
           };
           global.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(partialResponse) });
           const result = await fetchers.fetchMyMasjidBulk(mockConfig);
           const key = `${new Date().getFullYear()}-01-01`;
           expect(result[key].iqamah.fajr).toBeNull();
       });

       it('should handle flat format in MyMasjid response', async () => {
           const flatResponse = {
               model: {
                   salahTimings: [
                       { 
                           day: 1, month: 1, 
                           fajr: '05:00', 
                           zuhr: '12:00', 
                           asr: '15:00', 
                           maghrib: '18:00', 
                           isha: '20:00',
                           shouruq: '07:00',
                           iqamah_Fajr: '05:30',
                           iqamah_Zuhr: '12:30',
                           iqamah_Asr: '15:30',
                           iqamah_Maghrib: '18:15',
                           iqamah_Isha: '20:30'
                       }
                   ]
               }
           };
           global.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(flatResponse) });
           const result = await fetchers.fetchMyMasjidBulk(mockConfig);
           const key = `${new Date().getFullYear()}-01-01`;
           expect(result[key].fajr).toContain('T05:00:00');
           expect(result[key].iqamah.fajr).toContain('T05:30:00');
       });

       it('should handle empty arrays for prayer times or iqamah in MyMasjid response', async () => {
           const emptyArrayResponse = {
               model: {
                   salahTimings: [
                       { 
                           day: 1, month: 1, 
                           fajr: [], 
                           zuhr: [], 
                           asr: [], 
                           maghrib: [], 
                           isha: [],
                           shouruq: []
                       }
                   ]
               }
           };
           // Note: This might fail Zod validation if the schema doesn't allow empty arrays or missing fields.
           // However MyMasjidNestedDaySchema has z.array(MyMasjidSalahEntrySchema), which defaults to allowing empty.
           global.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(emptyArrayResponse) });
           const result = await fetchers.fetchMyMasjidBulk(mockConfig);
           const key = `${new Date().getFullYear()}-01-01`;
           expect(result[key].fajr).toBeNull();
           expect(result[key].iqamah.fajr).toBeNull();
       });

       it('should deduplicate concurrent requests', async () => {
           global.fetch.mockResolvedValue({
               ok: true,
               json: () => new Promise(resolve => setTimeout(() => resolve(mockResponse), 50))
           });

           const p1 = fetchers.fetchMyMasjidBulk(mockConfig);
           const p2 = fetchers.fetchMyMasjidBulk(mockConfig);
           
           await Promise.all([p1, p2]);
           expect(global.fetch).toHaveBeenCalledTimes(1);
       });
    });
});
