/**
 * Prayer Source Settings Handler
 * Manages the Prayer Time Source tab in the settings modal
 */

// Global variables to store current prayer source settings
let currentPrayerSource = {
    source: null,
    mymasjid: {},
    aladhan: {}
};

// Store original settings for comparison
let originalPrayerSource = null;

// Help text for Aladhan parameters
const PARAMETER_HELP_TEXT = {
    latitude: "Geographic latitude of your location (-90 to 90)",
    longitude: "Geographic longitude of your location (-180 to 180)",
    timezone: "Your IANA timezone (e.g., Europe/London, America/New_York)",
    calculationMethod: "Method used to calculate prayer times based on different scholarly opinions",
    asrMethod: "Juristic method for calculating Asr prayer time (Shafi'i or Hanafi)",
    latitudeAdjustment: "Method to adjust times for locations in higher latitudes",
    midnightMode: "Method to calculate midnight between sunset and sunrise",
    iqamahOffsets: "Minutes to add to azan time to calculate iqamah time"
};

// Export prayer source settings interface
window.prayerSourceSettings = {
    initialize: initializePrayerSourceSettings,
    getSettings: getPrayerSourceSettings,
    validate: validatePrayerSourceSettings,
    haveChanged: havePrayerSourceSettingsChanged,
    save: savePrayerSourceSettings
};

/**
 * Initialize the Prayer Source Settings tab
 */
function initializePrayerSourceSettings() {
    console.log("Initialising prayer source settings...");
    
    // Get DOM elements
    const sourceMyMasjidRadio = document.getElementById('source-mymasjid');
    const sourceAladhanRadio = document.getElementById('source-aladhan');
    const myMasjidSettings = document.getElementById('mymasjid-settings');
    const aladhanSettings = document.getElementById('aladhan-settings');
    
    // Source type selection event listeners
    sourceMyMasjidRadio.addEventListener('change', () => {
        if (sourceMyMasjidRadio.checked) {
            // Add transition classes
            myMasjidSettings.classList.add('settings-fade-in');
            aladhanSettings.classList.add('settings-fade-out');
            
            // Show/hide with slight delay for animation
            setTimeout(() => {
                myMasjidSettings.style.display = 'block';
                aladhanSettings.style.display = 'none';
                
                // Remove transition classes
                myMasjidSettings.classList.remove('settings-fade-in');
                aladhanSettings.classList.remove('settings-fade-out');
            }, 300);
            
            // Update visual indicator
            document.querySelector('label[for="source-mymasjid"]').classList.add('selected-source');
            document.querySelector('label[for="source-aladhan"]').classList.remove('selected-source');
        }
    });
    
    sourceAladhanRadio.addEventListener('change', () => {
        if (sourceAladhanRadio.checked) {
            // Add transition classes
            myMasjidSettings.classList.add('settings-fade-out');
            aladhanSettings.classList.add('settings-fade-in');
            
            // Show/hide with slight delay for animation
            setTimeout(() => {
                myMasjidSettings.style.display = 'none';
                aladhanSettings.style.display = 'block';
                
                // Remove transition classes
                myMasjidSettings.classList.remove('settings-fade-out');
                aladhanSettings.classList.remove('settings-fade-in');
            }, 300);
            
            // Update visual indicator
            document.querySelector('label[for="source-mymasjid"]').classList.remove('selected-source');
            document.querySelector('label[for="source-aladhan"]').classList.add('selected-source');
        }
    });
    
    // Initialize dropdowns for Aladhan settings
    initializeAladhanDropdowns();
    
    // Add help text tooltips to form fields
    addHelpTextTooltips();
    
    // Add real-time validation to input fields
    addInputValidation();
    
    // Fetch current prayer source settings
    fetchPrayerSourceSettings();
    
    return true;
}

/**
 * Initialize dropdowns for Aladhan settings
 */
