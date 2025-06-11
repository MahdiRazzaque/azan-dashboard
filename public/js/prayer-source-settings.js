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

// Flag to track if help text tooltips have been added
let helpTextTooltipsAdded = false;

// Parameter help text
const PARAMETER_HELP_TEXT = {
    latitude: 'Your geographical latitude coordinate (between -90 and 90)',
    longitude: 'Your geographical longitude coordinate (between -180 and 180)',
    timezone: 'Your timezone in IANA format (e.g., Europe/London, America/New_York)',
    calculationMethod: 'Method used to calculate prayer times based on different schools of thought',
    asrMethod: 'Method used to calculate Asr time (Standard or Hanafi)',
    latitudeAdjustment: 'Method used to adjust prayer times for high latitudes',
    midnightMode: 'Method used to calculate midnight (between Maghrib and Fajr)',
    iqamahOffsets: 'Minutes added to prayer start time, then rounded to nearest 15 minutes.'
};

// Export prayer source settings interface
window.prayerSourceSettings = {
    initialise: initialisePrayerSourceSettings,
    fetch: fetchPrayerSourceSettings,
    getSettings: getPrayerSourceSettings,
    validate: validatePrayerSourceSettings,
    haveChanged: havePrayerSourceSettingsChanged,
    save: savePrayerSourceSettings
};

/**
 * initialise the Prayer Source Settings tab
 */
function initialisePrayerSourceSettings() {
    console.log("Initialising prayer source settings...");
    
    // Get DOM elements
    const sourceMyMasjidRadio = document.getElementById('source-mymasjid');
    const sourceAladhanRadio = document.getElementById('source-aladhan');
    const myMasjidSettings = document.getElementById('mymasjid-settings');
    const aladhanSettings = document.getElementById('aladhan-settings');
    const sourceOptions = document.querySelectorAll('.source-option');
    
    // Add click event listeners to source options
    sourceOptions.forEach(option => {
        option.addEventListener('click', () => {
            const source = option.dataset.source;
            
            if (source === 'mymasjid') {
                sourceMyMasjidRadio.checked = true;
            } else if (source === 'aladhan') {
                sourceAladhanRadio.checked = true;
            }
            
            // Update UI
            updateSourceSelection(source);
        });
    });
    
    // Source type selection event listeners
    sourceMyMasjidRadio.addEventListener('change', () => {
        if (sourceMyMasjidRadio.checked) {
            updateSourceSelection('mymasjid');
        }
    });
    
    sourceAladhanRadio.addEventListener('change', () => {
        if (sourceAladhanRadio.checked) {
            updateSourceSelection('aladhan');
        }
    });
    
    // Helper function to update UI based on source selection
    function updateSourceSelection(source) {
        if (source === 'mymasjid') {
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
            
            // No longer need to update label classes since they're hidden
        } else if (source === 'aladhan') {
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
                
                // Try to detect user's timezone if field is empty
                detectUserTimezone();
            }, 300);
            
            // No longer need to update label classes since they're hidden
        }
    }
    
    // initialise dropdowns for Aladhan settings
    initialiseAladhanDropdowns();
    
    // Add help text tooltips to form fields
    addHelpTextTooltips();
    
    // Add real-time validation to input fields
    addInputValidation();
    
    // Try to detect user's timezone if Aladhan source is selected
    if (sourceAladhanRadio.checked) {
        detectUserTimezone();
    }
    
    // Fetch current prayer source settings
    fetchPrayerSourceSettings();
    
    return true;
}

/**
 * initialise dropdowns for Aladhan settings
 */
function initialiseAladhanDropdowns() {
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
        window.populateLatitudeAdjustmentMethodDropdown(latitudeAdjustmentSelect.id, null);
    }
    
    if (window.populateMidnightModeDropdown && midnightModeSelect) {
        window.populateMidnightModeDropdown(midnightModeSelect.id);
    }
}

/**
 * Add help text tooltips to form fields
 */
