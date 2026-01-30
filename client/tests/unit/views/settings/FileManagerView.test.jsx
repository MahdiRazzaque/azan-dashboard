import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import FileManagerView from '../../../../src/views/settings/FileManagerView';
import { useSettings } from '../../../../src/hooks/useSettings';

vi.mock('../../../../src/hooks/useSettings');
vi.mock('../../../../src/components/common/AudioTestModal', () => ({ default: ({ isOpen, onTest }) => isOpen ? <div data-testid="test-modal"><button onClick={() => onTest('local')}>Test</button></div> : null }));
vi.mock('../../../../src/components/common/ConfirmModal', () => ({ default: ({ isOpen, onConfirm, title }) => isOpen ? <div data-testid="confirm-modal">{title}<button onClick={onConfirm}>Confirm</button></div> : null }));

describe('FileManagerView', () => {
  const mockFiles = [
    { name: 'custom1.mp3', path: 'custom/1.mp3', url: '/url/1', type: 'custom' },
    { name: 'tts_fajr_adhan.mp3', path: 'cache/fajr.mp3', url: '/url/fajr', type: 'cache' }
  ];

  let mockAudio;

  beforeEach(() => {
    vi.clearAllMocks();
    useSettings.mockReturnValue({ systemHealth: {}, config: { automation: { baseUrl: 'http://base' } } });
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url) => {
        if (url === '/api/system/audio-files') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockFiles) });
        if (url === '/api/system/outputs/registry') return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) });
    }));
    
    mockAudio = {
        play: vi.fn().mockResolvedValue(),
        pause: vi.fn(),
        src: '',
        onended: null
    };
    vi.stubGlobal('Audio', vi.fn().mockImplementation(function() { return mockAudio; }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render correctly and load files', async () => {
    render(<FileManagerView />);
    expect(screen.getByText('Audio Manager')).toBeDefined();
    await waitFor(() => expect(screen.getByText('custom1.mp3')).toBeDefined());
    expect(screen.getByText('tts_fajr_adhan.mp3')).toBeDefined();
  });

  it('should handle file upload validation', async () => {
    render(<FileManagerView />);
    await waitFor(() => expect(screen.getByText('Custom Files')).toBeDefined());
    const input = document.getElementById('audio-upload');
    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByText('Only MP3 files are allowed')).toBeDefined();
  });

  it('should handle successful upload', async () => {
    render(<FileManagerView />);
    await waitFor(() => expect(screen.getByText('Custom Files')).toBeDefined());
    const input = document.getElementById('audio-upload');
    const file = new File(['test'], 'new.mp3', { type: 'audio/mpeg' });
    
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/settings/upload', expect.any(Object)));
  });

  it('should handle overwrite confirmation', async () => {
    render(<FileManagerView />);
    await waitFor(() => expect(screen.getByText('custom1.mp3')).toBeDefined());
    const input = document.getElementById('audio-upload');
    const file = new File(['test'], 'custom1.mp3', { type: 'audio/mpeg' });
    
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText(/Overwrite Existing File/)).toBeDefined());
    
    fireEvent.click(screen.getByText('Confirm'));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/settings/upload', expect.any(Object)));
  });

  it('should handle delete flow', async () => {
    render(<FileManagerView />);
    await waitFor(() => screen.getByText('custom1.mp3'));
    
    const deleteButton = screen.getByTitle('Delete File');
    fireEvent.click(deleteButton);
    expect(screen.getByText(/Delete File/)).toBeDefined();
    
    fireEvent.click(screen.getByText('Confirm'));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/settings/files', expect.any(Object)));
  });

  it('should handle upload error (413 Storage Limit)', async () => {
    fetch.mockImplementation((url) => {
        if (url === '/api/settings/upload') return Promise.resolve({ ok: false, status: 413 });
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });
    render(<FileManagerView />);
    await waitFor(() => screen.getByText('Custom Files'));
    const input = document.getElementById('audio-upload');
    const file = new File(['test'], 'new.mp3', { type: 'audio/mpeg' });
    
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText('Storage Limit Exceeded')).toBeDefined());
  });

  it('should handle upload rejected by server (network error)', async () => {
    fetch.mockImplementation((url) => {
        if (url === '/api/settings/upload') {
            const err = new TypeError('Failed to fetch');
            return Promise.reject(err);
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });
    render(<FileManagerView />);
    await waitFor(() => screen.getByText('Custom Files'));
    const input = document.getElementById('audio-upload');
    const file = new File(['test'], 'new.mp3', { type: 'audio/mpeg' });
    
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText(/rejected by server/)).toBeDefined());
  });

  it('should handle server playback failure', async () => {
    fetch.mockImplementation((url) => {
        if (url.includes('/test')) return Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'Server Play Error' }) });
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockFiles) });
    });
    render(<FileManagerView />);
    await waitFor(() => screen.getByText('custom1.mp3'));
    
    fireEvent.click(screen.getAllByTitle('Test on Speakers')[0]);
    fireEvent.click(screen.getByText('Test'));
    
    await waitFor(() => expect(screen.getByText('Server Play Error')).toBeDefined());
  });

  it('should handle browser playback success', async () => {
    render(<FileManagerView />);
    await waitFor(() => screen.getByText('custom1.mp3'));
    
    const playButton = screen.getAllByTitle('Preview in Browser')[0];
    fireEvent.click(playButton);
    expect(mockAudio.play).toHaveBeenCalled();
  });

  it('should handle server playback success', async () => {
    render(<FileManagerView />);
    await waitFor(() => screen.getByText('custom1.mp3'));
    
    const testButton = screen.getAllByTitle('Test on Speakers')[0];
    fireEvent.click(testButton);
    fireEvent.click(screen.getByText('Test'));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/test'), expect.any(Object)));
  });

  it('should handle browser playback failure', async () => {
    mockAudio.play.mockRejectedValue(new Error('Browser Blocked'));
    render(<FileManagerView />);
    await waitFor(() => screen.getByText('custom1.mp3'));
    
    fireEvent.click(screen.getAllByTitle('Preview in Browser')[0]);
    await waitFor(() => expect(screen.getByText(/Playback failed: Browser Blocked/)).toBeDefined());
  });

  it('should handle server playback failure without message', async () => {
    fetch.mockImplementation((url) => {
        if (url.includes('/test')) return Promise.reject({}); // No message field
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockFiles) });
    });
    render(<FileManagerView />);
    await waitFor(() => screen.getByText('custom1.mp3'));
    
    fireEvent.click(screen.getAllByTitle('Test on Speakers')[0]);
    fireEvent.click(screen.getByText('Test'));
    
    await waitFor(() => expect(screen.getByText('Server playback request failed')).toBeDefined());
  });

  it('should handle toggle grouped sections', async () => {
    render(<FileManagerView />);
    // Use getByRole if possible, or more specific query
    const fajrHeader = await screen.findByRole('heading', { name: /fajr/i });
    
    expect(screen.getByText('tts_fajr_adhan.mp3')).toBeDefined();
    fireEvent.click(fajrHeader); // Collapse
    expect(screen.queryByText('tts_fajr_adhan.mp3')).toBeNull();
  });
});