function initializeAladhanDropdowns() {
    // Get dropdown elements
    const calculationMethodSelect = document.getElementById('settings-calculation-method');
    const asrMethodSelect = document.getElementById('settings-asr-method');
    const latitudeAdjustmentSelect = document.getElementById('settings-latitude-adjustment');
    const midnightModeSelect = document.getElementById('settings-midnight-mode');
    
    // Populate dropdowns using the functions from dropdown-utils.js
    if (window.populateCalculationMethodDropdown && calculationMethodSelect) {
        window.populateCalculationMethodDropdown(calculationMethodSelect.id);
    }
    
    if (window.populateAsrJuristicMethodDropdown && asrMethodSelect) {
        window.populateAsrJuristicMethodDropdown(asrMethodSelect.id);
    }
    
    if (window.populateLatitudeAdjustmentMethodDropdown && latitudeAdjustmentSelect) {
        window.populateLatitudeAdjustmentMethodDropdown(latitudeAdjustmentSelect.id);
    }
    
    if (window.populateMidnightModeDropdown && midnightModeSelect) {
        window.populateMidnightModeDropdown(midnightModeSelect.id);
    }
}

/**
 * Add help text tooltips to form fields
 */
function addHelpTextTooltips() {
    // Add tooltips to Aladhan form fields
    document.getElementById('aladhan-latitude').title = PARAMETER_HELP_TEXT.latitude;
    document.getElementById('aladhan-longitude').title = PARAMETER_HELP_TEXT.longitude;
    document.getElementById('settings-aladhan-timezone').title = PARAMETER_HELP_TEXT.timezone;
    document.getElementById('settings-calculation-method').title = PARAMETER_HELP_TEXT.calculationMethod;
    document.getElementById('settings-asr-method').title = PARAMETER_HELP_TEXT.asrMethod;
    document.getElementById('settings-latitude-adjustment').title = PARAMETER_HELP_TEXT.latitudeAdjustment;
    document.getElementById('settings-midnight-mode').title = PARAMETER_HELP_TEXT.midnightMode;
    
    // Add help icons with tooltips
    addHelpIcon('aladhan-latitude', PARAMETER_HELP_TEXT.latitude);
    addHelpIcon('aladhan-longitude', PARAMETER_HELP_TEXT.longitude);
    addHelpIcon('settings-aladhan-timezone', PARAMETER_HELP_TEXT.timezone);
    addHelpIcon('settings-calculation-method', PARAMETER_HELP_TEXT.calculationMethod);
    addHelpIcon('settings-asr-method', PARAMETER_HELP_TEXT.asrMethod);
    addHelpIcon('settings-latitude-adjustment', PARAMETER_HELP_TEXT.latitudeAdjustment);
    addHelpIcon('settings-midnight-mode', PARAMETER_HELP_TEXT.midnightMode);
    
    // Add help text for iqamah offsets
    const iqamahHelp = document.createElement('div');
    iqamahHelp.className = 'help-text';
    iqamahHelp.textContent = PARAMETER_HELP_TEXT.iqamahOffsets;
    
    // Insert after the iqamah offsets heading
    const iqamahHeading = document.querySelector('#aladhan-settings h5');
    if (iqamahHeading) {
        iqamahHeading.parentNode.insertBefore(iqamahHelp, iqamahHeading.nextSibling);
    }
}

/**
 * Add help icon with tooltip to a form field
 * @param {string} elementId - ID of the form field
 * @param {string} helpText - Help text to display in tooltip
 */
function addHelpIcon(elementId, helpText) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    // Find the parent setting-row
    const settingRow = element.closest('.setting-row');
    if (!settingRow) return;
    
    // Create help icon
    const helpIcon = document.createElement('i');
    helpIcon.className = 'fas fa-question-circle help-icon';
    helpIcon.title = helpText;
    
    // Add to the label
    const label = settingRow.querySelector('label');
    if (label) {
        label.appendChild(document.createTextNode(' '));
        label.appendChild(helpIcon);
    }
}

