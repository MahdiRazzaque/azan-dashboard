const BaseOutput = require('../../../src/outputs/BaseOutput');

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

    describe('getSecretRequirementKeys', () => {
        it('should return keys marked as sensitive in metadata', () => {
            const keys = output.getSecretRequirementKeys();
            expect(keys).toEqual(['token']);
        });

        it('should throw if getMetadata is not implemented in subclass', () => {
             const incomplete = new IncompleteOutput();
             // Assuming base getMetadata throws or returns undefined causing error
             expect(() => incomplete.getSecretRequirementKeys()).toThrow();
        });
    });
    
    describe('static getMetadata', () => {
        it('should throw "Not implemented" by default', () => {
            expect(() => BaseOutput.getMetadata()).toThrow('Not implemented');
        });
    });
});
