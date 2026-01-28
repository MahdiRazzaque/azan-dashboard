const VoiceMonkeyOutput = require('../../../src/outputs/VoiceMonkeyOutput');
const axios = require('axios');
const fs = require('fs');
const ConfigService = require('../../../src/config');

jest.mock('axios');
jest.mock('fs');
jest.mock('../../../src/config');
jest.mock('../../../src/utils/requestQueue', () => ({
    voiceMonkeyQueue: {
        schedule: jest.fn((fn) => fn())
    }
}));

describe('VoiceMonkeyOutput', () => {
    let output;

    beforeEach(() => {
        output = new VoiceMonkeyOutput();
        jest.clearAllMocks();
        fs.existsSync.mockReturnValue(false); // Default: no sidecar file
        
        // Default Config Mock
        ConfigService.get.mockReturnValue({
            automation: {
                baseUrl: 'https://test.com',
                outputs: {
                    voicemonkey: {
                        params: { token: 'envToken', device: 'envDevice' }
                    }
                }
            }
        });
    });

    describe('Metadata', () => {
        it('should return correct metadata', () => {
            const meta = VoiceMonkeyOutput.getMetadata();
            expect(meta.id).toBe('voicemonkey');
            expect(meta.params).toHaveLength(2);
        });
    });

    describe('execute', () => {
        const payload = {
            source: { filePath: '/audio/azan.mp3', url: '/public/azan.mp3' },
            params: { token: 'paramToken', device: 'paramDevice' },
            baseUrl: 'https://override.com' 
        };

        it('should use passed params and baseUrl', async () => {
            axios.get.mockResolvedValue({ data: { success: true } });

            await output.execute(payload);

            expect(axios.get).toHaveBeenCalledWith(
                'https://api-v2.voicemonkey.io/announcement',
                expect.objectContaining({
                    params: expect.objectContaining({
                        token: 'paramToken',
                        device: 'paramDevice',
                        audio: 'https://override.com/public/azan.mp3'
                    })
                })
            );
        });
        
        it('should fall back to config if params missing', async () => {
            axios.get.mockResolvedValue({ data: { success: true } });
            // Payload without params, but with baseUrl
            const partialPayload = { 
                source: { filePath: '/f.mp3', url: '/f.mp3' }, 
                baseUrl: 'https://test.com'
            };
            
            await output.execute(partialPayload);
            
            expect(axios.get).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    params: expect.objectContaining({
                        token: 'envToken',
                        device: 'envDevice'
                    })
                })
            );
        });

        it('should fail if audio metadata is incompatible', async () => {
             fs.existsSync.mockReturnValue(true);
             fs.readFileSync.mockReturnValue(JSON.stringify({ vmCompatible: false }));
             
             await output.execute(payload);
             expect(axios.get).not.toHaveBeenCalled();
        });
    });

    describe('healthCheck', () => {
        it('should use config and return healthy', async () => {
            axios.get.mockResolvedValue({ data: { success: true } });
            const result = await output.healthCheck(); 
            
            expect(result.healthy).toBe(true);
            expect(axios.get).toHaveBeenCalled();
        });
        
        it('should always generate random device for health check', async () => {
            axios.get.mockResolvedValue({ data: { success: true } });
            await output.healthCheck();
            
            const callParams = axios.get.mock.calls[0][1].params;
            expect(callParams.device).toMatch(/^azan_check_/);
        });
    });

    describe('verifyCredentials', () => {
        it('should call API with provided credentials', async () => {
            axios.get.mockResolvedValue({ data: { success: true } });
            const result = await output.verifyCredentials({ token: 't', device: 'd' });
            expect(result.success).toBe(true);
            
            const callParams = axios.get.mock.calls[0][1].params;
            expect(callParams.token).toBe('t');
            expect(callParams.device).toBe('d');
        });
    });
});