/**
 * Add real-time validation to input fields
 */
function addInputValidation() {
    // Validate latitude
    const latitudeInput = document.getElementById('aladhan-latitude');
    latitudeInput.addEventListener('input', () => {
        const value = parseFloat(latitudeInput.value);
        if (isNaN(value) || value < -90 || value > 90) {
            latitudeInput.classList.add('invalid-input');
            showInlineError(latitudeInput, 'Latitude must be between -90 and 90');
        } else {
            latitudeInput.classList.remove('invalid-input');
            clearInlineError(latitudeInput);
        }
    });
    
    // Validate longitude
    const longitudeInput = document.getElementById('aladhan-longitude');
    longitudeInput.addEventListener('input', () => {
        const value = parseFloat(longitudeInput.value);
        if (isNaN(value) || value < -180 || value > 180) {
            longitudeInput.classList.add('invalid-input');
            showInlineError(longitudeInput, 'Longitude must be between -180 and 180');
        } else {
            longitudeInput.classList.remove('invalid-input');
            clearInlineError(longitudeInput);
        }
    });
    
    // Validate timezone
    const timezoneInput = document.getElementById('settings-aladhan-timezone');
    timezoneInput.addEventListener('input', () => {
        const value = timezoneInput.value.trim();
        if (!value) {
            timezoneInput.classList.add('invalid-input');
            showInlineError(timezoneInput, 'Timezone is required');
        } else {
            timezoneInput.classList.remove('invalid-input');
            clearInlineError(timezoneInput);
        }
    });
    
    // Validate iqamah offsets
    const iqamahInputs = [
        document.getElementById('settings-iqamah-fajr'),
        document.getElementById('settings-iqamah-zuhr'),
        document.getElementById('settings-iqamah-asr'),
        document.getElementById('settings-iqamah-maghrib'),
        document.getElementById('settings-iqamah-isha')
    ];
    
    iqamahInputs.forEach(input => {
        if (!input) return;
        
        input.addEventListener('input', () => {
            const value = parseInt(input.value);
            if (isNaN(value) || value < 0 || value > 120) {
                input.classList.add('invalid-input');
                showInlineError(input, 'Offset must be between 0 and 120 minutes');
            } else {
                input.classList.remove('invalid-input');
                clearInlineError(input);
            }
        });
    });
}

/**
 * Show inline error message for an input field
 * @param {HTMLElement} inputElement - Input element
 * @param {string} message - Error message
 */
function showInlineError(inputElement, message) {
    // Check if error message already exists
    let errorElement = inputElement.nextElementSibling;
    if (!errorElement || !errorElement.classList.contains('inline-error')) {
        // Create error message element
        errorElement = document.createElement('div');
        errorElement.className = 'inline-error';
        inputElement.parentNode.insertBefore(errorElement, inputElement.nextSibling);
    }
    
    errorElement.textContent = message;
    errorElement.style.display = 'block';
}

/**
 * Clear inline error message for an input field
 * @param {HTMLElement} inputElement - Input element
 */
function clearInlineError(inputElement) {
    const errorElement = inputElement.nextElementSibling;
    if (errorElement && errorElement.classList.contains('inline-error')) {
        errorElement.style.display = 'none';
    }
}

/**
 * Fetch prayer source settings from the server
 */
