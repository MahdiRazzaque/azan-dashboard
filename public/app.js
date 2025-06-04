// Update interval in milliseconds
const UPDATE_INTERVAL = 1000;
const LOGS_UPDATE_INTERVAL = 5000;

// Prayer icons mapping
const PRAYER_ICONS = {
    fajr: { type: 'fas', name: 'fa-sun' },
    sunrise: { type: 'mdi', name: 'mdi-weather-sunset-up' },
    zuhr: { type: 'fas', name: 'fa-sun' },
    asr: { type: 'fas', name: 'fa-cloud-sun' },
    maghrib: { type: 'mdi', name: 'mdi-weather-sunset' },
    isha: { type: 'fas', name: 'fa-moon' }
};

// Prayer display names
const PRAYER_DISPLAY_NAMES = {
    fajr: 'Fajr',
    zuhr: 'Zuhr',
    asr: 'Asr',
    maghrib: 'Maghrib',
    isha: 'Isha'
};

// DOM Elements
const prayerTable = document.getElementById('prayer-table').getElementsByTagName('tbody')[0];
const currentTimeDisplay = document.getElementById('current-time-display');
const nextPrayerName = document.getElementById('next-prayer-name');
const countdownDisplay = document.getElementById('countdown-display');
const logContainer = document.getElementById('log-container');
const logsContainer = document.querySelector('.logs-container');
const container = document.querySelector('.container');
const logControls = document.querySelector('.log-controls');

// Settings-related DOM Elements
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const settingsConfirmModal = document.getElementById('settings-confirm-modal');
const prayerSettingsContainer = document.getElementById('prayer-settings');
const globalAzanToggle = document.getElementById('global-azan-toggle');
const globalAnnouncementToggle = document.getElementById('global-announcement-toggle');
const settingsSaveBtn = document.getElementById('settings-save');
const settingsCancelBtn = document.getElementById('settings-cancel');
const settingsConfirmApplyBtn = document.getElementById('settings-confirm-apply');
const settingsConfirmCancelBtn = document.getElementById('settings-confirm-cancel');

// Store next prayer time globally
let nextPrayerTime = null;

// Add global variable to track auto-scroll state
let shouldAutoScroll = true;

// Store prayer data and settings
let currentPrayerData = null;
let currentPrayerSettings = null;
let originalPrayerSettings = null; // For settings comparison when determining if changes were made

// Add LogStore implementation
const logStore = {
    logs: [],
    addLog(type, message) {
        const logEntry = {
            type,
            message,
            timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
        };
        this.logs.push(logEntry);
        return logEntry;
    }
};

// Add broadcast function
function broadcastLogs(logEntry) {
    updateLogs(logEntry);
}

// Format time remaining
function formatTimeRemaining(ms) {
    if (ms < 0) return '--:--:--';
    const duration = moment.duration(ms);
    const hours = Math.floor(duration.asHours());
    const minutes = duration.minutes();
    const seconds = duration.seconds();

    // Format parts
    const parts = [];
    if (hours === 1) {
        parts.push('1h');
    } else if (hours > 1) {
        parts.push(`${hours}h`);
    }

    if (minutes > 0 || hours > 0) {
        parts.push(`${seconds > 0 ? minutes+1 : minutes}min`);
    }

    if (seconds > 0 && minutes <= 0) {
        parts.push(`${seconds}sec`);
    }

    return parts.join(' ');
}

// Add getCurrentTime utility function
let testMode = false;
let testStartTime;
let timeOffset;

async function initialiseTestMode() {
    try {
        const response = await fetch('/api/test-mode');
        const config = await response.json();
        testMode = config.enabled;
        testStartTime = moment(config.startTime, 'HH:mm:ss');
        timeOffset = testMode ? moment().diff(testStartTime) : 0;

        if (testMode) {
            console.log(`🧪 Test Mode Enabled - Time set to ${testStartTime.format('HH:mm:ss')}`);
        }
    } catch (error) {
        console.error('Error fetching test mode configuration:', error);
    }
}

function getCurrentTime() {
    if (!testMode) return moment();
    return moment().subtract(timeOffset, 'milliseconds');
}

