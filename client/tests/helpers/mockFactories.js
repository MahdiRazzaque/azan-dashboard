import { vi } from "vitest";

/**
 * Creates a default mock for useSettings hook.
 * @param {object} [overrides] - Properties to override on the default mock
 * @returns {object} Mock useSettings return value
 */
export function createMockSettings(overrides = {}) {
  return {
    config: {},
    draftConfig: {},
    loading: false,
    saving: false,
    saveSettings: vi.fn(() => Promise.resolve()),
    updateSetting: vi.fn(),
    updateEnvSetting: vi.fn(() => Promise.resolve({ success: true })),
    resetDraft: vi.fn(),
    resetToDefaults: vi.fn(() => Promise.resolve({ success: true })),
    hasUnsavedChanges: vi.fn(() => false),
    isSectionDirty: vi.fn(() => false),
    getSectionHealth: vi.fn(() => ({ healthy: true, issues: [] })),
    refresh: vi.fn(() => Promise.resolve()),
    systemHealth: {},
    refreshHealth: vi.fn(() => Promise.resolve({ success: true })),
    validateBeforeSave: vi.fn(() => ({ success: true })),
    bulkUpdateOffsets: vi.fn(() => 0),
    bulkUpdateIqamahOffsets: vi.fn(() => 0),
    voices: [],
    voicesLoading: false,
    voicesError: null,
    fetchVoices: vi.fn(() => Promise.resolve()),
    providers: [],
    providersLoading: false,
    fetchProviders: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
}

/**
 * Creates a default mock for useAuth hook.
 * @param {object} [overrides] - Properties to override
 * @returns {object} Mock useAuth return value
 */
export function createMockAuth(overrides = {}) {
  return {
    isAuthenticated: true,
    loading: false,
    login: vi.fn(() => Promise.resolve({ success: true })),
    logout: vi.fn(),
    setupRequired: false,
    refreshAuth: vi.fn(() => Promise.resolve()),
    connectionError: false,
    clearConnectionError: vi.fn(),
    user: null,
    ...overrides,
  };
}
