const dns = require('dns');
const http = require('http');
const https = require('https');

/**
 * Custom DNS lookup that blocks private IP ranges to prevent SSRF.
 * 
 * @param {string} hostname - The hostname to resolve.
 * @param {object|function} options - Lookup options or callback.
 * @param {function} [callback] - The callback function.
 */
const ssrfSafeLookup = (hostname, options, callback) => {
    // Handle optional options argument
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }

    dns.lookup(hostname, options, (err, address, family) => {
        if (err) return callback(err);
        
        const isPrivate = (addr) => {
            // IPv4 Private ranges: 127.0.0.0/8, 10.0.0.0/8, 192.168.0.0/16, 172.16.0.0/12, 169.254.0.0/16
            const ipv4Private = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|169\.254\.)/;
            // IPv6 Private ranges: ::1, fe80::/10, fc00::/7
            const ipv6Private = /^(::1$|fe80:|fc00:|fd00:)/i;
            return ipv4Private.test(addr) || ipv6Private.test(addr);
        };

        if (isPrivate(address)) {
            return callback(new Error('Invalid URL: Private IP ranges are not allowed.'));
        }
        callback(null, address, family);
    });
};

/**
 * Returns http/https agents configured with the SSRF-safe lookup.
 * 
 * @param {string} protocol - 'http:' or 'https:'
 * @param {object} options - Additional agent options
 * @returns {http.Agent|https.Agent}
 */
const getSafeAgent = (protocol, options = {}) => {
    const agentOptions = { 
        lookup: ssrfSafeLookup, 
        keepAlive: false,
        ...options 
    };
    return protocol === 'https:' ? new https.Agent(agentOptions) : new http.Agent(agentOptions);
};

module.exports = {
    ssrfSafeLookup,
    getSafeAgent
};