// Update prayer times table
function updatePrayerTable(iqamahTimes, startTimes, nextPrayer) {
    prayerTable.innerHTML = '';
    
    // Check if prayer times are available
    if (!iqamahTimes || !startTimes) {
        prayerTable.innerHTML = '<tr><td colspan="3" class="text-center">Prayer times not available. Please configure prayer source in settings.</td></tr>';
        return;
    }
    
    const prayers = Object.entries(iqamahTimes);
    const now = getCurrentTime();

    prayers.forEach(([prayer, time]) => {
        const row = document.createElement('tr');
        const isNext = nextPrayer && prayer === nextPrayer.name;
        const isPassed = moment(time, 'HH:mm').isBefore(now);
        const icon = PRAYER_ICONS[prayer];

        row.className = `prayer-row ${isNext ? 'next' : ''} ${isPassed ? 'passed' : ''}`;

        row.innerHTML = `
            <td class="prayer-name">
                ${icon.type === 'mdi'
                    ? `<i class="mdi ${icon.name} prayer-icon"></i>`
                    : `<i class="${icon.type} ${icon.name} prayer-icon"></i>`
                }
                ${prayer.charAt(0).toUpperCase() + prayer.slice(1)}
            </td>
            <td>${startTimes[prayer]}</td> <!-- New column for start times -->
            <td>${time}</td>
        `;

        prayerTable.appendChild(row);
    });
}

/**
 * Update prayer source information display
 * @param {Object} sourceInfo - Information about the prayer time source
 */
function updatePrayerSourceInfo(sourceInfo) {
    // Function disabled as prayer-source-info component has been removed
    return;
}

// Update countdown display
function updateCountdown() {
    if (!nextPrayerTime) {
        countdownDisplay.textContent = '--:--:--';
        return;
    }

    const now = getCurrentTime();
    const diff = nextPrayerTime.diff(now);

    if (diff <= 0) {
        // Time to fetch new prayer times
        updatePrayerData();
        return;
    }

    countdownDisplay.textContent = formatTimeRemaining(diff);
}

// Update current time and next prayer info
function updateTimeAndNextPrayer(data) {
    const now = getCurrentTime();
    currentTimeDisplay.textContent = now.format('HH:mm:ss');
    
    // Check if data is valid
    if (!data || !data.nextPrayer) {
        nextPrayerName.textContent = 'No prayer data available';
        nextPrayerTime = null;
        countdownDisplay.textContent = '--:--:--';
        return;
    }

    const prayerName = data.nextPrayer.name;
    const icon = PRAYER_ICONS[prayerName];
    nextPrayerName.innerHTML = `
        ${icon.type === 'mdi'
            ? `<i class="mdi ${icon.name}"></i>`
            : `<i class="${icon.type} ${icon.name}"></i>`
        }
        ${prayerName.charAt(0).toUpperCase() + prayerName.slice(1)}
    `;

    // Update the global nextPrayerTime
    nextPrayerTime = moment(data.nextPrayer.time, 'HH:mm');
    // Ensure it's today or tomorrow
    if (nextPrayerTime.isBefore(now)) {
        nextPrayerTime.add(1, 'day');
    }

    updateCountdown();
}

// Update logs with new content
function updateLogs(logData) {
    if (!logData || !logData.message) return;

    const logLine = document.createElement('div');
    logLine.className = `log-line ${logData.type}`;
    
    const message = document.createElement('span');
    message.className = 'message';
    message.textContent = cleanMessage(logData.message);
    logLine.appendChild(message);

    if (logData.timestamp) {
        const timestamp = document.createElement('span');
        timestamp.className = 'timestamp';
        timestamp.textContent = moment(logData.timestamp).format('HH:mm:ss DD.MM.YYYY');
        logLine.appendChild(timestamp);
    }

    logContainer.appendChild(logLine);

    // Keep last 1000 logs
    while (logContainer.childNodes.length > 1000) {
        logContainer.removeChild(logContainer.firstChild);
    }

    if (shouldAutoScroll) {
        requestAnimationFrame(() => {
            logContainer.scrollTop = logContainer.scrollHeight;
        });
    }
}

