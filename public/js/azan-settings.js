/**
 * Azan Settings Handler
 * Manages the Azan & Announcements tab in the settings modal
 */

// Global variables to store current azan settings
let currentAzanSettings = {
    globalAzanEnabled: false,
    globalAnnouncementEnabled: false,
    prayers: {}
};

// Store original settings for comparison
let originalAzanSettings = null;

// Prayer display names are now imported from app.js
// No need to redeclare PRAYER_DISPLAY_NAMES here

/**
 * initialise the Azan Settings tab
 */
function initialiseAzanSettings() {
    // Get DOM elements
    const globalAzanToggle = document.getElementById('global-azan-toggle');
    const globalAnnouncementToggle = document.getElementById('global-announcement-toggle');
    
    // Add event listeners for global toggles
    globalAzanToggle.addEventListener('change', (e) => {
        togglePrayerSpecificControls('azan', e.target.checked);
    });
    
    globalAnnouncementToggle.addEventListener('change', (e) => {
        togglePrayerSpecificControls('announcement', e.target.checked);
    });
    
    // Fetch current azan settings
    fetchAzanSettings();
}

/**
 * Fetch azan settings and features from the server
 */
async function fetchAzanSettings() {
    try {
        // Show loading indicator
        const loadingIndicator = createLoadingIndicator('Loading azan settings...');
        document.querySelector('#azan-settings-tab').appendChild(loadingIndicator);
        
        // First try to fetch with authentication if available
        const authToken = localStorage.getItem('authToken');
        const headers = authToken ? { 'x-auth-token': authToken } : {};
        
        // Fetch both prayer settings and features in parallel
        const [prayerResponse, featuresResponse] = await Promise.all([
            fetch('/api/prayer-settings', { headers }),
            fetch('/api/features', { headers })
        ]);
        
        // Remove loading indicator
        loadingIndicator.remove();
        
        // Check prayer settings response
        if (!prayerResponse || !prayerResponse.ok) {
            const errorMessage = prayerResponse ? 
                `Failed to fetch prayer settings: ${prayerResponse.statusText}` : 
                'Failed to fetch prayer settings';
            throw new Error(errorMessage);
        }
        
        // Check features response
        if (!featuresResponse || !featuresResponse.ok) {
            const errorMessage = featuresResponse ? 
                `Failed to fetch features: ${featuresResponse.statusText}` : 
                'Failed to fetch features';
            throw new Error(errorMessage);
        }
        
        // Parse responses
        const prayerSettings = await prayerResponse.json();
        const features = await featuresResponse.json();
        
        // Store settings
        currentAzanSettings = {
            ...prayerSettings,
            globalAzanEnabled: features.azanEnabled,
            globalAnnouncementEnabled: features.announcementEnabled
        };
        
        originalAzanSettings = JSON.parse(JSON.stringify(currentAzanSettings)); // Deep copy for comparison
        
        // Populate form with fetched settings
        populateAzanSettingsForm(prayerSettings, features);
        
        // Add event listeners to prayer toggle switches after populating the form
        addPrayerToggleListeners();
    } catch (error) {
        console.error('Error fetching azan settings:', error);
        showErrorMessage('Failed to load azan settings. Please try again later.');
    }
}

/**
 * Populate the azan settings form with settings
 * @param {Object} settings - Prayer settings
 * @param {Object} features - Feature settings
 */
