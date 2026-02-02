const { ConfigService } = require('@config/ConfigService');

describe('ConfigService Security', () => {
    let configService;

    beforeEach(() => {
        configService = new ConfigService();
        delete Object.prototype.polluted;
    });

    afterEach(() => {
        delete Object.prototype.polluted;
    });

    describe('Prototype Pollution Protection', () => {
        it('should prevent prototype pollution in _mergeDeep', () => {
            const target = {};
            const source = {};
            // Manually define __proto__ as an own enumerable property
            Object.defineProperty(source, '__proto__', {
                value: { polluted: 'yes' },
                enumerable: true,
                configurable: true
            });

            configService._mergeDeep(target, source);

            expect({}.polluted).toBeUndefined();
        });

        it('should skip "constructor" and "prototype" keys', () => {
            const target = {};
            const source = {
                constructor: { prototype: { polluted: 'yes' } }
            };

            configService._mergeDeep(target, source);

            expect({}.polluted).toBeUndefined();
        });
    });
});
