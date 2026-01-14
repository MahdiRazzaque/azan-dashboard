export const validateTrigger = async (trigger) => {
    if (!trigger.enabled) return null;

    if (trigger.type === 'tts') {
        if (!trigger.template || trigger.template.trim() === '') {
            return "TTS template is required";
        }
    } else if (trigger.type === 'file') {
        if (!trigger.path || trigger.path === '') {
            return "A file must be selected";
        }
    } else if (trigger.type === 'url') {
        if (!trigger.url || trigger.url.trim() === '') {
            return "URL is required";
        }
        if (!trigger.url.toLowerCase().endsWith('.mp3')) {
            return "URL must point to an .mp3 file";
        }
        try {
            const res = await fetch('/api/system/validate-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: trigger.url })
            });
            const data = await res.json();
            if(!data.valid) {
                 return "URL unreachable: " + (data.error || 'Unknown error');
            }
        } catch (_) {
            return "Validation check failed (Network error)";
        }
    }
    return null;
};
