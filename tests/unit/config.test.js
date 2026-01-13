const fs = require('fs');
const path = require('path');

describe('Configuration Loader', () => {
  beforeEach(() => {
    jest.resetModules();
    // Spy on console.error to suppress expected logs
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should load valid default configuration', () => {
    const config = require('../../src/config');
    expect(config.location.timezone).toBe('Europe/London');
    expect(config.prayers.fajr.iqamahOffset).toBe(20);
    expect(config.sources.primary.type).toBe('aladhan');
  });

  test('should throw error for invalid configuration', () => {
    // Mock fs.readFileSync to return invalid JSON data
    jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({
      location: { timezone: 'Europe/London' } 
      // missing everything else
    }));

    expect(() => {
      require('../../src/config');
    }).toThrow('Configuration validation failed');
    
    // Verify error was logged (optional, but good practice to ensure system behaves as expected)
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Configuration validation failed'), expect.any(String));
  });

  test('should validate prayer settings types', () => {
    jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({
      location: {
        timezone: "Europe/London",
        coordinates: { "lat": 51.5074, "long": -0.1278 }
      },
      calculation: {
        method: "MoonsightingCommittee",
        madhab: "Hanafi"
      },
      prayers: {
        fajr: { "iqamahOffset": "should be string", "roundTo": 15, "fixedTime": null }, // Invalid type
        dhuhr: { "iqamahOffset": 15, "roundTo": 15, "fixedTime": null },
        asr: { "iqamahOffset": 15, "roundTo": 15, "fixedTime": null },
        maghrib: { "iqamahOffset": 10, "roundTo": 5, "fixedTime": null },
        isha: { "iqamahOffset": 15, "roundTo": 15, "fixedTime": "20:00" }
      },
      sources: {
        primary: { "type": "aladhan" }
      }
    }));

    expect(() => {
      require('../../src/config');
    }).toThrow('Configuration validation failed');
    
    expect(console.error).toHaveBeenCalled();
  });
});
