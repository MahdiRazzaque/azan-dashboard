/**
 * Validates a single automation trigger configuration.
 * It checks for required fields based on the trigger type (TTS, file, or URL).
 * 
 * @param {Object} trigger - The trigger configuration object to validate.
 * @returns {Promise<string|null>} A promise that resolves to an error message string if invalid, or null if valid.
 */
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

/**
 * Validates a prayer source configuration against its provider metadata.
 * 
 * @param {Object} source - The source configuration (primary or backup).
 * @param {Object} providerMetadata - The metadata for the selected provider.
 * @returns {string|null} Error message or null if valid.
 */
export const validateSourceSettings = (source, providerMetadata) => {
    if (!source || !providerMetadata) return null;
    if (source.enabled === false) return null; // Ignore disabled backup

    for (const param of providerMetadata.parameters) {
        const val = source[param.key];
        
        // Check Required
        if (param.constraints?.required) {
            if (val === undefined || val === null || val === '') {
                return `${param.label} is required`;
            }
        }

        // Check Pattern (Regex)
        if (param.constraints?.pattern && val) {
            const regex = new RegExp(param.constraints.pattern);
            if (!regex.test(String(val))) {
                return `Invalid format for ${param.label}`;
            }
        }
    }

    return null;
};
