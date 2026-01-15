const envManager = require('../../../src/utils/envManager');
const fs = require('fs');

jest.mock('fs');

describe('EnvManager', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...originalEnv };
    });
    
    afterAll(() => {
        process.env = originalEnv;
    });

    describe('isConfigured', () => {
        it('should return true if ADMIN_PASSWORD is set', () => {
             process.env.ADMIN_PASSWORD = 'hashed';
             expect(envManager.isConfigured()).toBe(true);
        });

         it('should return false if ADMIN_PASSWORD is unset', () => {
             delete process.env.ADMIN_PASSWORD;
             expect(envManager.isConfigured()).toBe(false);
        });
    });

    describe('getEnv', () => {
        it('should parse .env file', () => {
            const mockEnvContent = 'KEY=VALUE\nANOTHER=TEST';
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(mockEnvContent);
            
            const result = envManager.getEnv();
            expect(result.KEY).toBe('VALUE');
            expect(result.ANOTHER).toBe('TEST');
        });

        it('should return empty if file missing', () => {
            fs.existsSync.mockReturnValue(false);
            expect(envManager.getEnv()).toEqual({});
        });
    });

    describe('setEnvValue', () => {
        it('should append new value if key not exists', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('FOO=BAR');
            
            envManager.setEnvValue('NEW_KEY', 'NEW_VAL');
            
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('.env'),
                expect.stringContaining('NEW_KEY=NEW_VAL')
            );
            expect(process.env.NEW_KEY).toBe('NEW_VAL');
        });
        
        it('should update existing value', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('FOO=BAR\nTARGET=OLD');
            
            envManager.setEnvValue('TARGET', 'NEW');
            
            expect(fs.writeFileSync).toHaveBeenCalled();
            const calledContent = fs.writeFileSync.mock.calls[0][1];
            expect(calledContent).toContain('TARGET=NEW');
            expect(calledContent).not.toContain('TARGET=OLD');
            
            expect(process.env.TARGET).toBe('NEW');
        });
        
        it('should handle creating new file if missing', () => {
             fs.existsSync.mockReturnValue(false);
             fs.readFileSync.mockReturnValue(''); // New file, empty content
             
             envManager.setEnvValue('KEY', 'VAL');
             
             expect(fs.writeFileSync).toHaveBeenCalledWith(
                 expect.any(String),
                 expect.stringContaining('KEY=VAL')
             );
        });
    });

    describe('generateSecret', () => {
        it('should return a random string', () => {
             const secret1 = envManager.generateSecret();
             const secret2 = envManager.generateSecret();
             expect(secret1).not.toBe(secret2);
             expect(secret1.length).toBeGreaterThan(10);
        });
    });

    describe('deleteEnvValue', () => {
        it('should remove value if key exists', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('KEEP=YES\nDELETE=ME\nALSO=KEEP');
            
            envManager.deleteEnvValue('DELETE');
            
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                expect.any(String),
                expect.stringContaining('KEEP=YES\nALSO=KEEP')
            );
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                expect.any(String),
                expect.not.stringContaining('DELETE=ME')
            );
        });

        it('should do nothing if key does not exist', () => {
             fs.existsSync.mockReturnValue(true);
             fs.readFileSync.mockReturnValue('KEEP=YES');
             
             envManager.deleteEnvValue('MISSING');
             
             expect(fs.writeFileSync).not.toHaveBeenCalled();
        });

        it('should do nothing if file missing', () => {
             fs.existsSync.mockReturnValue(false);
             envManager.deleteEnvValue('KEY');
             expect(fs.writeFileSync).not.toHaveBeenCalled();
        });
    });
});
