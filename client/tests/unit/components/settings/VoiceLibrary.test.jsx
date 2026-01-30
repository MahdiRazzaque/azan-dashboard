import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import VoiceLibrary from '../../../../src/components/settings/VoiceLibrary';
import { useSettings } from '../../../../src/hooks/useSettings';

vi.mock('../../../../src/hooks/useSettings');
vi.mock('../../../../src/components/common/SearchableSelect', () => ({ default: ({ value, onChange, options }) => (
    <select data-testid="searchable-select" value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
) }));

describe('VoiceLibrary', () => {
  const updateSetting = vi.fn();
  const mockVoices = [
    { ShortName: 'en-GB-Sonia', Name: 'Sonia', FriendlyName: 'Sonia Natural', Gender: 'Female', Locale: 'en-GB' },
    { ShortName: 'ar-SA-Zari', Name: 'Zari', FriendlyName: 'Zari', Gender: 'Female', Locale: 'ar-SA' },
    { ShortName: 'en-US-Guy', Name: 'Guy', FriendlyName: 'Guy', Gender: 'Male', Locale: 'en-US' }
  ];

  const baseMock = {
    config: { automation: { defaultVoice: 'en-GB-Sonia' } },
    draftConfig: { automation: { defaultVoice: 'en-GB-Sonia' } },
    updateSetting,
    voices: mockVoices,
    voicesLoading: false,
    voicesError: null
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useSettings.mockReturnValue(baseMock);
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render correctly', () => {
    render(<VoiceLibrary />);
    expect(screen.getByPlaceholderText('Search voices...')).toBeDefined();
  });

  it('should filter voices by search', () => {
    render(<VoiceLibrary />);
    const searchInput = screen.getByPlaceholderText('Search voices...');
    fireEvent.change(searchInput, { target: { value: 'Zari' } });
    expect(screen.getByText('ar-SA-Zari')).toBeDefined();
  });

  it('should handle cleanVoiceName edge cases', () => {
    const customVoices = [{ 
        ShortName: 'v1', 
        FriendlyName: 'Microsoft David Online (Natural) - English', 
        Name: 'David',
        Gender: 'Male', 
        Locale: 'en-US' 
    }];
    useSettings.mockReturnValue({ ...baseMock, voices: customVoices });
    render(<VoiceLibrary />);
    expect(screen.getByText('David')).toBeDefined();
  });

  it('should handle cleanVoiceName with missing FriendlyName', () => {
    const customVoices = [{ 
        ShortName: 'en-US-David', 
        Name: 'David',
        Gender: 'Male', 
        Locale: 'en-US' 
    }];
    useSettings.mockReturnValue({ ...baseMock, voices: customVoices });
    render(<VoiceLibrary />);
    expect(screen.getByText('David')).toBeDefined();
  });

  it('should handle getLanguage and getRegion fallbacks', () => {
    const customVoices = [{ ShortName: 'v1', FriendlyName: 'V1', Name: 'V1', Gender: 'Male', Locale: 'xx-YY' }];
    useSettings.mockReturnValue({ ...baseMock, voices: customVoices });
    render(<VoiceLibrary />);
    expect(screen.getByText('XX')).toBeDefined();
    expect(screen.getByText('YY')).toBeDefined();
  });

  it('should handle voice preview flow and onended', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ url: 'preview.mp3' })
    });
    
    let capturedOnEnded;
    const mockAudio = {
        play: vi.fn().mockResolvedValue(),
        set onended(cb) { capturedOnEnded = cb; },
        get onended() { return capturedOnEnded; },
        set onerror(cb) {}
    };
    vi.stubGlobal('Audio', vi.fn().mockImplementation(function() { return mockAudio; }));

    render(<VoiceLibrary />);
    const firstRow = screen.getAllByRole('row')[1];
    fireEvent.click(firstRow.querySelector('button'));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/system/preview-tts', expect.any(Object)));
    await waitFor(() => expect(capturedOnEnded).toBeDefined());
    act(() => { capturedOnEnded(); });
  });

  it('should handle failed preview from API', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fetch.mockResolvedValueOnce({ ok: false });
    render(<VoiceLibrary />);
    const firstRow = screen.getAllByRole('row')[1];
    fireEvent.click(firstRow.querySelector('button'));

    await waitFor(() => expect(consoleSpy).toHaveBeenCalled());
    consoleSpy.mockRestore();
  });

  it('should handle set default voice', () => {
    render(<VoiceLibrary />);
    const setButtons = screen.getAllByText('Set Default');
    fireEvent.click(setButtons[1]); // Guy
    expect(updateSetting).toHaveBeenCalledWith('automation.defaultVoice', 'en-US-Guy');
  });

  it('should show pending save indicator', () => {
    useSettings.mockReturnValue({
        config: { automation: { defaultVoice: 'en-GB-Sonia' } },
        draftConfig: { automation: { defaultVoice: 'ar-SA-Zari' } },
        updateSetting,
        voices: mockVoices,
        voicesLoading: false
    });
    render(<VoiceLibrary />);
    expect(screen.getByText('Pending Save')).toBeDefined();
  });

  it('should handle Arabic warning branches', () => {
    // Non-Arabic voice with Arabic text
    useSettings.mockReturnValue({
        ...baseMock,
        config: { automation: { defaultVoice: 'en-US-Guy' } },
        draftConfig: { automation: { defaultVoice: 'en-US-Guy' } }
    });
    const { rerender } = render(<VoiceLibrary />);
    expect(screen.getByText(/Pronunciation Warning/)).toBeDefined();

    // Arabic voice with Arabic text
    useSettings.mockReturnValue({
        ...baseMock,
        config: { automation: { defaultVoice: 'ar-SA-Zari' } },
        draftConfig: { automation: { defaultVoice: 'ar-SA-Zari' } }
    });
    rerender(<VoiceLibrary />);
    expect(screen.queryByText(/Pronunciation Warning/)).toBeNull();
  });

  it('should handle reset preview template', () => {
    render(<VoiceLibrary />);
    const toggleButton = screen.getByText('Quick Preview Controls');
    fireEvent.click(toggleButton);
    
    const input = screen.getByPlaceholderText(/minutes until/);
    fireEvent.change(input, { target: { value: 'custom' } });
    
    fireEvent.click(screen.getByText('Reset Template'));
    expect(input.value).toContain('{minutes} minutes');
  });
});
