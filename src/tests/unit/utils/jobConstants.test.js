const jobConstants = require('@utils/jobConstants');

describe('JobConstants', () => {
    it('should have all expected constants defined', () => {
        expect(jobConstants.JOB_STALE_CHECK).toBe('Maintenance: Stale Check');
        expect(jobConstants.JOB_YEAR_BOUNDARY).toBe('Maintenance: Year Boundary');
        expect(jobConstants.JOB_HEALTH_CHECK).toBe('Maintenance: Health Check');
        expect(jobConstants.JOB_AUDIO_ASSETS).toBe('Maintenance: Audio Assets');
        expect(jobConstants.JOB_MIDNIGHT_REFRESH).toBe('System: Midnight Refresh');
    });

    it('should be an object with string values', () => {
        expect(typeof jobConstants).toBe('object');
        Object.values(jobConstants).forEach(val => {
            expect(typeof val).toBe('string');
            expect(val.length).toBeGreaterThan(0);
        });
    });
});