async function fetchPrayerSourceSettings() {
    try {
        // Show loading indicator
        const loadingIndicator = createLoadingIndicator('Loading prayer source settings...');
        document.querySelector('#prayer-source-tab').appendChild(loadingIndicator);
        
        // First try to fetch from the authenticated endpoint
        let response;
        let usePublicEndpoint = false;
        
        // Check if we have an auth token
        const authToken = localStorage.getItem('authToken');
        
        if (authToken) {
            // Try the authenticated endpoint first
            try {
                response = await fetch('/api/prayer-source-settings', {
                    headers: {
                        'x-auth-token': authToken
                    }
                });
                
                // If we get a 401, we'll try the public endpoint
                if (response.status === 401) {
                    console.log('Authentication required for prayer source settings, falling back to public endpoint');
                    usePublicEndpoint = true;
                }
            } catch (error) {
                console.warn('Error accessing authenticated prayer source settings:', error);
                usePublicEndpoint = true;
            }
        } else {
            // No auth token, use public endpoint
            usePublicEndpoint = true;
        }
        
        // Fall back to public endpoint if needed
        if (usePublicEndpoint) {
            response = await fetch('/api/prayer-source-info');
        }
        
        // Remove loading indicator
        loadingIndicator.remove();
        
        if (!response.ok) {
            throw new Error(`Failed to fetch prayer source settings: ${response.statusText}`);
        }
        
        const data = await response.json();
        currentPrayerSource = data;
        originalPrayerSource = JSON.parse(JSON.stringify(data)); // Deep copy for comparison
        
        // Populate form with fetched settings
        populatePrayerSourceForm(data);
    } catch (error) {
        console.error('Error fetching prayer source settings:', error);
        showErrorMessage('Failed to load prayer source settings. Please try again later.');
    }
}

/**
 * Populate the prayer source form with settings
 * @param {Object} settings - Prayer source settings
 */
function populatePrayerSourceForm(settings) {
    const sourceMyMasjidRadio = document.getElementById('source-mymasjid');
    const sourceAladhanRadio = document.getElementById('source-aladhan');
    const myMasjidSettings = document.getElementById('mymasjid-settings');
    const aladhanSettings = document.getElementById('aladhan-settings');
    
    // Set source type radio button
    if (settings.source === 'mymasjid') {
        sourceMyMasjidRadio.checked = true;
        myMasjidSettings.style.display = 'block';
        aladhanSettings.style.display = 'none';
        
        // Update visual indicator
        document.querySelector('label[for="source-mymasjid"]').classList.add('selected-source');
        document.querySelector('label[for="source-aladhan"]').classList.remove('selected-source');
        
        // Set MyMasjid guild ID - check for undefined to handle empty string values
        if (settings.guildId !== undefined) {
            document.getElementById('mymasjid-guild-id').value = settings.guildId;
        }
    } else if (settings.source === 'aladhan') {
        sourceAladhanRadio.checked = true;
        myMasjidSettings.style.display = 'none';
        aladhanSettings.style.display = 'block';
        
        // Update visual indicator
        document.querySelector('label[for="source-mymasjid"]').classList.remove('selected-source');
        document.querySelector('label[for="source-aladhan"]').classList.add('selected-source');
        
        // Set Aladhan parameters - ensure numeric values are handled properly
        if (settings.latitude !== undefined) document.getElementById('aladhan-latitude').value = settings.latitude;
        if (settings.longitude !== undefined) document.getElementById('aladhan-longitude').value = settings.longitude;
        if (settings.timezone) document.getElementById('settings-aladhan-timezone').value = settings.timezone;
        
        // Set dropdown values with a slight delay to ensure dropdowns are populated
        setTimeout(() => {
            // Handle numeric values explicitly
            if (settings.calculationMethodId !== undefined) {
                document.getElementById('settings-calculation-method').value = parseInt(settings.calculationMethodId);
            }
            
            if (settings.asrJuristicMethodId !== undefined) {
                document.getElementById('settings-asr-method').value = parseInt(settings.asrJuristicMethodId);
            }
            
            // Handle null or undefined latitudeAdjustmentMethodId
            if (settings.latitudeAdjustmentMethodId !== undefined) {
                const value = settings.latitudeAdjustmentMethodId === null ? 'null' : settings.latitudeAdjustmentMethodId;
                document.getElementById('settings-latitude-adjustment').value = value;
            }
            
            if (settings.midnightModeId !== undefined) {
                document.getElementById('settings-midnight-mode').value = parseInt(settings.midnightModeId);
            }
        }, 300);
        
        // Set iqamah offsets
        if (settings.iqamahOffsets) {
            if (settings.iqamahOffsets.fajr !== undefined) document.getElementById('settings-iqamah-fajr').value = settings.iqamahOffsets.fajr;
            if (settings.iqamahOffsets.zuhr !== undefined) document.getElementById('settings-iqamah-zuhr').value = settings.iqamahOffsets.zuhr;
            if (settings.iqamahOffsets.asr !== undefined) document.getElementById('settings-iqamah-asr').value = settings.iqamahOffsets.asr;
            if (settings.iqamahOffsets.maghrib !== undefined) document.getElementById('settings-iqamah-maghrib').value = settings.iqamahOffsets.maghrib;
            if (settings.iqamahOffsets.isha !== undefined) document.getElementById('settings-iqamah-isha').value = settings.iqamahOffsets.isha;
        }
    }
}