// Helper function to clean log messages
function cleanMessage(message) {
    if (message.includes('Prayer') && message.includes('Time')) {
        try {
            if (message.includes('[{')) {
                const tableData = JSON.parse(message);
                return tableData.map(row => `${row.Prayer}: ${row.Time}`).join('\n');
            }
            return message.replace(/\u001b\[\d+m/g, '').replace(/□/g, '').trim();
        } catch (e) {
            return message.replace(/\u001b\[\d+m/g, '').replace(/□/g, '').trim();
        }
    }
    return message;
}

// Initialise log controls
function initialiseLogControls() {
    const clearLogsBtn = document.getElementById('clear-logs');
    const scrollBottomBtn = document.getElementById('scroll-bottom');
    const lastErrorBtn = document.getElementById('last-error');
    const modal = document.getElementById('confirm-modal');
    const modalConfirm = document.getElementById('modal-confirm');
    const modalCancel = document.getElementById('modal-cancel');

    clearLogsBtn.addEventListener('click', () => {
        if (!isAuthenticated) {
            showLoginModal(() => {
                modal.classList.add('show');
            });
            return;
        }
        modal.classList.add('show');
    });

    modalCancel.addEventListener('click', () => {
        modal.classList.remove('show');
    });

    modalConfirm.addEventListener('click', async () => {
        try {
            await fetch('/api/logs/clear', { 
                method: 'POST',
                headers: {
                    'x-auth-token': authToken
                }
            });
            logContainer.innerHTML = '';
            updateLogs({
                type: 'system',
                message: 'All logs have been cleared',
                timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
            });
            modal.classList.remove('show');
        } catch (error) {
            console.error('Error clearing logs:', error);
        }
    });

    // Close modal if clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('show');
        }
    });

    // Scroll to bottom handler
    scrollBottomBtn.addEventListener('click', () => {
        shouldAutoScroll = true;
        logContainer.scrollTo({
            top: logContainer.scrollHeight,
            behavior: 'smooth'
        });
    });

    lastErrorBtn.addEventListener('click', async () => {
        try {
            const response = await fetch('/api/logs/last-error');
            const error = await response.json();
            if (error.type === 'error') {
                // Find the error in existing logs
                const errorLines = Array.from(logContainer.children);
                const errorLine = errorLines.find(line =>
                    line.textContent.includes(error.message)
                );

                if (errorLine) {
                    // Scroll to the error
                    errorLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // Highlight the error briefly
                    errorLine.classList.add('highlight');
                    setTimeout(() => errorLine.classList.remove('highlight'), 2000);
                } else {
                    // If error not found in current logs, append it
                    updateLogs(error);
                    // Scroll to the new error
                    logContainer.lastChild.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            } else {
                // Show the no error modal
                document.getElementById('no-error-modal').classList.add('show');
            }
        } catch (error) {
            console.error('Error fetching last error:', error);
        }
    });
}

// Initialise SSE connection for logs
function initialiseLogStream() {
    const eventSource = new EventSource('/api/logs/stream');

    eventSource.onmessage = (event) => {
        try {
            const logData = JSON.parse(event.data);
            if (logData.type === 'connected') {
                console.log('Connected to log stream');
                // Scroll to bottom after initial connection
                requestAnimationFrame(() => {
                    logContainer.scrollTop = logContainer.scrollHeight;
                });
            } else {
                updateLogs(logData);
            }
        } catch (error) {
            console.error('Error parsing log data:', error);
        }
    };

    eventSource.onerror = (error) => {
        console.error('SSE Error:', error);
        eventSource.close();
        // Try to reconnect after 5 seconds
        setTimeout(initialiseLogStream, 5000);
    };

    return eventSource;
}

// Initialise log container scroll handling
function initialiseLogScroll() {
    logContainer.addEventListener('scroll', () => {
        const isAtBottom = Math.abs(
            logContainer.scrollHeight - logContainer.clientHeight - logContainer.scrollTop
        ) < 2;
        shouldAutoScroll = isAtBottom;
    });

    logContainer.addEventListener('touchmove', () => {
        const isAtBottom = Math.abs(
            logContainer.scrollHeight - logContainer.clientHeight - logContainer.scrollTop
        ) < 2;
        shouldAutoScroll = isAtBottom;
    });
}

// Fetch prayer times and update UI
async function updatePrayerData() {
    try {
        // Fetch prayer times
        const response = await fetch('/api/prayer-times');
        const data = await response.json();
        
        // Store the current prayer data
        currentPrayerData = data;

        // Update prayer times table and next prayer info
        updatePrayerTable(data.iqamahTimes, data.startTimes, data.nextPrayer);
        updateTimeAndNextPrayer(data);
        
        // Update prayer source information if available
        if (data.source) {
            updatePrayerSourceInfo(data.source);
        }
    } catch (error) {
        console.error('Error fetching prayer times:', error);
    }
}

// Fetch prayer settings
async function fetchPrayerSettings() {
    try {
        const response = await fetch('/api/prayer-settings');
        const settings = await response.json();
        
        // Store the current prayer settings
        currentPrayerSettings = settings;
        originalPrayerSettings = JSON.parse(JSON.stringify(settings)); // Deep copy for comparison
        
        return settings;
    } catch (error) {
        console.error('Error fetching prayer settings:', error);
        return null;
    }
}

