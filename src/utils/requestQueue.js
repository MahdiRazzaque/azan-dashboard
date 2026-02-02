/**
 * @deprecated This module is deprecated and will be removed in a future version.
 * Rate limiting queues have been moved into their respective Strategy and Provider classes.
 * 
 * Do not add new queues here.
 */

console.warn('[Deprecation Warning] requestQueue.js is deprecated. Use strategy-owned queues instead.');

module.exports = {
    // Empty as per decoupling requirements
};
