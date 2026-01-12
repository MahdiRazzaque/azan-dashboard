const { DateTime, Settings } = require('luxon');

describe('Test Environment Time Configuration', () => {
  afterEach(() => {
    // Restore default
    Settings.defaultZone = 'system';
    jest.useRealTimers();
  });

  test('should allow mocking the system time', () => {
    // Mock time to 2024-01-01 12:00:00 UTC
    const mockDate = new Date('2024-01-01T12:00:00Z');
    jest.useFakeTimers({ now: mockDate });

    expect(new Date().toISOString()).toBe('2024-01-01T12:00:00.000Z');
    expect(DateTime.now().toUTC().toISO()).toBe('2024-01-01T12:00:00.000Z');
  });

  test('should allow mocking the Timezone', () => {
    // Set zone to America/New_York
    Settings.defaultZone = 'America/New_York';
    
    const now = DateTime.now();
    expect(now.zoneName).toBe('America/New_York');
    
    // Set zone to Europe/London
    Settings.defaultZone = 'Europe/London';
    expect(DateTime.now().zoneName).toBe('Europe/London');
  });
});