function addHelpTextTooltips() {
    if (helpTextTooltipsAdded) {
        console.log("Help text tooltips already added, skipping...");
        return;
    }
    
    // Add tooltips to Aladhan form fields in settings modal
    const latitudeEl = document.getElementById('aladhan-latitude');
    const longitudeEl = document.getElementById('aladhan-longitude');
    const timezoneEl = document.getElementById('settings-aladhan-timezone');
    const calculationMethodEl = document.getElementById('settings-calculation-method');
    const asrMethodEl = document.getElementById('settings-asr-method');
    const latitudeAdjustmentEl = document.getElementById('settings-latitude-adjustment');
    const midnightModeEl = document.getElementById('settings-midnight-mode');
    
    // Only set title if element exists
    if (latitudeEl) latitudeEl.title = PARAMETER_HELP_TEXT.latitude;
    if (longitudeEl) longitudeEl.title = PARAMETER_HELP_TEXT.longitude;
    if (timezoneEl) timezoneEl.title = PARAMETER_HELP_TEXT.timezone;
    if (calculationMethodEl) calculationMethodEl.title = PARAMETER_HELP_TEXT.calculationMethod;
    if (asrMethodEl) asrMethodEl.title = PARAMETER_HELP_TEXT.asrMethod;
    if (latitudeAdjustmentEl) latitudeAdjustmentEl.title = PARAMETER_HELP_TEXT.latitudeAdjustment;
    if (midnightModeEl) midnightModeEl.title = PARAMETER_HELP_TEXT.midnightMode;
    
    // Add help icons with tooltips to settings modal fields
    if (latitudeEl) addHelpIcon('aladhan-latitude', PARAMETER_HELP_TEXT.latitude);
    if (longitudeEl) addHelpIcon('aladhan-longitude', PARAMETER_HELP_TEXT.longitude);
    if (timezoneEl) addHelpIcon('settings-aladhan-timezone', PARAMETER_HELP_TEXT.timezone);
    if (calculationMethodEl) addHelpIcon('settings-calculation-method', PARAMETER_HELP_TEXT.calculationMethod);
    if (asrMethodEl) addHelpIcon('settings-asr-method', PARAMETER_HELP_TEXT.asrMethod);
    if (latitudeAdjustmentEl) addHelpIcon('settings-latitude-adjustment', PARAMETER_HELP_TEXT.latitudeAdjustment);
    if (midnightModeEl) addHelpIcon('settings-midnight-mode', PARAMETER_HELP_TEXT.midnightMode);

    // Add help icon to Iqamah Offsets heading
    const iqamahHeadings = document.querySelectorAll('.settings-card h5');
    iqamahHeadings.forEach(heading => {
        if (heading.textContent.includes('Iqamah Offsets')) {
            let helpIcon = heading.querySelector('.help-icon');
            if (!helpIcon) {
                helpIcon = document.createElement('i');
                helpIcon.className = 'fas fa-question-circle help-icon';
                helpIcon.style.marginLeft = '8px';
                heading.appendChild(helpIcon);
            }
            helpIcon.title = PARAMETER_HELP_TEXT.iqamahOffsets;
        }
    });

    // Add help icons to prayer settings panel
    addPrayerSettingsHelpIcons();
    
    // Mark that tooltips have been added
    helpTextTooltipsAdded = true;
}

/**
 * Add help icon with tooltip to a form field
 * @param {string} elementId - ID of the form field
 * @param {string} helpText - Help text to display in tooltip
 */