/**
 * Get prayer source settings from the form
 * @returns {Object} Prayer source settings
 */
function getPrayerSourceSettings() {
    const sourceMyMasjidRadio = document.getElementById('source-mymasjid');
    
    if (sourceMyMasjidRadio.checked) {
        return {
            source: 'mymasjid',
            guildId: document.getElementById('mymasjid-guild-id').value.trim()
        };
    } else {
        return {
            source: 'aladhan',
            latitude: parseFloat(document.getElementById('aladhan-latitude').value),
            longitude: parseFloat(document.getElementById('aladhan-longitude').value),
            timezone: document.getElementById('settings-aladhan-timezone').value.trim(),
            calculationMethodId: parseInt(document.getElementById('settings-calculation-method').value),
            asrJuristicMethodId: parseInt(document.getElementById('settings-asr-method').value),
            latitudeAdjustmentMethodId: document.getElementById('settings-latitude-adjustment').value === 'null' ? null : parseInt(document.getElementById('settings-latitude-adjustment').value),
            midnightModeId: parseInt(document.getElementById('settings-midnight-mode').value),
            iqamahOffsets: {
                fajr: parseInt(document.getElementById('settings-iqamah-fajr').value),
                zuhr: parseInt(document.getElementById('settings-iqamah-zuhr').value),
                asr: parseInt(document.getElementById('settings-iqamah-asr').value),
                maghrib: parseInt(document.getElementById('settings-iqamah-maghrib').value),
                isha: parseInt(document.getElementById('settings-iqamah-isha').value)
            }
        };
    }
}

/**
 * Validate prayer source settings
 * @returns {Object} Validation result with isValid flag and error message
 */
function validatePrayerSourceSettings() {
    const sourceMyMasjidRadio = document.getElementById('source-mymasjid');
    
    if (sourceMyMasjidRadio.checked) {
        // Validate MyMasjid settings
        const guildId = document.getElementById('mymasjid-guild-id').value.trim();
        if (!guildId) {
            return { isValid: false, error: 'Guild ID is required' };
        }
        return { isValid: true };
    } else {
        // Validate Aladhan settings
        const latitude = parseFloat(document.getElementById('aladhan-latitude').value);
        const longitude = parseFloat(document.getElementById('aladhan-longitude').value);
        const timezone = document.getElementById('settings-aladhan-timezone').value.trim();
        
        if (isNaN(latitude) || latitude < -90 || latitude > 90) {
            return { isValid: false, error: 'Latitude must be a number between -90 and 90' };
        }
        
        if (isNaN(longitude) || longitude < -180 || longitude > 180) {
            return { isValid: false, error: 'Longitude must be a number between -180 and 180' };
        }
        
        if (!timezone) {
            return { isValid: false, error: 'Timezone is required' };
        }
        
        // Validate iqamah offsets
        const iqamahFajr = parseInt(document.getElementById('settings-iqamah-fajr').value);
        const iqamahZuhr = parseInt(document.getElementById('settings-iqamah-zuhr').value);
        const iqamahAsr = parseInt(document.getElementById('settings-iqamah-asr').value);
        const iqamahMaghrib = parseInt(document.getElementById('settings-iqamah-maghrib').value);
        const iqamahIsha = parseInt(document.getElementById('settings-iqamah-isha').value);
        
        if (isNaN(iqamahFajr) || iqamahFajr < 0 || iqamahFajr > 120) {
            return { isValid: false, error: 'Fajr Iqamah offset must be between 0 and 120 minutes' };
        }
        
        if (isNaN(iqamahZuhr) || iqamahZuhr < 0 || iqamahZuhr > 120) {
            return { isValid: false, error: 'Zuhr Iqamah offset must be between 0 and 120 minutes' };
        }
        
        if (isNaN(iqamahAsr) || iqamahAsr < 0 || iqamahAsr > 120) {
            return { isValid: false, error: 'Asr Iqamah offset must be between 0 and 120 minutes' };
        }
        
        if (isNaN(iqamahMaghrib) || iqamahMaghrib < 0 || iqamahMaghrib > 120) {
            return { isValid: false, error: 'Maghrib Iqamah offset must be between 0 and 120 minutes' };
        }
        
        if (isNaN(iqamahIsha) || iqamahIsha < 0 || iqamahIsha > 120) {
            return { isValid: false, error: 'Isha Iqamah offset must be between 0 and 120 minutes' };
        }
        
        return { isValid: true };
    }
}