// Populate settings form with current settings
function populateSettingsForm(settings, features) {
    // Populate global toggles
    const globalAzanToggle = document.getElementById('global-azan-toggle');
    const globalAnnouncementToggle = document.getElementById('global-announcement-toggle');
    
    if (globalAzanToggle && settings.globalAzan !== undefined) {
        globalAzanToggle.checked = settings.globalAzan;
    }
    
    if (globalAnnouncementToggle && settings.globalAnnouncement !== undefined) {
        globalAnnouncementToggle.checked = settings.globalAnnouncement;
    }
    
    // Populate prayer-specific settings
    const prayerSettingsContainer = document.getElementById('prayer-settings');
    if (prayerSettingsContainer) {
        prayerSettingsContainer.innerHTML = '';
        
        for (const prayer of ['fajr', 'zuhr', 'asr', 'maghrib', 'isha']) {
            const prayerSetting = document.createElement('div');
            prayerSetting.className = 'prayer-setting';
            
            const prayerName = PRAYER_DISPLAY_NAMES[prayer] || prayer.charAt(0).toUpperCase() + prayer.slice(1);
            
            prayerSetting.innerHTML = `
                <h5>${prayerName}</h5>
                <div class="setting-group">
                    <div class="setting-row">
                        <label>Azan</label>
                        <div class="toggle-switch">
                            <input type="checkbox" id="${prayer}-azan-toggle" class="toggle-input"
                                ${settings.prayerSettings && settings.prayerSettings[prayer] && settings.prayerSettings[prayer].azan ? 'checked' : ''}>
                            <label for="${prayer}-azan-toggle" class="toggle-label"></label>
                        </div>
                    </div>
                    <div class="setting-row">
                        <label>Azan Time</label>
                        <div class="radio-group">
                            <div class="radio-option">
                                <input type="radio" id="${prayer}-azan-start" name="${prayer}-azan-time" value="start"
                                    ${settings.prayerSettings && settings.prayerSettings[prayer] && settings.prayerSettings[prayer].azanTime === 'start' ? 'checked' : ''}>
                                <label for="${prayer}-azan-start">Start Time</label>
                            </div>
                            <div class="radio-option">
                                <input type="radio" id="${prayer}-azan-iqamah" name="${prayer}-azan-time" value="iqamah"
                                    ${settings.prayerSettings && settings.prayerSettings[prayer] && settings.prayerSettings[prayer].azanTime === 'iqamah' ? 'checked' : ''}>
                                <label for="${prayer}-azan-iqamah">Iqamah Time</label>
                            </div>
                        </div>
                    </div>
                    <div class="setting-row">
                        <label>Announcement</label>
                        <div class="toggle-switch">
                            <input type="checkbox" id="${prayer}-announcement-toggle" class="toggle-input"
                                ${settings.prayerSettings && settings.prayerSettings[prayer] && settings.prayerSettings[prayer].announcement ? 'checked' : ''}>
                            <label for="${prayer}-announcement-toggle" class="toggle-label"></label>
                        </div>
                    </div>
                </div>
            `;
            
            prayerSettingsContainer.appendChild(prayerSetting);
        }
    }
    
    // Initialize prayer-specific toggle states based on global toggles
    togglePrayerSpecificControls('azan', settings.globalAzan);
    togglePrayerSpecificControls('announcement', settings.globalAnnouncement);
    
    // Add event listeners to prayer-specific toggles
    addPrayerToggleListeners();
}