function populateAzanSettingsForm(settings, features) {
    // Populate global toggles from features
    const globalAzanToggle = document.getElementById('global-azan-toggle');
    const globalAnnouncementToggle = document.getElementById('global-announcement-toggle');
    
    if (globalAzanToggle) {
        globalAzanToggle.checked = features.azanEnabled;
    }
    
    if (globalAnnouncementToggle) {
        globalAnnouncementToggle.checked = features.announcementEnabled;
    }
    
    // Populate prayer-specific settings
    const prayerSettingsContainer = document.getElementById('prayer-settings');
    if (prayerSettingsContainer) {
        prayerSettingsContainer.innerHTML = '';
        
        for (const prayer of ['fajr', 'zuhr', 'asr', 'maghrib', 'isha']) {
            const prayerSetting = document.createElement('div');
            prayerSetting.className = 'settings-card';
            
            const prayerName = PRAYER_DISPLAY_NAMES[prayer] || prayer.charAt(0).toUpperCase() + prayer.slice(1);
            
            // Select appropriate icon for each prayer
            let prayerIcon = 'fa-pray';
            if (prayer === 'fajr') prayerIcon = 'fa-sun';
            else if (prayer === 'zuhr') prayerIcon = 'fa-sun';
            else if (prayer === 'asr') prayerIcon = 'fa-cloud-sun';
            else if (prayer === 'maghrib') prayerIcon = 'fa-sunset';
            else if (prayer === 'isha') prayerIcon = 'fa-moon';
            
            prayerSetting.innerHTML = `
                <h5><i class="fas ${prayerIcon}"></i> ${prayerName} Prayer Settings</h5>
                <div class="setting-group">
                    <div class="setting-row">
                        <label for="${prayer}-azan-toggle"><i class="fas fa-volume-up"></i> Azan:</label>
                        <div class="toggle-switch">
                            <input type="checkbox" id="${prayer}-azan-toggle" class="toggle-input"
                                ${settings.prayers && settings.prayers[prayer] && settings.prayers[prayer].azanEnabled ? 'checked' : ''}>
                            <label for="${prayer}-azan-toggle" class="toggle-label"></label>
                        </div>
                    </div>
                    <div class="setting-row radio-row">
                        <label><i class="fas fa-clock"></i> Azan Time:</label>
                        <div class="radio-group">
                            <div class="radio-option">
                                <input type="radio" id="${prayer}-azan-start" name="${prayer}-azan-time" value="start"
                                    ${settings.prayers && settings.prayers[prayer] && !settings.prayers[prayer].azanAtIqamah ? 'checked' : ''}>
                                <label for="${prayer}-azan-start">Start Time</label>
                            </div>
                            <div class="radio-option">
                                <input type="radio" id="${prayer}-azan-iqamah" name="${prayer}-azan-time" value="iqamah"
                                    ${settings.prayers && settings.prayers[prayer] && settings.prayers[prayer].azanAtIqamah ? 'checked' : ''}>
                                <label for="${prayer}-azan-iqamah">Iqamah Time</label>
                            </div>
                        </div>
                    </div>
                    <div class="setting-row">
                        <label for="${prayer}-announcement-toggle"><i class="fas fa-bullhorn"></i> Announcement:</label>
                        <div class="toggle-switch">
                            <input type="checkbox" id="${prayer}-announcement-toggle" class="toggle-input"
                                ${settings.prayers && settings.prayers[prayer] && settings.prayers[prayer].announcementEnabled ? 'checked' : ''}>
                            <label for="${prayer}-announcement-toggle" class="toggle-label"></label>
                        </div>
                    </div>
                </div>`;
            
            prayerSettingsContainer.appendChild(prayerSetting);
        }
    }
    
    // initialise prayer-specific toggle states based on global toggles
    const globalAzanEnabled = settings.globalAzanEnabled !== undefined ? 
        settings.globalAzanEnabled : 
        (settings.globalAzan !== undefined ? settings.globalAzan : false);
        
    const globalAnnouncementEnabled = settings.globalAnnouncementEnabled !== undefined ? 
        settings.globalAnnouncementEnabled : 
        (settings.globalAnnouncement !== undefined ? settings.globalAnnouncement : false);
        
    togglePrayerSpecificControls('azan', globalAzanEnabled);
    togglePrayerSpecificControls('announcement', globalAnnouncementEnabled);
}

/**
 * Toggle prayer-specific controls based on global toggle
 * @param {string} type - Type of control ('azan' or 'announcement')
 * @param {boolean} enabled - Whether the global toggle is enabled
 */