/**
 * Show error message in the settings modal
 * @param {string} message - Error message to display
 */
function showErrorMessage(message) {
    // Create error message element if it doesn't exist
    let errorElement = document.getElementById('prayer-source-error');
    if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.id = 'prayer-source-error';
        errorElement.className = 'error-message';
        
        // Insert after the source selector
        const sourceSettings = document.querySelector('.source-settings');
        sourceSettings.insertBefore(errorElement, document.getElementById('mymasjid-settings'));
    }
    
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    
    // Hide error message after 5 seconds
    setTimeout(() => {
        errorElement.style.display = 'none';
    }, 5000);
}

/**
 * Compare new settings with original settings to check if they've changed
 * @param {Object} newSettings - New prayer source settings
 * @returns {boolean} True if settings have changed
 */
function havePrayerSourceSettingsChanged(newSettings) {
    if (!originalPrayerSource) return true;
    
    // Check if source type has changed
    if (newSettings.source !== originalPrayerSource.source) {
        return true;
    }
    
    if (newSettings.source === 'mymasjid') {
        // Check if MyMasjid settings have changed
        if (newSettings.guildId !== originalPrayerSource.guildId) {
            return true;
        }
    } else if (newSettings.source === 'aladhan') {
        // Check if Aladhan settings have changed
        if (newSettings.latitude !== originalPrayerSource.latitude ||
            newSettings.longitude !== originalPrayerSource.longitude ||
            newSettings.timezone !== originalPrayerSource.timezone ||
            newSettings.calculationMethodId !== originalPrayerSource.calculationMethodId ||
            newSettings.asrJuristicMethodId !== originalPrayerSource.asrJuristicMethodId ||
            newSettings.midnightModeId !== originalPrayerSource.midnightModeId) {
            return true;
        }
        
        // Special handling for latitudeAdjustmentMethodId which can be null
        const newLatAdjustment = newSettings.latitudeAdjustmentMethodId;
        const origLatAdjustment = originalPrayerSource.latitudeAdjustmentMethodId;
        
        // If both are null, they're equal
        // If one is null and the other isn't, they're different
        // If neither is null, compare their values
        if ((newLatAdjustment === null && origLatAdjustment !== null) ||
            (newLatAdjustment !== null && origLatAdjustment === null) ||
            (newLatAdjustment !== null && origLatAdjustment !== null && newLatAdjustment !== origLatAdjustment)) {
            return true;
        }
        
        // Check if iqamah offsets have changed
        const newOffsets = newSettings.iqamahOffsets;
        const origOffsets = originalPrayerSource.iqamahOffsets;
        
        if (!origOffsets) return true;
        
        if (newOffsets.fajr !== origOffsets.fajr ||
            newOffsets.zuhr !== origOffsets.zuhr ||
            newOffsets.asr !== origOffsets.asr ||
            newOffsets.maghrib !== origOffsets.maghrib ||
            newOffsets.isha !== origOffsets.isha) {
            return true;
        }
    }
    
    return false;
}

