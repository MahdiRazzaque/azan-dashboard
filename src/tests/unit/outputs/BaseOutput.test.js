const BaseOutput = require('../../../outputs/BaseOutput');

describe('BaseOutput', () => {
    class TestOutput extends BaseOutput {
        // Concrete implementation for testing base methods
        static getMetadata() {
            return {
                id: 'test',
                label: 'Test Output',
                params: [
                    { key: 'token', sensitive: true },
                    { key: 'url', sensitive: false }
                ]
            };
        }
    }

    class IncompleteOutput extends BaseOutput {
        // Missing getMetadata
    }

    let output;

    beforeEach(() => {
        output = new TestOutput();
    });

    describe('Contract Enforcement', () => {
        it('should throw "Not implemented" for execute()', async () => {
            await expect(output.execute({}, {})).rejects.toThrow('Not implemented');
        });

        it('should throw "Not implemented" for healthCheck()', async () => {
            await expect(output.healthCheck({})).rejects.toThrow('Not implemented');
        });

        it('should throw "Not implemented" for verifyCredentials()', async () => {
            await expect(output.verifyCredentials({})).rejects.toThrow('Not implemented');
        });
    });

    describe('validateAsset', () => {
        it('should return valid by default', async () => {
            const result = await output.validateAsset('path/to/file.mp3', {});
            expect(result).toEqual({
                valid: true,
                lastChecked: expect.any(String),
                issues: []
            });
            expect(new Date(result.lastChecked).getTime()).not.toBeNaN();
        });
    });

    describe('augmentAudioMetadata', () => {
        it('should return empty object by default', () => {
            expect(output.augmentAudioMetadata({})).toEqual({});
        });
    });

    describe('getSecretRequirementKeys', () => {
        it('should return keys marked as sensitive in metadata', () => {
            const keys = output.getSecretRequirementKeys();
            expect(keys).toEqual(['token']);
        });

        it('should return empty array if no params in metadata', () => {
            class NoParamsOutput extends BaseOutput {
                static getMetadata() { return { id: 'noparams' }; }
            }
            const noParams = new NoParamsOutput();
            expect(noParams.getSecretRequirementKeys()).toEqual([]);
        });

        it('should throw if getMetadata is not implemented in subclass', () => {
             const incomplete = new IncompleteOutput();
             expect(() => incomplete.getSecretRequirementKeys()).toThrow();
        });
    });

    describe('validateTrigger', () => {
        it('should return empty array by default', () => {
            expect(output.validateTrigger({}, {})).toEqual([]);
        });
    });

    describe('static getMetadata', () => {
        it('should throw "Not implemented" by default', () => {
            expect(() => BaseOutput.getMetadata()).toThrow('Not implemented');
        });
    });
});
