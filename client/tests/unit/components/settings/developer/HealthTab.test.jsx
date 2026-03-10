import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HealthTab from '../../../../../src/components/settings/developer/HealthTab';

// Mock fetch
global.fetch = vi.fn();

describe('HealthTab', () => {
    const mockConfig = {
        system: {
            healthChecks: {
                api: true,
                tts: false,
                primarySource: true
            }
        },
        sources: {
            primary: { type: 'Aladhan' },
            backup: { type: 'Local', enabled: true }
        },
        automation: {
            outputs: {
                alexa: { enabled: true }
            }
        }
    };

    const mockSystemHealth = {
        api: { healthy: true, message: 'Healthy', lastChecked: '2026-02-04T12:00:00Z' },
        tts: { healthy: false, message: 'Unreachable', lastChecked: '2026-02-04T12:00:00Z' },
        primarySource: { healthy: true, message: 'Healthy', lastChecked: '2026-02-04T12:00:00Z' },
        backupSource: { healthy: true, message: 'Healthy', lastChecked: '2026-02-04T12:00:00Z' },
        alexa: { healthy: true, message: 'Healthy', lastChecked: '2026-02-04T12:00:00Z' }
    };

    const refreshHealth = vi.fn();
    const refresh = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        fetch.mockImplementation((url) => {
            if (url === '/api/system/services/registry') {
                return Promise.resolve({
                    json: () => Promise.resolve([
                        { id: 'api', label: 'API Server' },
                        { id: 'tts', label: 'TTS Service' }
                    ])
                });
            }
            if (url === '/api/system/outputs/registry') {
                return Promise.resolve({
                    json: () => Promise.resolve([
                        { id: 'alexa', label: 'Alexa Output' },
                        { id: 'local', label: 'Local Output', hidden: true }
                    ])
                });
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        });
    });

    it('should render null if no config', () => {
        const { container } = render(<HealthTab config={null} />);
        expect(container.firstChild).toBeNull();
    });

    it('should render health sections and rows', async () => {
        await act(async () => {
            render(<HealthTab config={mockConfig} systemHealth={mockSystemHealth} refreshHealth={refreshHealth} refresh={refresh} />);
        });

        expect(screen.getByText('System Services')).toBeDefined();
        expect(screen.getByText('Prayer Sources')).toBeDefined();
        expect(screen.getByText('Audio Outputs')).toBeDefined();

        expect(screen.getByText('API Server')).toBeDefined();
        expect(screen.getByText('TTS Service')).toBeDefined();
        expect(screen.getByText('Primary: Aladhan')).toBeDefined();
        expect(screen.getByText('Backup: Local')).toBeDefined();
        expect(screen.getByText('Alexa Output')).toBeDefined();
    });

    it('should handle toggle monitoring', async () => {
        fetch.mockImplementation((url) => {
            if (url === '/api/system/services/registry') {
                return Promise.resolve({
                    json: () => Promise.resolve([
                        { id: 'api', label: 'API Server' },
                        { id: 'tts', label: 'TTS Service' }
                    ])
                });
            }
            if (url === '/api/system/outputs/registry') {
                return Promise.resolve({
                    json: () => Promise.resolve([])
                });
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        });
        
        await act(async () => {
            render(<HealthTab config={mockConfig} systemHealth={mockSystemHealth} refreshHealth={refreshHealth} refresh={refresh} />);
        });

        const toggles = screen.getAllByRole('switch');
        // TTS toggle (index 1 based on systemServices)
        await act(async () => {
            fireEvent.click(toggles[1]);
        });

        expect(fetch).toHaveBeenCalledWith('/api/system/health/toggle', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ serviceId: 'tts', enabled: true })
        }));
        expect(refresh).toHaveBeenCalled();
    });

    it('should handle force refresh', async () => {
        fetch.mockImplementation((url) => {
            if (url === '/api/system/services/registry') {
                return Promise.resolve({
                    json: () => Promise.resolve([
                        { id: 'api', label: 'API Server' },
                        { id: 'tts', label: 'TTS Service' }
                    ])
                });
            }
            if (url === '/api/system/outputs/registry') {
                return Promise.resolve({
                    json: () => Promise.resolve([])
                });
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        });

        await act(async () => {
            render(<HealthTab config={mockConfig} systemHealth={mockSystemHealth} refreshHealth={refreshHealth} refresh={refresh} />);
        });

        const refreshButtons = screen.getAllByTitle('Force Refresh Health');
        await act(async () => {
            fireEvent.click(refreshButtons[0]); // API refresh
        });

        expect(fetch).toHaveBeenCalledWith('/api/system/health/refresh', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ target: 'api' })
        }));
        expect(refreshHealth).toHaveBeenCalledWith('api');
        expect(screen.getByText(/Refreshed/)).toBeDefined();
    });

    it('should handle force refresh failure', async () => {
        fetch.mockImplementation((url) => {
            if (url === '/api/system/services/registry') {
                return Promise.resolve({
                    json: () => Promise.resolve([
                        { id: 'api', label: 'API Server' },
                        { id: 'tts', label: 'TTS Service' }
                    ])
                });
            }
            if (url === '/api/system/outputs/registry') {
                return Promise.resolve({
                    json: () => Promise.resolve([])
                });
            }
            return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
        });

        await act(async () => {
            render(<HealthTab config={mockConfig} systemHealth={mockSystemHealth} refreshHealth={refreshHealth} refresh={refresh} />);
        });

        const refreshButtons = screen.getAllByTitle('Force Refresh Health');
        await act(async () => {
            fireEvent.click(refreshButtons[0]);
        });

        expect(screen.getByText(/Failed/)).toBeDefined();
    });

    it('should handle force refresh network error', async () => {
        fetch.mockRejectedValue(new Error('Network Error'));

        await act(async () => {
            render(<HealthTab config={mockConfig} systemHealth={mockSystemHealth} refreshHealth={refreshHealth} refresh={refresh} />);
        });

        const refreshButtons = screen.getAllByTitle('Force Refresh Health');
        await act(async () => {
            fireEvent.click(refreshButtons[0]);
        });

        expect(screen.getByText(/Network Error/)).toBeDefined();
    });

    it('should fallback to hardcoded services if registry fetch fails', async () => {
        fetch.mockImplementation((url) => {
            if (url === '/api/system/services/registry') {
                return Promise.reject(new Error('Registry Fail'));
            }
            if (url === '/api/system/outputs/registry') {
                return Promise.resolve({
                    json: () => Promise.resolve([])
                });
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        });

        await act(async () => {
            render(<HealthTab config={mockConfig} systemHealth={mockSystemHealth} refreshHealth={refreshHealth} refresh={refresh} />);
        });

        expect(screen.getByText('API Server')).toBeDefined();
        expect(screen.getByText('TTS Service')).toBeDefined();
    });

    it('should show different status indicators and messages', async () => {
        const customHealth = {
            ...mockSystemHealth,
            api: { healthy: true, message: 'Healthy' },
            tts: { healthy: false, message: 'Unreachable' },
            primarySource: { healthy: false, message: 'Token Missing' },
            backupSource: { healthy: true, message: 'Healthy' }
        };

        await act(async () => {
            render(<HealthTab config={mockConfig} systemHealth={customHealth} refreshHealth={refreshHealth} refresh={refresh} />);
        });

        expect(screen.getAllByText(/Healthy \/ Online/)).toBeDefined();
        expect(screen.getByText(/Unreachable \/ Offline/)).toBeDefined();
        expect(screen.getByText(/Token Missing/)).toBeDefined();
    });

    it('should show disabled status for disabled backup source', async () => {
        const configWithDisabledBackup = {
            ...mockConfig,
            sources: {
                ...mockConfig.sources,
                backup: { type: 'Local', enabled: false }
            }
        };

        await act(async () => {
            render(<HealthTab config={configWithDisabledBackup} systemHealth={mockSystemHealth} refreshHealth={refreshHealth} refresh={refresh} />);
        });

        expect(screen.getByText(/Output Strategy Disabled/)).toBeDefined();
    });

    it('should handle toggle monitoring for outputs', async () => {
        fetch.mockImplementation((url) => {
            if (url === '/api/system/services/registry') {
                return Promise.resolve({
                    json: () => Promise.resolve([
                        { id: 'api', label: 'API Server' },
                        { id: 'tts', label: 'TTS Service' }
                    ])
                });
            }
            if (url === '/api/system/outputs/registry') {
                return Promise.resolve({
                    json: () => Promise.resolve([
                        { id: 'alexa', label: 'Alexa Output' }
                    ])
                });
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        });
        
        await act(async () => {
            render(<HealthTab config={mockConfig} systemHealth={mockSystemHealth} refreshHealth={refreshHealth} refresh={refresh} />);
        });

        const toggles = screen.getAllByRole('switch');
        // Alexa toggle (index 4: API, TTS, Primary, Backup, Alexa)
        await act(async () => {
            fireEvent.click(toggles[4]);
        });

        expect(fetch).toHaveBeenCalledWith('/api/system/health/toggle', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ serviceId: 'alexa', enabled: true })
        }));
    });

    it('should handle force refresh for outputs', async () => {
        fetch.mockImplementation((url) => {
            if (url === '/api/system/services/registry') {
                return Promise.resolve({
                    json: () => Promise.resolve([
                        { id: 'api', label: 'API Server' },
                        { id: 'tts', label: 'TTS Service' }
                    ])
                });
            }
            if (url === '/api/system/outputs/registry') {
                return Promise.resolve({
                    json: () => Promise.resolve([
                        { id: 'alexa', label: 'Alexa Output' }
                    ])
                });
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        });

        await act(async () => {
            render(<HealthTab config={mockConfig} systemHealth={mockSystemHealth} refreshHealth={refreshHealth} refresh={refresh} />);
        });

        const refreshButtons = screen.getAllByTitle('Force Refresh Health');
        await act(async () => {
            fireEvent.click(refreshButtons[4]); // Alexa refresh
        });

        expect(fetch).toHaveBeenCalledWith('/api/system/health/refresh', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ target: 'alexa' })
        }));
    });

    it('should show online status when monitored but not yet checked', async () => {
        const configWithApiChecked = {
            ...mockConfig,
            system: {
                healthChecks: {
                    api: true
                }
            }
        };
        const healthWithNoData = {
            ...mockSystemHealth,
            api: null // Not checked yet
        };

        await act(async () => {
            render(<HealthTab config={configWithApiChecked} systemHealth={healthWithNoData} refreshHealth={refreshHealth} refresh={refresh} />);
        });

        // status is 'online' for API by default in HealthTab.jsx:120
        expect(screen.getAllByText(/Healthy \/ Online/)).toBeDefined();
    });

    it('should show unreachable status when monitored but not yet checked and status is offline', async () => {
        const configWithTtsChecked = {
            ...mockConfig,
            system: {
                healthChecks: {
                    tts: true
                }
            }
        };
        const healthWithNoData = {
            ...mockSystemHealth,
            tts: null // Not checked yet
        };

        await act(async () => {
            render(<HealthTab config={configWithTtsChecked} systemHealth={healthWithNoData} refreshHealth={refreshHealth} refresh={refresh} />);
        });

        expect(screen.getByText(/Unreachable \/ Offline/)).toBeDefined();
    });

    it('should display per-service lastChecked timestamps, not global', async () => {
        const perServiceHealth = {
            api: { healthy: true, message: 'Healthy', lastChecked: '2026-02-04T12:00:00Z' },
            tts: { healthy: false, message: 'Unreachable', lastChecked: '2026-02-04T10:00:00Z' },
            primarySource: { healthy: true, message: 'Healthy', lastChecked: '2026-02-04T08:00:00Z' },
            backupSource: { healthy: true, message: 'Healthy', lastChecked: null },
            alexa: { healthy: true, message: 'Healthy', lastChecked: '2026-02-04T14:00:00Z' }
        };

        fetch.mockImplementation((url) => {
            if (url === '/api/system/services/registry') {
                return Promise.resolve({
                    json: () => Promise.resolve([
                        { id: 'api', label: 'API Server' },
                        { id: 'tts', label: 'TTS Service' }
                    ])
                });
            }
            if (url === '/api/system/outputs/registry') {
                return Promise.resolve({
                    json: () => Promise.resolve([
                        { id: 'alexa', label: 'Alexa Output' }
                    ])
                });
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        });

        await act(async () => {
            render(<HealthTab config={mockConfig} systemHealth={perServiceHealth} refreshHealth={refreshHealth} refresh={refresh} />);
        });

        // TTS was checked at 10:00 — its row should show TTS's own lastChecked
        const ttsTime = new Date('2026-02-04T10:00:00Z').toLocaleTimeString();
        expect(screen.getByText(new RegExp(ttsTime))).toBeDefined();

        // API was checked at 12:00
        const apiTime = new Date('2026-02-04T12:00:00Z').toLocaleTimeString();
        expect(screen.getByText(new RegExp(apiTime))).toBeDefined();

        // Backup source has lastChecked: null — should NOT show a Last Checked time
        // (backupSource row should not contain 'Last Checked')
        const backupRow = screen.getByText('Backup: Local').closest('div[class*="flex items-center justify-between"]');
        expect(backupRow.textContent).not.toContain('Last Checked');
    });
});