function addHelpIcon(elementId, helpText) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    // Find the parent container (either setting-row or form-group)
    const parentContainer = element.closest('.setting-row') || element.closest('.form-group');
    if (!parentContainer) return;
    
    // Check if label already has a help icon
    const label = parentContainer.querySelector('label');
    if (!label) return;
    
    // Check if help icon already exists
    const existingHelpIcon = label.querySelector('.help-icon');
    if (existingHelpIcon) {
        console.log('Help icon already exists');
        // Just update the title if it already exists
        existingHelpIcon.title = helpText;
        return;
    }
    
    // Create help icon
    const helpIcon = document.createElement('i');
    helpIcon.className = 'fas fa-question-circle help-icon';
    helpIcon.title = helpText;
    
    // Add to the label (without random number)
    label.appendChild(helpIcon);
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
            try {
                Intl.DateTimeFormat(undefined, { timeZone: value });
                timezoneInput.classList.remove('invalid-input');
                clearInlineError(timezoneInput);
            } catch (e) {
                timezoneInput.classList.add('invalid-input');
                showInlineError(timezoneInput, 'Invalid timezone');
            }
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
                
        // Create a properly structured settings object regardless of which endpoint was used
        let settings = {
            source: data.source || 'mymasjid'
        };
        
        // Handle MyMasjid data
        if (data.source === 'mymasjid') {
            settings.guildId = data.guildId || '';
        } 
        // Handle Aladhan data
        else if (data.source === 'aladhan') {
            settings.latitude = data.latitude !== undefined ? data.latitude : 0;
            settings.longitude = data.longitude !== undefined ? data.longitude : 0;
            settings.timezone = data.timezone || 'UTC';
            settings.calculationMethodId = data.calculationMethodId !== undefined ? data.calculationMethodId : 2; // Default to ISNA
            settings.asrJuristicMethodId = data.asrJuristicMethodId !== undefined ? data.asrJuristicMethodId : 0; // Default to Shafi'i
            settings.latitudeAdjustmentMethodId = data.latitudeAdjustmentMethodId !== undefined ? data.latitudeAdjustmentMethodId : 3; // Default to Angle Based
            settings.midnightModeId = data.midnightModeId !== undefined ? data.midnightModeId : 0; // Default to Standard
            
            // Ensure iqamahOffsets is properly structured
            settings.iqamahOffsets = {
                fajr: data.iqamahOffsets?.fajr !== undefined ? data.iqamahOffsets.fajr : 30,
                zuhr: data.iqamahOffsets?.zuhr !== undefined ? data.iqamahOffsets.zuhr : 30,
                asr: data.iqamahOffsets?.asr !== undefined ? data.iqamahOffsets.asr : 30,
                maghrib: data.iqamahOffsets?.maghrib !== undefined ? data.iqamahOffsets.maghrib : 5,
                isha: data.iqamahOffsets?.isha !== undefined ? data.iqamahOffsets.isha : 30
            };
        }
        
        currentPrayerSource = settings;
        originalPrayerSource = JSON.parse(JSON.stringify(settings)); // Deep copy for comparison
                
        // Populate form with fetched settings
        populatePrayerSourceForm(settings);
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
    const sourceOptions = document.querySelectorAll('.source-option');
    
    // Set source type radio button and update source options
    if (settings.source === 'mymasjid') {
        sourceMyMasjidRadio.checked = true;
        myMasjidSettings.style.display = 'block';
        aladhanSettings.style.display = 'none';
        
        // No longer need to update label classes since they're hidden
        
        // Set MyMasjid guild ID - check for undefined to handle empty string values
        if (settings.guildId !== undefined) {
            document.getElementById('mymasjid-guild-id').value = settings.guildId;
        }
    } else if (settings.source === 'aladhan') {
        sourceAladhanRadio.checked = true;
        myMasjidSettings.style.display = 'none';
        aladhanSettings.style.display = 'block';
        
        // No longer need to update label classes since they're hidden
        
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
    
    //console.log('Prayer source form populated with settings:', settings);
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
        
        // Validate timezone format
        try {
            Intl.DateTimeFormat(undefined, { timeZone: timezone });
        } catch (e) {
            return { isValid: false, error: 'Invalid timezone format' };
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

/**
 * Add help icons to prayer settings panel
 */
function addPrayerSettingsHelpIcons() {
    // Help text for prayer settings
    const helpTexts = {
        azan: 'Enable/disable the azan (call to prayer) for this prayer',
        azanTime: 'Choose whether to play azan at the start time or iqamah time',
        announcement: 'Enable/disable announcements for this prayer'
    };
    
    // Add help icons to prayer settings
    const prayerSettings = document.getElementById('prayer-settings');
    if (!prayerSettings) return;
    
    // Find all prayer setting rows
    const prayerSettingRows = prayerSettings.querySelectorAll('.setting-row');
    prayerSettingRows.forEach(row => {
        const label = row.querySelector('label');
        if (!label) return;
        
        // Determine which help text to use based on the label text
        let helpText = '';
        const labelText = label.textContent.trim().toLowerCase();
        
        if (labelText.includes('azan') && !labelText.includes('time')) {
            helpText = helpTexts.azan;
        } else if (labelText.includes('azan time')) {
            helpText = helpTexts.azanTime;
        } else if (labelText.includes('announcement')) {
            helpText = helpTexts.announcement;
        }
        
        if (helpText) {
            // Check if help icon already exists
            const existingHelpIcon = label.querySelector('.help-icon');
            if (existingHelpIcon) {
                existingHelpIcon.title = helpText;
                return;
            }
            
            // Create help icon
            const helpIcon = document.createElement('i');
            helpIcon.className = 'fas fa-question-circle help-icon';
            helpIcon.title = helpText;
            
            // Add to the label
            label.appendChild(document.createTextNode(' '));
            label.appendChild(helpIcon);
        }
    });
}

/**
 * Try to detect user's timezone and set it in the timezone input field
 */
function detectUserTimezone() {
    try {
        const timezoneInput = document.getElementById('settings-aladhan-timezone');
        if (timezoneInput && !timezoneInput.value) {
            const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            if (timezone) {
                timezoneInput.value = timezone;
                // Trigger validation
                timezoneInput.dispatchEvent(new Event('input'));
            }
        }
    } catch (error) {
        console.error('Error detecting timezone:', error);
    }
} 