// Gather settings from form
function getSettingsFromForm() {
    const settings = {
        globalAzan: document.getElementById('global-azan-toggle').checked,
        globalAnnouncement: document.getElementById('global-announcement-toggle').checked,
        prayerSettings: {},
        prayerSource: {}
    };
    
    // Get prayer-specific settings
    for (const prayer of ['fajr', 'zuhr', 'asr', 'maghrib', 'isha']) {
        const azanToggle = document.getElementById(`${prayer}-azan-toggle`);
        const azanStartRadio = document.getElementById(`${prayer}-azan-start`);
        const announcementToggle = document.getElementById(`${prayer}-announcement-toggle`);
        
        if (azanToggle && azanStartRadio && announcementToggle) {
            settings.prayerSettings[prayer] = {
                azan: azanToggle.checked,
                azanTime: azanStartRadio.checked ? 'start' : 'iqamah',
                announcement: announcementToggle.checked
            };
        }
    }
    
    // Get prayer source settings
    const sourceMyMasjidRadio = document.getElementById('source-mymasjid');
    
    if (sourceMyMasjidRadio.checked) {
        settings.prayerSource = {
            source: 'mymasjid',
            guildId: document.getElementById('mymasjid-guild-id').value
        };
    } else {
        settings.prayerSource = {
            source: 'aladhan',
            latitude: parseFloat(document.getElementById('aladhan-latitude').value),
            longitude: parseFloat(document.getElementById('aladhan-longitude').value),
            timezone: document.getElementById('settings-aladhan-timezone').value,
            calculationMethodId: parseInt(document.getElementById('settings-calculation-method').value),
            asrJuristicMethodId: parseInt(document.getElementById('settings-asr-method').value),
            latitudeAdjustmentMethodId: parseInt(document.getElementById('settings-latitude-adjustment').value),
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
    
    return settings;
}

// Check if settings have changed
function haveSettingsChanged(newSettings) {
    // Compare with current settings
    if (!currentSettings) return true;
    
    // Compare global settings
    if (newSettings.globalAzan !== currentSettings.globalAzan ||
        newSettings.globalAnnouncement !== currentSettings.globalAnnouncement) {
        return true;
    }
    
    // Compare prayer-specific settings
    for (const prayer of ['fajr', 'zuhr', 'asr', 'maghrib', 'isha']) {
        const newPrayer = newSettings.prayerSettings[prayer];
        const currentPrayer = currentSettings.prayerSettings[prayer];
        
        if (!newPrayer || !currentPrayer) return true;
        
        if (newPrayer.azan !== currentPrayer.azan ||
            newPrayer.azanTime !== currentPrayer.azanTime ||
            newPrayer.announcement !== currentPrayer.announcement) {
            return true;
        }
    }
    
    // Compare prayer source settings
    if (newSettings.prayerSource.source !== currentPrayerSource.source) {
        return true;
    }
    
    if (newSettings.prayerSource.source === 'mymasjid') {
        if (newSettings.prayerSource.guildId !== currentPrayerSource.guildId) {
            return true;
        }
    } else if (newSettings.prayerSource.source === 'aladhan') {
        if (newSettings.prayerSource.latitude !== currentPrayerSource.latitude ||
            newSettings.prayerSource.longitude !== currentPrayerSource.longitude ||
            newSettings.prayerSource.timezone !== currentPrayerSource.timezone ||
            newSettings.prayerSource.calculationMethodId !== currentPrayerSource.calculationMethodId ||
            newSettings.prayerSource.asrJuristicMethodId !== currentPrayerSource.asrJuristicMethodId ||
            newSettings.prayerSource.latitudeAdjustmentMethodId !== currentPrayerSource.latitudeAdjustmentMethodId ||
            newSettings.prayerSource.midnightModeId !== currentPrayerSource.midnightModeId) {
            return true;
        }
        
        // Compare iqamah offsets
        const newOffsets = newSettings.prayerSource.iqamahOffsets;
        const currentOffsets = currentPrayerSource.iqamahOffsets;
        
        if (!newOffsets || !currentOffsets) return true;
        
        if (newOffsets.fajr !== currentOffsets.fajr ||
            newOffsets.zuhr !== currentOffsets.zuhr ||
            newOffsets.asr !== currentOffsets.asr ||
            newOffsets.maghrib !== currentOffsets.maghrib ||
            newOffsets.isha !== currentOffsets.isha) {
            return true;
        }
    }
    
    return false;
}

// Save settings to server
async function saveSettings(settings) {
    try {
        // Save azan and announcement settings
        const azanResponse = await fetch('/api/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                globalAzan: settings.globalAzan,
                globalAnnouncement: settings.globalAnnouncement,
                prayerSettings: settings.prayerSettings
            })
        });
        
        if (!azanResponse.ok) {
            throw new Error(`Failed to save azan settings: ${azanResponse.statusText}`);
        }
        
        // Save prayer source settings
        const sourceResponse = await fetch('/api/prayer-source', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(settings.prayerSource)
        });
        
        if (!sourceResponse.ok) {
            throw new Error(`Failed to save prayer source settings: ${sourceResponse.statusText}`);
        }
        
        // Update current settings cache
        currentSettings = {
            globalAzan: settings.globalAzan,
            globalAnnouncement: settings.globalAnnouncement,
            prayerSettings: settings.prayerSettings
        };
        
        currentPrayerSource = settings.prayerSource;
        
        return true;
    } catch (error) {
        console.error('Error saving settings:', error);
        return false;
    }
}

