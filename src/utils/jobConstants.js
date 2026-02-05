/**
 * Formalized job identifiers for system maintenance tasks.
 * Used to ensure consistency between Backend services and Frontend operations.
 */
module.exports = {
    JOB_STALE_CHECK: 'Maintenance: Stale Check',
    JOB_YEAR_BOUNDARY: 'Maintenance: Year Boundary',
    JOB_HEALTH_CHECK: 'Maintenance: Health Check',
    JOB_AUDIO_ASSETS: 'Maintenance: Audio Assets',
    JOB_MIDNIGHT_REFRESH: 'System: Midnight Refresh'
};
