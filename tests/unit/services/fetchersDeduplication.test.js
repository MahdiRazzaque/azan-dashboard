const fetchers = require('../../../src/services/fetchers');
const { aladhanQueue, myMasjidQueue } = require('../../../src/utils/requestQueue');

describe('Fetcher Deduplication', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should deduplicate concurrent Aladhan calls', async () => {
        const spy = jest.spyOn(aladhanQueue, 'schedule').mockImplementation(() => new Promise(r => setTimeout(() => r({data:1}), 100)));
        
        const config = { location: { coordinates: { lat: 0, long: 0 } } };
        const p1 = fetchers.fetchAladhanAnnual(config, 2026);
        const p2 = fetchers.fetchAladhanAnnual(config, 2026);

        expect(p1).toBe(p2);
        expect(spy).toHaveBeenCalledTimes(1);

        await p1;
    });

    it('should deduplicate concurrent MyMasjid calls', async () => {
        const spy = jest.spyOn(myMasjidQueue, 'schedule').mockImplementation(() => new Promise(r => setTimeout(() => r({data:1}), 100)));
        
        const config = { sources: { primary: { type: 'mymasjid', masjidId: 'm1' } } };
        const p1 = fetchers.fetchMyMasjidBulk(config);
        const p2 = fetchers.fetchMyMasjidBulk(config);

        expect(p1).toBe(p2);
        expect(spy).toHaveBeenCalledTimes(1);

        await p1;
    });
});