// Initialise settings panel
async function initialiseSettingsPanel() {
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const settingsSaveBtn = document.getElementById('settings-save');
    const settingsCancelBtn = document.getElementById('settings-cancel');
    const settingsConfirmModal = document.getElementById('settings-confirm-modal');
    const settingsConfirmApplyBtn = document.getElementById('settings-confirm-apply');
    const settingsConfirmCancelBtn = document.getElementById('settings-confirm-cancel');
    
    // Tab navigation elements
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Make sure the prayer source settings module is initialized
    if (window.prayerSourceSettings) {
        console.log("Initialising prayer source settings module...");
        window.prayerSourceSettings.initialize();
    } else {
        console.error("Prayer source settings module not found!");
    }
    
    // Initialize Azan Settings tab
    if (window.azanSettings) {
        window.azanSettings.initialize();
    }
    
    // Tab switching functionality
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked button
            button.classList.add('active');
            
            // Show corresponding content
            const tabId = button.getAttribute('data-tab');
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });
    
    // Show settings button click handler
    settingsBtn.addEventListener('click', async () => {
        // Skip authentication check if already authenticated
        if (isAuthenticated) {
            showSettingsModal();
        } else {
            // Only show login modal if not already authenticated
            const isAuth = await checkAuthStatus();
            if (isAuth) {
                showSettingsModal();
            } else {
                showLoginModal(showSettingsModal);
            }
        }
    });
    
    // Save button click handler
    settingsSaveBtn.addEventListener('click', async () => {
        // Get prayer source settings
        let prayerSourceSettings = null;
        let prayerSourceValid = true;
        if (window.prayerSourceSettings) {
            prayerSourceSettings = window.prayerSourceSettings.getSettings();
            
            // Validate prayer source settings
            const validation = window.prayerSourceSettings.validate();
            if (!validation.isValid) {
                prayerSourceValid = false;
                // Show error message
                if (window.showErrorMessage) {
                    window.showErrorMessage(validation.error);
                } else {
                    alert(validation.error);
                }
                return;
            }
        }
        
        // Get azan settings
        let azanSettings = null;
        if (window.azanSettings) {
            azanSettings = window.azanSettings.getSettings();
        }
        
        // Check if any settings have changed
        const sourceSettingsChanged = window.prayerSourceSettings && window.prayerSourceSettings.haveChanged(prayerSourceSettings);
        const azanSettingsChanged = window.azanSettings && window.azanSettings.haveChanged();
        
        if ((sourceSettingsChanged || azanSettingsChanged) && prayerSourceValid) {
            // Show confirmation modal
            settingsConfirmModal.classList.add('show');
            
            // Confirm button handler
            settingsConfirmApplyBtn.onclick = async () => {
                // Close the confirmation modal
                settingsConfirmModal.classList.remove('show');
                
                // Add loading indicator
                const loadingIndicator = document.createElement('div');
                loadingIndicator.className = 'settings-loading';
                loadingIndicator.innerHTML = `
                    <div class="settings-loading-spinner"></div>
                    <div class="settings-loading-text">Saving settings and updating prayer times...</div>
                `;
                document.querySelector('.settings-content').appendChild(loadingIndicator);
                
                let success = true;
                let errorMessage = '';
                
                // Save azan settings if changed
                if (azanSettingsChanged && window.azanSettings) {
                    const saveResult = await window.azanSettings.save();
                    if (!saveResult.success) {
                        success = false;
                        errorMessage = saveResult.error || 'Failed to save azan settings';
                        console.error('Failed to save azan settings:', saveResult.error);
                    }
                }
                
                // Save prayer source settings if changed
                if (sourceSettingsChanged && window.prayerSourceSettings) {
                    const saveResult = await window.prayerSourceSettings.save(prayerSourceSettings);
                    if (!saveResult.success) {
                        success = false;
                        errorMessage = saveResult.error || 'Failed to save prayer source settings';
                        console.error('Failed to save prayer source settings:', saveResult.error);
                    }
                }
                
                // Remove loading indicator
                loadingIndicator.remove();
                
                if (success) {
                    // Show success message
                    const successMessage = document.createElement('div');
                    successMessage.className = 'success-message';
                    successMessage.style.display = 'block';
                    successMessage.textContent = 'Settings saved successfully!';
                    document.querySelector('.settings-content').appendChild(successMessage);
                    
                    // Log success
                    updateLogs({
                        type: 'system',
                        message: 'Prayer settings updated successfully',
                        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
                    });
                    
                    // Hide success message after 3 seconds and close modal
                    setTimeout(() => {
                        successMessage.remove();
                        settingsModal.classList.remove('show');
                        
                        // Refresh prayer data
                        updatePrayerData();
                    }, 3000);
                } else {
                    // Show error message
                    const errorMessageElement = document.createElement('div');
                    errorMessageElement.className = 'error-message';
                    errorMessageElement.style.display = 'block';
                    errorMessageElement.textContent = errorMessage || 'Failed to update settings';
                    document.querySelector('.settings-content').appendChild(errorMessageElement);
                    
                    // Log error
                    updateLogs({
                        type: 'error',
                        message: 'Failed to update settings: ' + errorMessage,
                        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
                    });
                    
                    // Hide error message after 5 seconds
                    setTimeout(() => {
                        errorMessageElement.remove();
                    }, 5000);
                }
            };
            
            // Cancel button handler
            settingsConfirmCancelBtn.onclick = () => {
                settingsConfirmModal.classList.remove('show');
            };
        } else {
            // No changes, just close the modal
            settingsModal.classList.remove('show');
        }
    });
    
    // Cancel button click handler
    settingsCancelBtn.addEventListener('click', () => {
        settingsModal.classList.remove('show');
    });
    
    // Close modal if clicking outside
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.classList.remove('show');
        }
    });
    
    // Close confirm modal if clicking outside
    settingsConfirmModal.addEventListener('click', (e) => {
        if (e.target === settingsConfirmModal) {
            settingsConfirmModal.classList.remove('show');
        }
    });
}

