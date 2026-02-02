const dns = require('dns');
const { ssrfSafeLookup, getSafeAgent } = require('../../../../src/utils/networkUtils');
const http = require('http');
const https = require('https');

jest.mock('dns');

describe('networkUtils', () => {
    describe('ssrfSafeLookup', () => {
        afterEach(() => {
            jest.clearAllMocks();
        });

        it('should allow public IPv4 addresses', (done) => {
            const publicIp = '8.8.8.8';
            dns.lookup.mockImplementation((hostname, options, callback) => {
                callback(null, publicIp, 4);
            });

            ssrfSafeLookup('google.com', {}, (err, address, family) => {
                expect(err).toBeNull();
                expect(address).toBe(publicIp);
                expect(family).toBe(4);
                done();
            });
        });

        it('should block private IPv4 addresses (127.0.0.1)', (done) => {
            dns.lookup.mockImplementation((hostname, options, callback) => {
                callback(null, '127.0.0.1', 4);
            });

            ssrfSafeLookup('localhost', {}, (err, address, family) => {
                expect(err).toBeInstanceOf(Error);
                expect(err.message).toContain('Private IP ranges are not allowed');
                done();
            });
        });

        it('should block private IPv4 addresses (192.168.1.1)', (done) => {
            dns.lookup.mockImplementation((hostname, options, callback) => {
                callback(null, '192.168.1.1', 4);
            });

            ssrfSafeLookup('router.local', {}, (err, address, family) => {
                expect(err).toBeInstanceOf(Error);
                expect(err.message).toContain('Private IP ranges are not allowed');
                done();
            });
        });

        it('should block private IPv6 addresses (::1)', (done) => {
            dns.lookup.mockImplementation((hostname, options, callback) => {
                callback(null, '::1', 6);
            });

            ssrfSafeLookup('localhost', {}, (err, address, family) => {
                expect(err).toBeInstanceOf(Error);
                expect(err.message).toContain('Private IP ranges are not allowed');
                done();
            });
        });

        it('should block private IPv6 addresses (fe80::)', (done) => {
            dns.lookup.mockImplementation((hostname, options, callback) => {
                callback(null, 'fe80::1', 6);
            });

            ssrfSafeLookup('link-local.local', {}, (err, address, family) => {
                expect(err).toBeInstanceOf(Error);
                expect(err.message).toContain('Private IP ranges are not allowed');
                done();
            });
        });

        it('should handle options as optional', (done) => {
            const publicIp = '1.1.1.1';
            dns.lookup.mockImplementation((hostname, options, callback) => {
                callback(null, publicIp, 4);
            });

            ssrfSafeLookup('cloudflare.com', (err, address, family) => {
                expect(err).toBeNull();
                expect(address).toBe(publicIp);
                done();
            });
        });

        it('should pass through DNS errors', (done) => {
            const dnsError = new Error('DNS lookup failed');
            dns.lookup.mockImplementation((hostname, options, callback) => {
                callback(dnsError);
            });

            ssrfSafeLookup('nonexistent.example', {}, (err, address, family) => {
                expect(err).toBe(dnsError);
                done();
            });
        });
    });

    describe('getSafeAgent', () => {
        it('should return an http.Agent for http protocol', () => {
            const agent = getSafeAgent('http:');
            expect(agent).toBeInstanceOf(http.Agent);
            expect(agent.options.lookup).toBe(ssrfSafeLookup);
        });

        it('should return an https.Agent for https protocol', () => {
            const agent = getSafeAgent('https:');
            expect(agent).toBeInstanceOf(https.Agent);
            expect(agent.options.lookup).toBe(ssrfSafeLookup);
        });
    });
});
