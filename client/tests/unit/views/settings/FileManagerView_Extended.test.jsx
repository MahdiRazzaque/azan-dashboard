import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FileManagerView from '../../../../src/views/settings/FileManagerView';
import { useSettings } from '../../../../src/hooks/useSettings';

vi.mock('../../../../src/hooks/useSettings');
vi.mock('../../../../src/components/common/AudioTestModal', () => ({ 
    default: ({ isOpen, onTest, onClose, file }) => isOpen ? (
        <div data-testid="test-modal">
            <button onClick={() => onTest('alexa')}>Test Alexa</button>
            <button onClick={onClose}>Close</button>
        </div>
    ) : null 
}));
vi.mock('../../../../src/components/common/ConfirmModal', () => ({ 
    default: ({ isOpen, onConfirm, onCancel, onClose, title }) => isOpen ? (
        <div data-testid="confirm-modal">
            {title}
            <button onClick={onConfirm}>Confirm</button>
            <button onClick={onCancel || onClose}>Cancel</button>
        </div>
    ) : null 
}));

describe('FileManagerView Extended Coverage', () => {
    const mockFiles = [
        { name: 'custom1.mp3', path: 'custom/1.mp3', url: '/url/1', type: 'custom', metadata: { protected: false } },
        { name: 'tts_other_file.mp3', path: 'cache/other.mp3', url: '/url/other', type: 'cache' }
    ];

    let mockAudio;

    beforeEach(() => {
        vi.clearAllMocks();
        useSettings.mockReturnValue({ 
            systemHealth: {}, 
            config: { automation: { baseUrl: 'http://base' } } 
        });
        
        vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url) => {
            if (url === '/api/system/audio-files') {
                return {
                    ok: true,
                    json: () => Promise.resolve({ files: mockFiles })
                };
            }
            if (url === '/api/system/outputs/registry') {
                return {
                    ok: true,
                    json: () => Promise.resolve([{ id: 'alexa', label: 'Alexa' }])
                };
            }
            return { ok: true, json: () => Promise.resolve({ success: true }) };
        }));

        mockAudio = { 
            play: vi.fn().mockResolvedValue(), 
            pause: vi.fn(), 
            src: '', 
            onended: null 
        };
        vi.stubGlobal('Audio', vi.fn().mockImplementation(function() { return mockAudio; }));
    });

    it('should handle empty file selection in handleUpload', async () => {
        render(<FileManagerView />);
        await screen.findByText('custom1.mp3');
        const input = screen.getByLabelText(/Upload MP3/i);
        
        fireEvent.change(input, { target: { files: [] } });
        // Nothing should happen, performUpload should not be called
        expect(fetch).not.toHaveBeenCalledWith('/api/settings/upload', expect.anything());
    });

    it('should reject non-mp3 files', async () => {
        render(<FileManagerView />);
        await screen.findByText('custom1.mp3');
        const input = screen.getByLabelText(/Upload MP3/i);
        
        fireEvent.change(input, { target: { files: [new File([''], 'test.txt', { type: 'text/plain' })] } });
        expect(screen.getByText('Only MP3 files are allowed')).toBeDefined();
    });

    it('should handle upload failure with JSON error message', async () => {
        fetch.mockImplementation(async (url) => {
            if (url === '/api/system/audio-files') return { ok: true, json: () => Promise.resolve({ files: [] }) };
            if (url === '/api/settings/upload') {
                return {
                    ok: false,
                    json: () => Promise.resolve({ message: 'Custom Error Message' })
                };
            }
            return { ok: true, json: () => Promise.resolve([]) };
        });

        render(<FileManagerView />);
        const input = screen.getByLabelText(/Upload MP3/i);
        
        await act(async () => {
            fireEvent.change(input, { target: { files: [new File([''], 'new.mp3', { type: 'audio/mpeg' })] } });
        });

        expect(await screen.findByText('Custom Error Message')).toBeDefined();
    });

    it('should handle upload failure with 413 status', async () => {
        fetch.mockImplementation(async (url) => {
            if (url === '/api/system/audio-files') return { ok: true, json: () => Promise.resolve({ files: [] }) };
            if (url === '/api/settings/upload') {
                return {
                    ok: false,
                    status: 413,
                    json: () => Promise.reject(new Error('Not JSON'))
                };
            }
            return { ok: true, json: () => Promise.resolve([]) };
        });

        render(<FileManagerView />);
        const input = screen.getByLabelText(/Upload MP3/i);
        
        await act(async () => {
            fireEvent.change(input, { target: { files: [new File([''], 'new.mp3', { type: 'audio/mpeg' })] } });
        });

        expect(await screen.findByText('Storage Limit Exceeded')).toBeDefined();
    });

    it('should handle upload network error (TypeError: Failed to fetch)', async () => {
        fetch.mockImplementation(async (url) => {
            if (url === '/api/system/audio-files') return { ok: true, json: () => Promise.resolve({ files: [] }) };
            if (url === '/api/settings/upload') {
                const err = new TypeError('Failed to fetch');
                throw err;
            }
            return { ok: true, json: () => Promise.resolve([]) };
        });

        render(<FileManagerView />);
        const input = screen.getByLabelText(/Upload MP3/i);
        
        await act(async () => {
            fireEvent.change(input, { target: { files: [new File([''], 'new.mp3', { type: 'audio/mpeg' })] } });
        });

        expect(await screen.findByText(/Upload rejected by server/)).toBeDefined();
    });

    it('should handle delete failure', async () => {
        render(<FileManagerView />);
        await screen.findByText('custom1.mp3');
        
        fetch.mockImplementation(async (url) => {
            if (url === '/api/settings/files') return { ok: false };
            return { ok: true, json: () => Promise.resolve({ files: mockFiles }) };
        });

        fireEvent.click(screen.getByTitle('Delete File'));
        await act(async () => {
            fireEvent.click(screen.getByText('Confirm'));
        });

        expect(await screen.findByText('Delete failed')).toBeDefined();
    });

    it('should handle server play failure with error message', async () => {
        render(<FileManagerView />);
        await screen.findByText('custom1.mp3');
        
        fetch.mockImplementation(async (url) => {
            if (url.includes('/test')) {
                return {
                    ok: false,
                    json: () => Promise.resolve({ error: 'Server Play Error' })
                };
            }
            return { ok: true, json: () => Promise.resolve({ files: mockFiles }) };
        });

        fireEvent.click(screen.getAllByTitle('Test on Speakers')[0]);
        await act(async () => {
            fireEvent.click(screen.getByText('Test Alexa'));
        });

        expect(await screen.findByText('Server Play Error')).toBeDefined();
    });

    it('should show empty message when no files', async () => {
        fetch.mockImplementation(async (url) => {
            if (url === '/api/system/audio-files') return { ok: true, json: () => Promise.resolve({ files: [] }) };
            return { ok: true, json: () => Promise.resolve([]) };
        });

        render(<FileManagerView />);
        await waitFor(() => {
            expect(screen.getAllByText('No files found').length).toBeGreaterThan(0);
        });
        expect(screen.getByText('No cached speech files found')).toBeDefined();
    });

    it('should handle overwrite cancel', async () => {
        render(<FileManagerView />);
        await screen.findByText('custom1.mp3');
        const input = screen.getByLabelText(/Upload MP3/i);
        
        // Select existing file
        fireEvent.change(input, { target: { files: [new File([''], 'custom1.mp3', { type: 'audio/mpeg' })] } });
        
        expect(screen.getByTestId('confirm-modal')).toBeDefined();
        fireEvent.click(screen.getByText('Cancel'));
        expect(screen.queryByTestId('confirm-modal')).toBeNull();
    });

    it('should handle delete cancel', async () => {
        render(<FileManagerView />);
        await screen.findByText('custom1.mp3');
        
        fireEvent.click(screen.getByTitle('Delete File'));
        expect(screen.getByTestId('confirm-modal')).toBeDefined();
        
        await act(async () => {
            fireEvent.click(screen.getByText('Cancel'));
        });
        expect(screen.queryByTestId('confirm-modal')).toBeNull();
    });

    it('should render grouped cache files and handle interactions', async () => {
        const manyFiles = [
            ...mockFiles,
            { name: 'tts_fajr_adhan.mp3', path: 'cache/fajr.mp3', url: '/url/fajr', type: 'cache' }
        ];
        fetch.mockImplementation(async (url) => {
            if (url === '/api/system/audio-files') return { ok: true, json: () => Promise.resolve({ files: manyFiles }) };
            return { ok: true, json: () => Promise.resolve([]) };
        });

        render(<FileManagerView />);
        await screen.findByText('fajr');
        await screen.findByText('other');

        // Toggle fajr section (it's open by default because collapsedSections[fajr] is undefined)
        // Wait, toggleSection toggles it.
        fireEvent.click(screen.getByText('fajr')); // Should collapse
        expect(screen.queryByText('tts_fajr_adhan.mp3')).toBeNull();
        
        fireEvent.click(screen.getByText('fajr')); // Should expand
        expect(screen.getByText('tts_fajr_adhan.mp3')).toBeDefined();

        // Interact with a file in the cache
        const playBtns = screen.getAllByTitle('Preview in Browser');
        // index 0 is custom1.mp3, index 1 is tts_fajr_adhan.mp3, index 2 is tts_other_file.mp3
        await act(async () => {
            fireEvent.click(playBtns[1]);
        });
        expect(mockAudio.play).toHaveBeenCalled();
    });
});