// Toggle prayer-specific controls based on global toggle
function togglePrayerSpecificControls(type, enabled) {
    const prayers = ['fajr', 'zuhr', 'asr', 'maghrib', 'isha'];
    
    // If disabling global azan, also disable global announcement
    if (type === 'azan' && !enabled && globalAnnouncementToggle) {
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
    
    // If re-enabling global azan, re-enable global announcement toggle
    if (type === 'azan' && enabled && globalAnnouncementToggle && globalAnnouncementToggle.disabled) {
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
        
        // If re-enabling, no need to change the checked status as it's preserved
        
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

// Add event listeners to prayer toggle switches
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

// Show settings modal
async function showSettingsModal() {
    try {
        // Fetch latest settings
        const settings = await fetchPrayerSettings();
        
        // Always fetch fresh feature states directly from the server
        const featuresResponse = await fetch('/api/features');
        const features = await featuresResponse.json();
        
        // Store app config with fresh feature states
        appConfig.features = features;
        
        // Populate form with settings
        populateSettingsForm(settings, features);
        
        // Add event listeners to prayer toggle switches
        addPrayerToggleListeners();
        
        // Show modal
        settingsModal.classList.add('show');
    } catch (error) {
        console.error('Error showing settings modal:', error);
    }
}

// Initialise with logs hidden by default
async function initialise() {
    await checkAuthStatus();
    await initialiseTestMode();
    await updatePrayerData();
    initialiseLogStream();
    initialiseLogControls();
    initialiseLogScroll();
    initialiseFeatureStates();
    initialiseSettingsPanel();
    addPrayerToggleListeners();

    // Start intervals
    setInterval(() => {
        const now = getCurrentTime();
        currentTimeDisplay.textContent = now.format('HH:mm:ss');
        updateCountdown();
    }, UPDATE_INTERVAL);

    setInterval(updatePrayerData, 30000);
    
    // Check auth status periodically
    setInterval(checkAuthStatus, 60000);
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Since moment.js is already loaded in the HTML head, we can just call initialize
    initialise();
});

// Override console.log to capture and broadcast logs
const originalConsoleLog = console.log;
console.log = function(...args) {
    originalConsoleLog.apply(console, args);
    const logMessage = args.map(arg => {
        if (typeof arg === 'object') {
            if (arg instanceof Array && arg.length > 0 && 'Prayer' in arg[0]) {
                // Format table data
                return formatPrayerTable(arg);
            }
            return JSON.stringify(arg);
        }
        return arg.toString();
    }).join(' ');

    updateLogs({
        type: 'log',
        message: logMessage,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
    });
};

// Override console.error to capture and broadcast errors
const originalConsoleError = console.error;
console.error = function(...args) {
    originalConsoleError.apply(console, args);
    const logMessage = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg) : arg.toString()
    ).join(' ');

    updateLogs({
        type: 'error',
        message: logMessage,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
    });
};

// Helper function for formatting prayer table
function formatPrayerTable(data) {
    const maxPrayerLength = Math.max(...data.map(row => row.Prayer.length));
    const maxTimeLength = Math.max(...data.map(row => row.Time.length));

    const header = `| Prayer${' '.repeat(maxPrayerLength - 6)} | Time${' '.repeat(maxTimeLength - 4)} |`;
    const separator = `|${'-'.repeat(maxPrayerLength + 2)}|${'-'.repeat(maxTimeLength + 2)}|`;
    const rows = data.map(row =>
        `| ${row.Prayer}${' '.repeat(maxPrayerLength - row.Prayer.length)} | ${row.Time}${' '.repeat(maxTimeLength - row.Time.length)} |`
    );

    return [header, separator, ...rows].join('\n');
}

// Close modals if clicking outside
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('show');
        }
    });
});

// Store app config
let appConfig = {};

// Initialise feature states
async function initialiseFeatureStates() {
    try {
        const response = await fetch('/api/features');
        const features = await response.json();
        
        // Store app config
        appConfig = { features };
    } catch (error) {
        console.error('Error fetching feature states:', error);
    }
}

// Authentication state
let authToken = localStorage.getItem('authToken');
let isAuthenticated = false;

// Authentication functions
async function checkAuthStatus() {
    if (!authToken) {
        isAuthenticated = false;
        updateAuthUI();
        return;
    }

    try {
        const response = await fetch('/api/auth/status', {
            headers: {
                'x-auth-token': authToken
            }
        });
        const data = await response.json();
        isAuthenticated = data.authenticated;
        
        if (!isAuthenticated) {
            authToken = null;
            localStorage.removeItem('authToken');
        }
        updateAuthUI();
    } catch (error) {
        console.error('Error checking auth status:', error);
        isAuthenticated = false;
        updateAuthUI();
    }
}