function togglePrayerSpecificControls(type, enabled) {
    const prayers = ['fajr', 'zuhr', 'asr', 'maghrib', 'isha'];
    
    // If disabling global azan, also disable global announcement
    if (type === 'azan' && !enabled) {
        const globalAnnouncementToggle = document.getElementById('global-announcement-toggle');
        if (globalAnnouncementToggle) {
            // Store original state to restore later
            globalAnnouncementToggle.dataset.originalState = globalAnnouncementToggle.checked;
            // Visually disable global announcement toggle
            globalAnnouncementToggle.disabled = true;
            const announcementLabel = globalAnnouncementToggle.nextElementSibling;
            if (announcementLabel) {
                announcementLabel.classList.add('disabled');
                announcementLabel.title = "Announcements require Azan to be enabled globally";
            }
        }
    }
    
    // If re-enabling global azan, re-enable global announcement toggle
    if (type === 'azan' && enabled) {
        const globalAnnouncementToggle = document.getElementById('global-announcement-toggle');
        if (globalAnnouncementToggle && globalAnnouncementToggle.disabled) {
            globalAnnouncementToggle.disabled = false;
            // Restore original state if it was saved
            if (globalAnnouncementToggle.dataset.originalState !== undefined) {
                globalAnnouncementToggle.checked = globalAnnouncementToggle.dataset.originalState === "true";
                delete globalAnnouncementToggle.dataset.originalState;
            }
            const announcementLabel = globalAnnouncementToggle.nextElementSibling;
            if (announcementLabel) {
                announcementLabel.classList.remove('disabled');
                announcementLabel.title = "";
            }
        }
    }
    
    prayers.forEach(prayer => {
        // Handle the toggle for the current type (azan or announcement)
        const toggleElement = document.getElementById(`${prayer}-${type}-toggle`);
        if (!toggleElement) return;
        
        // Get tooltip message based on disabled reason
        let tooltipMessage = "";
        if (type === 'azan' && !enabled) {
            tooltipMessage = "Global Azan feature is disabled";
        } else if (type === 'announcement' && !enabled) {
            tooltipMessage = "Global Announcement feature is disabled";
        }
        
        // If disabling, visually disable the toggle but keep its state
        toggleElement.disabled = !enabled;
        
        // Add visual indicator and tooltip
        const toggleLabel = toggleElement.nextElementSibling;
        if (toggleLabel) {
            if (enabled) {
                toggleLabel.classList.remove('disabled');
                toggleLabel.title = "";
            } else {
                toggleLabel.classList.add('disabled');
                toggleLabel.title = tooltipMessage;
            }
        }
        
        // If this is azan, also handle the radio buttons and corresponding announcement toggle
        if (type === 'azan') {
            const startRadio = document.getElementById(`${prayer}-azan-start`);
            const iqamahRadio = document.getElementById(`${prayer}-azan-iqamah`);
            
            if (startRadio && iqamahRadio) {
                startRadio.disabled = !enabled;
                iqamahRadio.disabled = !enabled;
                
                // Add visual styles to radio labels
                const radioLabels = document.querySelectorAll(`label[for="${prayer}-azan-start"], label[for="${prayer}-azan-iqamah"]`);
                radioLabels.forEach(label => {
                    if (enabled) {
                        label.classList.remove('disabled');
                        label.title = "";
                    } else {
                        label.classList.add('disabled');
                        label.title = tooltipMessage;
                    }
                });
            }
            
            // Now handle the corresponding announcement toggle when azan toggle changes
            const announcementToggle = document.getElementById(`${prayer}-announcement-toggle`);
            if (announcementToggle) {
                // If the prayer-specific azan toggle is checked and enabled
                const azanToggleEnabled = toggleElement.checked && !toggleElement.disabled;
                
                // Store original state when disabling
                if (!azanToggleEnabled && !announcementToggle.disabled) {
                    announcementToggle.dataset.originalState = announcementToggle.checked;
                }
                
                // If azan is disabled for this prayer (either unchecked or globally disabled)
                const shouldDisableAnnouncement = !toggleElement.checked || toggleElement.disabled;
                announcementToggle.disabled = shouldDisableAnnouncement;
                
                // Get the appropriate message
                let announcementTooltipMessage = "";
                if (toggleElement.disabled) {
                    announcementTooltipMessage = "Global Azan feature is disabled";
                } else if (!toggleElement.checked) {
                    announcementTooltipMessage = `${PRAYER_DISPLAY_NAMES[prayer]} Azan is disabled`;
                }
                
                // Update visual state of announcement toggle
                const announcementLabel = announcementToggle.nextElementSibling;
                if (announcementLabel) {
                    if (shouldDisableAnnouncement) {
                        announcementLabel.classList.add('disabled');
                        announcementLabel.title = announcementTooltipMessage;
                    } else {
                        announcementLabel.classList.remove('disabled');
                        announcementLabel.title = "";
                        
                        // Restore original state if it was saved and we're re-enabling
                        if (announcementToggle.dataset.originalState !== undefined) {
                            announcementToggle.checked = announcementToggle.dataset.originalState === "true";
                            delete announcementToggle.dataset.originalState;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Add event listeners to prayer toggle switches
 */
function addPrayerToggleListeners() {
    const prayers = ['fajr', 'zuhr', 'asr', 'maghrib', 'isha'];
    
    prayers.forEach(prayer => {
        // Get the azan toggle for this prayer
        const azanToggle = document.getElementById(`${prayer}-azan-toggle`);
        
        if (azanToggle) {
            // Add change listener
            azanToggle.addEventListener('change', (e) => {
                const enabled = e.target.checked;
                const announcementToggle = document.getElementById(`${prayer}-announcement-toggle`);
                
                if (!announcementToggle) return;
                
                if (!enabled) {
                    // If disabling azan, also disable the announcement toggle
                    // Store original state to restore later
                    announcementToggle.dataset.originalState = announcementToggle.checked;
                    announcementToggle.disabled = true;
                    
                    // Update the label with tooltip
                    const announcementLabel = announcementToggle.nextElementSibling;
                    if (announcementLabel) {
                        announcementLabel.classList.add('disabled');
                        announcementLabel.title = `${PRAYER_DISPLAY_NAMES[prayer]} Azan is disabled`;
                    }
                } else {
                    // If enabling azan, re-enable the announcement toggle
                    announcementToggle.disabled = false;
                    
                    // Restore original state if it was saved
                    if (announcementToggle.dataset.originalState !== undefined) {
                        announcementToggle.checked = announcementToggle.dataset.originalState === "true";
                        delete announcementToggle.dataset.originalState;
                    }
                    
                    // Update the label
                    const announcementLabel = announcementToggle.nextElementSibling;
                    if (announcementLabel) {
                        announcementLabel.classList.remove('disabled');
                        announcementLabel.title = "";
                    }
                }
            });
        }
    });
}

/**
 * Get azan settings from the form
 * @returns {Object} Azan settings
 */
function getAzanSettings() {
    const azanSettings = {
        globalAzanEnabled: document.getElementById('global-azan-toggle').checked,
        globalAnnouncementEnabled: document.getElementById('global-announcement-toggle').checked,
        prayers: {}
    };
    
    // Get prayer-specific settings
    for (const prayer of ['fajr', 'zuhr', 'asr', 'maghrib', 'isha']) {
        const azanToggle = document.getElementById(`${prayer}-azan-toggle`);
        const azanStartRadio = document.getElementById(`${prayer}-azan-start`);
        const announcementToggle = document.getElementById(`${prayer}-announcement-toggle`);
        
        if (azanToggle && azanStartRadio && announcementToggle) {
            azanSettings.prayers[prayer] = {
                azanEnabled: azanToggle.checked,
                announcementEnabled: announcementToggle.checked,
                azanAtIqamah: !azanStartRadio.checked
            };
        }
    }
    
    return azanSettings;
}

/**
 * Check if azan settings have changed
 * @returns {boolean} True if settings have changed
 */
function haveAzanSettingsChanged() {
    const newSettings = getAzanSettings();
    
    // If no original settings, assume changed
    if (!originalAzanSettings) return true;
    
    // Compare global settings
    if (newSettings.globalAzanEnabled !== originalAzanSettings.globalAzanEnabled ||
        newSettings.globalAnnouncementEnabled !== originalAzanSettings.globalAnnouncementEnabled) {
        return true;
    }
    
    // Compare prayer-specific settings
    for (const prayer of ['fajr', 'zuhr', 'asr', 'maghrib', 'isha']) {
        const newPrayer = newSettings.prayers[prayer];
        const originalPrayer = originalAzanSettings.prayers[prayer];
        
        if (!newPrayer || !originalPrayer) return true;
        
        if (newPrayer.azanEnabled !== originalPrayer.azanEnabled ||
            newPrayer.announcementEnabled !== originalPrayer.announcementEnabled ||
            newPrayer.azanAtIqamah !== originalPrayer.azanAtIqamah) {
            return true;
        }
    }
    
    return false;
}

/**
 * Save azan settings to the server
 * @returns {Promise<Object>} Promise resolving to save result
 */
async function saveAzanSettings() {
    try {
        // Show loading indicator
        const loadingIndicator = createLoadingIndicator('Saving azan settings...');
        document.querySelector('#azan-settings-tab').appendChild(loadingIndicator);
        
        const settings = getAzanSettings();
        
        // Get auth token
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            loadingIndicator.remove();
            showErrorMessage('Authentication required to save settings. Please log in first.');
            return { success: false, error: 'Authentication required' };
        }
        
        console.log("Saving azan settings:", JSON.stringify(settings));
        
        // Save features and prayer settings separately
        // 1. Save features first
        const featuresResponse = await fetch('/api/features', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': authToken
            },
            body: JSON.stringify({
                azanEnabled: settings.globalAzanEnabled,
                announcementEnabled: settings.globalAnnouncementEnabled
            })
        });
        
        if (!featuresResponse.ok) {
            loadingIndicator.remove();
            const errorMessage = `Failed to save features: ${featuresResponse.statusText}`;
            showErrorMessage(errorMessage);
            return { success: false, error: errorMessage };
        }
        
        // 2. Save prayer-specific settings
        const response = await fetch('/api/prayer-settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': authToken
            },
            body: JSON.stringify({
                prayers: settings.prayers
            })
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
        showSuccessMessage('Azan settings saved successfully!');
        
        // Update current settings
        currentAzanSettings = settings;
        originalAzanSettings = JSON.parse(JSON.stringify(settings));
        
        return { success: true };
    } catch (error) {
        console.error('Error saving azan settings:', error);
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
 * Show success message in the azan settings tab
 * @param {string} message - Success message to display
 */
function showSuccessMessage(message) {
    // Create success message element if it doesn't exist
    let successElement = document.getElementById('azan-settings-success');
    if (!successElement) {
        successElement = document.createElement('div');
        successElement.id = 'azan-settings-success';
        successElement.className = 'success-message';
        
        // Insert after the first settings-card in the azan settings tab
        const firstSettingsCard = document.querySelector('#azan-settings-tab .settings-card');
        if (firstSettingsCard) {
            firstSettingsCard.parentNode.insertBefore(successElement, firstSettingsCard.nextSibling);
        } else {
            // Fallback if structure changes
            document.querySelector('#azan-settings-tab').appendChild(successElement);
        }
    }
    
    successElement.textContent = message;
    successElement.style.display = 'block';
    
    // Hide success message after 5 seconds
    setTimeout(() => {
        successElement.style.display = 'none';
    }, 5000);
}

/**
 * Show error message in the azan settings tab
 * @param {string} message - Error message to display
 */
function showErrorMessage(message) {
    // Create error message element if it doesn't exist
    let errorElement = document.getElementById('azan-settings-error');
    if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.id = 'azan-settings-error';
        errorElement.className = 'error-message';
        
        // Insert after the first settings-card in the azan settings tab
        const firstSettingsCard = document.querySelector('#azan-settings-tab .settings-card');
        if (firstSettingsCard) {
            firstSettingsCard.parentNode.insertBefore(errorElement, firstSettingsCard.nextSibling);
        } else {
            // Fallback if structure changes
            document.querySelector('#azan-settings-tab').appendChild(errorElement);
        }
    }
    
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    
    // Hide error message after 5 seconds
    setTimeout(() => {
        errorElement.style.display = 'none';
    }, 5000);
}

// Export functions for use in app.js
window.azanSettings = {
    initialise: initialiseAzanSettings,
    refresh: fetchAzanSettings,  // Add refresh method
    getSettings: getAzanSettings,
    haveChanged: haveAzanSettingsChanged,
    save: saveAzanSettings
}; 