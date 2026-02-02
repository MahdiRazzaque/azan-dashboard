const OutputFactory = require('../../../outputs/OutputFactory');
const BaseOutput = require('../../../outputs/BaseOutput');

describe('OutputFactory', () => {
    class MockOutput1 extends BaseOutput {
        static getMetadata() {
            return {
                id: 'mock1',
                label: 'Mock Output 1',
                params: [{ key: 'secret', sensitive: true }]
            };
        }
    }

    class MockOutput2 extends BaseOutput {
        static getMetadata() {
            return {
                id: 'mock2',
                label: 'Mock Output 2',
                params: []
            };
        }
    }

    beforeEach(() => {
        // Reset factory state if necessary, but since it uses singletons/static registry,
        // we might need a method to clear registry or we just register distinct mocks.
        // Assuming we can clear it or we just add to it.
        // For testing purposes, let's assume register adds to a map.
        // If OutputFactory is singleton, we might need a method to reset it.
        // Let's assume for now we can't easily reset, so we'll test valid behavior.
        
        // However, to ensure isolation, a reset method would be good or exposing the registry.
        // Let's see if we can hack it for test or if we should add a reset method.
        // Ideally, factories should allow resetting for tests.
        if (OutputFactory._reset) {
            OutputFactory._reset();
        }
    });

    describe('Registration & Retrieval', () => {
        it('should register and retrieve a strategy instance', () => {
            OutputFactory.register(MockOutput1);
            const strategy = OutputFactory.getStrategy('mock1');
            expect(strategy).toBeInstanceOf(MockOutput1);
        });

        it('should return singleton instances', () => {
            OutputFactory.register(MockOutput1);
            const s1 = OutputFactory.getStrategy('mock1');
            const s2 = OutputFactory.getStrategy('mock1');
            expect(s1).toBe(s2);
        });

        it('should throw error for unknown strategy', () => {
            expect(() => OutputFactory.getStrategy('unknown')).toThrow("Strategy 'unknown' not found");
        });
    });

    describe('Metadata Discovery', () => {
        it('should return metadata for all registered strategies', () => {
            OutputFactory.register(MockOutput1);
            OutputFactory.register(MockOutput2);

            const allMetadata = OutputFactory.getAllStrategies();
            expect(allMetadata).toHaveLength(2);
            expect(allMetadata.find(m => m.id === 'mock1')).toBeTruthy();
            expect(allMetadata.find(m => m.id === 'mock2')).toBeTruthy();
        });
    });

    describe('Secret Aggregation', () => {
        it('should aggregate secret keys from all strategies', () => {
            OutputFactory.register(MockOutput1);
            OutputFactory.register(MockOutput2);

            // MockOutput1 has 'secret' (sensitive: true)
            // MockOutput2 has no params
            // We assume getSecretRequirementKeys returns array of { strategyId, keys } or just a flat list of env keys?
            // The plan says: "aggregates secrets across all outputs"
            // ConfigService usage: output.getSecretRequirementKeys().forEach...
            // It seems ConfigService iterates over strategies.
            // But OutputFactory also has `getSecretRequirementKeys()`.
            // Let's assume it returns a combined list or map.
            
            // Looking at plan for ConfigService:
            // "const outputs = OutputFactory.getAllStrategies(); for (const output of outputs) ..."
            // It uses `getAllStrategies()` which returns metadata? No, getAllStrategies usually returns instances or metadata?
            // "getAllStrategies() – returns metadata for UI discovery"
            
            // Wait, ConfigService usage code snippet:
            // "const outputs = OutputFactory.getAllStrategies();"
            // "for (const output of outputs) { output.getSecretRequirementKeys()... }"
            // This implies `getAllStrategies()` returns INSTANCES, not metadata. 
            // OR `getSecretRequirementKeys` is static? No, it's instance method in BaseOutput.
            
            // Contradiction in plan:
            // "getAllStrategies() – returns metadata for UI discovery"
            // vs
            // "const outputs = OutputFactory.getAllStrategies(); ... output.getSecretRequirementKeys()" (which is instance method)
            
            // Resolution: `getAllStrategies()` should probably return metadata for UI. 
            // But maybe we need `getStrategies()` returning instances for backend logic.
            // Or `getAllStrategies()` returns instances, and we map to metadata for UI.
            
            // Let's implement `getStrategies()` returning instances, and `getMetadata()` returning metadata list.
            // OR `getAllStrategies()` returns instances. UI endpoint maps it.
            
            // Let's check `systemController` plan:
            // "res.json(OutputFactory.getAllStrategies())" (implied by /registry endpoint)
            
            // If I look at `BaseOutput.js`, `getMetadata` is STATIC.
            // So we can get metadata without instance.
            
            // If `OutputFactory.getAllStrategies()` returns metadata (array of objects), it matches UI need.
            // But ConfigService needs keys.
            // "output.getSecretRequirementKeys()" is an instance method.
            // It relies on `this.constructor.getMetadata()`.
            
            // Maybe `OutputFactory` should expose a way to get all instances?
            // "getSecretRequirementKeys() – aggregates secrets across all outputs" -> This is a method on Factory.
            
            // Let's assume `OutputFactory.getSecretRequirementKeys()` returns a list of unique keys?
            // Or maybe a map?
            // The plan says:
            // "const outputs = OutputFactory.getAllStrategies();"
            // This suggests `getAllStrategies` returns objects that have `getSecretRequirementKeys`.
            
            // Decision: `OutputFactory.getAllStrategies()` will return INSTANCES.
            // To get metadata for UI, we can have `OutputFactory.getRegistry()` or map instances to metadata.
            // Actually, `BaseOutput` instances are stateless strategy handlers.
            // `getMetadata` is static.
            
            // Let's look at `BaseOutput.js` I wrote:
            // `getSecretRequirementKeys()` is an INSTANCE method.
            
            // So `getAllStrategies()` returning instances makes sense for ConfigService.
            // For UI, we can do `getAllStrategies().map(s => s.constructor.getMetadata())`.
            
            // Let's verify what `systemController` does in Plan.
            // "router.get('/outputs/registry', asyncHandler(systemController.getOutputRegistry));"
            // The plan doesn't show implementation of `getOutputRegistry`, but likely it serializes metadata.
            
            // Plan text: "getAllStrategies() – returns metadata for UI discovery"
            // This contradicts ConfigService usage.
            
            // I will implement:
            // `getStrategies()` -> returns instances.
            // `getRegistry()` -> returns metadata list.
            
            // Wait, the plan lists specific methods for OutputFactory:
            // - `register(StrategyClass)`
            // - `getStrategy(id)`
            // - `getAllStrategies()`
            // - `getSecretRequirementKeys()`
            
            // If `getAllStrategies` returns metadata, then `ConfigService` logic in plan is pseudo-code that might be slightly off or implies we get strategy classes?
            
            // Let's stick to:
            // `getAllStrategies()` returns metadata (as per plan description).
            // `getStrategy(id)` returns instance.
            // `getSecretRequirementKeys()` returns something useful.
            
            // BUT, ConfigService needs to know which env var maps to which param.
            // Code in plan:
            // `output.getSecretRequirementKeys().forEach(key => { const envKey = ${output.id.toUpperCase()}_${key.toUpperCase()}; ... })`
            // This requires iterating over strategies and getting their ID and keys.
            // If `getAllStrategies` returns metadata, we have `id` and `params`. We can filter params by sensitive.
            
            // So, `ConfigService` can just use the metadata!
            // It doesn't need instances.
            
            // `BaseOutput.getSecretRequirementKeys()` is an instance helper, but we can replicate logic or instantiate to use it.
            // Since we have metadata, we can just filter params.
            
            // So, `OutputFactory.getAllStrategies()` returning metadata seems correct for UI + ConfigService (if ConfigService is updated to use metadata).
            
            // But wait, the Plan's ConfigService snippet calls `output.getSecretRequirementKeys()`.
            // This strongly implies `output` is an object with methods.
            
            // I'll implement `getAllStrategies()` to return INSTANCES.
            // I'll add `getRegistry()` to return METADATA.
            // Or `getAllStrategies()` returns instances, and we use them.
            
            // The plan explicitly says: "- `getAllStrategies()` – returns metadata for UI discovery"
            
            // Okay, I will implement `getAllStrategies()` to return METADATA.
            // And I will implement `getSecretRequirementKeys()` on the FACTORY to handle the aggregation logic, so ConfigService doesn't loop.
            
            // Plan: "- `getSecretRequirementKeys()` – aggregates secrets across all outputs"
            
            // So ConfigService will call `OutputFactory.getSecretRequirementKeys()`.
            // That method will return... what?
            // "aggregates secrets" -> probably a list of objects { id, keys } or just list of ENV vars?
            // ConfigService needs to map ENV vars to config.
            // It needs to know: For strategy 'voicemonkey', key 'token', check env 'VOICEMONKEY_TOKEN'.
            
            // So `OutputFactory.getSecretRequirementKeys()` could return:
            // [ { strategyId: 'voicemonkey', key: 'token' }, ... ]
            
            // Let's write the test expecting this behavior.
            
            OutputFactory.register(MockOutput1);
            const requirements = OutputFactory.getSecretRequirementKeys();
            // Mock1: id='mock1', params=[{key:'secret', sensitive:true}]
            expect(requirements).toEqual(expect.arrayContaining([
                { strategyId: 'mock1', key: 'secret' }
            ]));
        });
    });
});