async function login(username, password) {
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        // Check if the response is not OK (e.g. 401 Unauthorized)
        if (!response.ok) {
            // Try to get a more specific error message from the response if available
            try {
                const errorData = await response.json();
                return { 
                    success: false, 
                    message: errorData.message || `Authentication failed (${response.status})`
                };
            } catch (parseError) {
                // If we can't parse the JSON response, use a generic message with the status code
                return { 
                    success: false, 
                    message: `Authentication failed (${response.status})`
                };
            }
        }
        
        const data = await response.json();
        if (data.success) {
            authToken = data.token;
            localStorage.setItem('authToken', authToken);
            isAuthenticated = true;
            updateAuthUI();
            
            // After successful login, initialize prayer source settings
            if (window.prayerSourceSettings) {
                console.log("Initialising prayer source settings after login...");
                window.prayerSourceSettings.initialize();
            }
            
            return { success: true };
        }
        
        // Return the error message from the server if available
        return { 
            success: false, 
            message: data.message || 'Invalid username or password'
        };
    } catch (error) {
        console.error('Error logging in:', error);
        return { success: false, message: 'Login failed: Network or server error' };
    }
}

async function logout() {
    if (!authToken) return;

    try {
        await fetch('/api/auth/logout', {
            method: 'POST',
            headers: {
                'x-auth-token': authToken
            }
        });
    } catch (error) {
        console.error('Error logging out:', error);
    }

    authToken = null;
    localStorage.removeItem('authToken');
    isAuthenticated = false;
}

// Show login modal
function showLoginModal(onSuccess) {
    const modal = document.getElementById('login-modal');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const errorMessage = document.getElementById('login-error');
    const submitButton = document.getElementById('login-submit');
    const cancelButton = document.getElementById('login-cancel');

    // Clear any previous error messages
    errorMessage.textContent = '';
    errorMessage.style.display = 'none';
    
    modal.classList.add('show');
    usernameInput.focus();
    
    const handleSubmit = async () => {
        // Clear previous error
        errorMessage.textContent = '';
        errorMessage.style.display = 'none';
        
        // Show loading state
        submitButton.disabled = true;
        submitButton.textContent = 'Logging in...';
        
        const result = await login(usernameInput.value, passwordInput.value);
        
        // Reset button state
        submitButton.disabled = false;
        submitButton.textContent = 'Login';
        
        if (result.success) {
            modal.classList.remove('show');
            usernameInput.value = '';
            passwordInput.value = '';
            if (onSuccess) onSuccess();
        } else {
            // Display error message
            errorMessage.textContent = result.message || 'Login failed';
            errorMessage.style.display = 'block';
        }
    };

    submitButton.onclick = handleSubmit;
    cancelButton.onclick = () => {
        modal.classList.remove('show');
        usernameInput.value = '';
        passwordInput.value = '';
        errorMessage.textContent = '';
        errorMessage.style.display = 'none';
    };

    // Handle Enter key
    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleSubmit();
        }
    };

    usernameInput.onkeypress = handleKeyPress;
    passwordInput.onkeypress = handleKeyPress;
}

// Add logout button handling
const logoutBtn = document.getElementById('logout-btn');

function updateAuthUI() {
    if (isAuthenticated) {
        logoutBtn.style.display = 'block';
    } else {
        logoutBtn.style.display = 'none';
    }
}

logoutBtn.addEventListener('click', async () => {
    await logout();
    updateAuthUI();
});

// Show/Hide Logs functionality
document.addEventListener('DOMContentLoaded', async () => {
    const showLogsBtn = document.getElementById('show-logs-btn');
    const hideLogsBtn = document.getElementById('hide-logs-btn');
    const logsContainer = document.querySelector('.logs-container');
    const container = document.querySelector('.container');
    
    // Check if system logs are enabled
    try {
        const response = await fetch('/api/features');
        const features = await response.json();
        
        if (!features.systemLogsEnabled) {
            // If logs are disabled, hide both the button and container
            showLogsBtn.style.display = 'none';
            logsContainer.style.display = 'none';
            container.classList.remove('logs-visible');
            return; // Exit early as we don't need to set up the event listeners
        }
    } catch (error) {
        console.error('Error checking system logs status:', error);
    }
    
    // Only set up event listeners if logs are enabled
    logsContainer.classList.add('hidden');
    showLogsBtn.style.display = 'block';
    container.classList.remove('logs-visible');
    
    showLogsBtn.addEventListener('click', async () => {
        logsContainer.classList.remove('hidden');
        showLogsBtn.style.display = 'none';
        container.classList.add('logs-visible');
        
        // Fetch existing logs if container is empty
        if (!logContainer.children.length) {
            try {
                const response = await fetch('/api/logs');
                const logs = await response.json();
                logs.forEach(log => updateLogs(log));
            } catch (error) {
                console.error('Error fetching logs:', error);
            }
        }
        
        // Ensure we scroll to bottom after logs are loaded
        requestAnimationFrame(() => {
            logContainer.scrollTop = logContainer.scrollHeight;
            shouldAutoScroll = true;
        });
    });

    hideLogsBtn.addEventListener('click', () => {
        logsContainer.classList.add('hidden');
        showLogsBtn.style.display = 'block';
        container.classList.remove('logs-visible');
    });
});