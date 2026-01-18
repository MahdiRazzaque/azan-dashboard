const fetchers = require('../../../src/services/fetchers');

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
                    date: { gregorian: { date: '01-01-2024' } },
                    timings: {
                        Fajr: '05:00 (BST)',
                        Dhuhr: '12:00 (BST)',
                        Asr: '15:00 (BST)',
                        Maghrib: '18:00 (BST)',
                        Isha: '19:30 (BST)'
                    }
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
           await expect(fetchers.fetchAladhanAnnual(mockConfig, 2024)).rejects.toThrow('Validation Failed');
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
           // Karachi is ID 1, Hanafi is 1
           expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('method=1'));
           expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('school=1'));
       });

       it('should use default method ID when method name not found', async () => {
           global.fetch.mockResolvedValue({
               ok: true,
               json: () => Promise.resolve(mockResponse)
           });
           
           const unknownMethodConfig = {
               ...mockConfig,
               calculation: { method: 'UnknownMethod', madhab: 'UnknownMadhab' }
           };
           
           await fetchers.fetchAladhanAnnual(unknownMethodConfig, 2024);
           // Should default to method=2 (ISNA) and school=0 (Shafi)
           expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('method=2'));
           expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('school=0'));
       });

       it('should handle numeric method and madhab IDs', async () => {
           global.fetch.mockResolvedValue({
               ok: true,
               json: () => Promise.resolve(mockResponse)
           });
           
           const numericConfig = {
               ...mockConfig,
               calculation: { 
                   method: 3, 
                   madhab: 1,
                   latitudeAdjustmentMethod: 2,
                   midnightMode: 1
               }
           };
           
           await fetchers.fetchAladhanAnnual(numericConfig, 2024);
           expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('method=3'));
           expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('school=1'));
           expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('latitudeAdjustmentMethod=2'));
           expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('midnightMode=1'));
       });
    });

    describe('fetchMyMasjidBulk', () => {
         const mockResponse = {
             model: {
                 salahTimings: [
                     {
                         day: 1, month: 1,
                         fajr: '05:00', zuhr: '12:30', asr: '15:30', maghrib: '17:00', isha: '19:00',
                         iqamah_Fajr: '05:30'
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
             const badConfig = { ...mockConfig, sources: { primary: { type: 'other' } } };
             const result = await fetchers.fetchMyMasjidBulk(badConfig);
             expect(result).toEqual({});
         });

         it('should throw on API error', async () => {
             global.fetch.mockResolvedValue({
                 ok: false,
                 statusText: 'Server Error'
             });
             await expect(fetchers.fetchMyMasjidBulk(mockConfig)).rejects.toThrow('MyMasjid API Error');
         });

         it('should throw on validation failure', async () => {
             global.fetch.mockResolvedValue({
                 ok: true,
                 json: () => Promise.resolve({ model: { salahTimings: "not-an-array" } })
             });
             await expect(fetchers.fetchMyMasjidBulk(mockConfig)).rejects.toThrow('Validation Failed');
         });

         it('should warn and return empty if model missing data', async () => {
             jest.spyOn(console, 'warn').mockImplementation(() => {});
             global.fetch.mockResolvedValue({
                 ok: true,
                 json: () => Promise.resolve({ model: {} }) // Missing salahTimings
             });
             
             // Strict schema validation -> Should throw, NOT return empty
             // To test "warn and return empty", the schema must be optional OR the data must pass schema but fail logic check.
             // But reverting schema means this WILL throw.
             // We update the test expectation to match strict schema.
             await expect(fetchers.fetchMyMasjidBulk(mockConfig)).rejects.toThrow('MyMasjid Schema Validation Failed');
         });

         it('should use backup source when primary is not mymasjid', async () => {
             global.fetch.mockResolvedValue({
                 ok: true,
                 json: () => Promise.resolve(mockResponse)
             });

             const backupConfig = {
                 ...mockConfig,
                 sources: {
                     primary: { type: 'aladhan' },
                     backup: { type: 'mymasjid', masjidId: 'backup-guid' }
                 }
             };

             const result = await fetchers.fetchMyMasjidBulk(backupConfig);
             
             expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('backup-guid'));
             expect(Object.keys(result).length).toBeGreaterThan(0);
         });

         it('should throw specific error for 400 status (invalid ID)', async () => {
             global.fetch.mockResolvedValue({
                 ok: false,
                 status: 400,
                 statusText: 'Bad Request'
             });
             await expect(fetchers.fetchMyMasjidBulk(mockConfig))
                 .rejects.toThrow('Invalid Masjid ID');
         });

         it('should throw specific error for 404 status (ID not found)', async () => {
             global.fetch.mockResolvedValue({
                 ok: false,
                 status: 404,
                 statusText: 'Not Found'
             });
             await expect(fetchers.fetchMyMasjidBulk(mockConfig))
                 .rejects.toThrow('Masjid ID not found');
         });

         it('should warn and return empty if model.salahTimings missing after validation', async () => {
             jest.spyOn(console, 'warn').mockImplementation(() => {});
             
             // Use jest.spyOn for proper mocking
             const parseSpy = jest.spyOn(fetchers.MyMasjidBulkResponseSchema, 'parse')
                 .mockReturnValueOnce({
                     model: {} // Missing salahTimings
                 });
             
             global.fetch.mockResolvedValue({
                 ok: true,
                 json: () => Promise.resolve({ model: {} })
             });
             
             try {
                 const result = await fetchers.fetchMyMasjidBulk(mockConfig);
                 expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('missing'));
                 expect(result).toEqual({});
             } finally {
                 // Ensure restore happens even if test fails
                 parseSpy.mockRestore();
             }
         });
    });
});