/**
 * Save prayer source settings to the server
 * @param {Object} settings - Prayer source settings to save
 * @returns {Promise<Object>} Promise resolving to save result
 */
async function savePrayerSourceSettings(settings) {
    try {
        // Show loading indicator
        const loadingIndicator = createLoadingIndicator('Saving prayer source settings...');
        document.querySelector('#prayer-source-tab').appendChild(loadingIndicator);
        
        // Validate settings
        const validation = validatePrayerSourceSettings();
        if (!validation.isValid) {
            // Remove loading indicator
            loadingIndicator.remove();
            showErrorMessage(validation.error);
            return { success: false, error: validation.error };
        }
        
        // Get auth token
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            loadingIndicator.remove();
            showErrorMessage('Authentication required to save settings. Please log in first.');
            return { success: false, error: 'Authentication required' };
        }
        
        // Save settings with authentication
        const response = await fetch('/api/prayer-source', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': authToken
            },
            body: JSON.stringify(settings)
        });
        
        // Remove loading indicator
        loadingIndicator.remove();
        
        if (!response.ok) {
            // Handle different error status codes
            if (response.status === 401) {
                showErrorMessage('Authentication failed. Please log in again.');
                return { success: false, error: 'Authentication failed' };
            }
            
            // Try to parse error response as JSON
            let errorData;
            try {
                errorData = await response.json();
                const errorMessage = errorData.error || `Failed to save settings (${response.status})`;
                showErrorMessage(errorMessage);
                return { success: false, error: errorMessage };
            } catch (parseError) {
                // If can't parse JSON, use status text
                const errorMessage = `Server error: ${response.status} ${response.statusText}`;
                showErrorMessage(errorMessage);
                return { success: false, error: errorMessage };
            }
        }
        
        // Parse response data
        let responseData;
        try {
            responseData = await response.json();
        } catch (parseError) {
            showErrorMessage('Invalid response from server');
            return { success: false, error: 'Invalid response from server' };
        }
        
        // Show success message
        showSuccessMessage('Prayer source settings saved successfully!');
        
        // Update current and original settings
        currentPrayerSource = settings;
        originalPrayerSource = JSON.parse(JSON.stringify(settings)); // Deep copy for future comparison
        
        return { success: true };
    } catch (error) {
        console.error('Error saving prayer source settings:', error);
        showErrorMessage(`Error: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Create loading indicator element
 * @param {string} message - Message to display in loading indicator
 * @returns {HTMLElement} Loading indicator element
 */
function createLoadingIndicator(message) {
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'settings-loading';
    loadingIndicator.innerHTML = `
        <div class="settings-loading-spinner"></div>
        <div class="settings-loading-text">${message || 'Loading...'}</div>
    `;
    return loadingIndicator;
}

/**
 * Show success message in the settings modal
 * @param {string} message - Success message to display
 */
function showSuccessMessage(message) {
    // Create success message element if it doesn't exist
    let successElement = document.getElementById('prayer-source-success');
    if (!successElement) {
        successElement = document.createElement('div');
        successElement.id = 'prayer-source-success';
        successElement.className = 'success-message';
        
        // Insert after the source selector
        const sourceSettings = document.querySelector('.source-settings');
        sourceSettings.insertBefore(successElement, document.getElementById('mymasjid-settings'));
    }
    
    successElement.textContent = message;
    successElement.style.display = 'block';
    
    // Hide success message after 5 seconds
    setTimeout(() => {
        successElement.style.display = 'none';
    }, 5000);
} 