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

/**
 * Formats remaining milliseconds into a human-readable string.
 * - If time is less than 1 minute, it shows seconds (e.g., "45sec").
 * - If time is 1 minute or more, it shows a combination of hours and minutes,
 *   truncating any remaining seconds (e.g., "1h 5min", "2min").
 */
function formatTimeRemaining(ms) {
    // 1. Handle edge cases first
    if (ms < 0) return '--:--:--';
    if (ms === 0) return '0sec'; // Consistent with the rule for < 1 min

    // 2. Implement the primary rule: Show seconds ONLY if total time is less than a minute.
    if (ms < 60000) { // 60,000 milliseconds = 1 minute
        const seconds = moment.duration(ms).seconds();
        return `${seconds}sec`;
    }

    // 3. If we are here, time is >= 1 minute. We will only show hours and minutes.
    const duration = moment.duration(ms);
    const hours = Math.floor(duration.asHours());
    const minutes = duration.minutes();

    const parts = [];

    if (hours > 0) {
        parts.push(`${hours}h`);
    }
    
    // Only add minutes if they are greater than 0.
    // For a time like "1 hour and 5 seconds", this part will be skipped,
    // resulting in a clean "1h" output.
    if (minutes > 0) {
        parts.push(`${minutes}min`);
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
        if (!response.ok) {
            console.error('Failed to fetch test mode configuration:', response.status);
            return;
        }
        
        const config = await response.json();
        testMode = config.enabled;
        testStartTime = moment(config.startTime, 'HH:mm:ss');
        timeOffset = testMode ? moment().diff(testStartTime) : 0;

        if (testMode) {
            console.log(`🧪 Test Mode Enabled - Time set to ${testStartTime.format('HH:mm:ss')}`);
            
            // Add visual indicator for test mode
            const testModeIndicator = document.createElement('div');
            testModeIndicator.className = 'test-mode-indicator';
            testModeIndicator.innerHTML = '🧪 Test Mode';
            document.body.appendChild(testModeIndicator);
            
            // Add CSS for the indicator if it doesn't exist
            if (!document.getElementById('test-mode-style')) {
                const style = document.createElement('style');
                style.id = 'test-mode-style';
                style.textContent = `
                    .test-mode-indicator {
                        position: fixed;
                        top: 10px;
                        right: 10px;
                        background-color: rgba(255, 193, 7, 0.9);
                        color: #000;
                        padding: 5px 10px;
                        border-radius: 4px;
                        font-size: 0.8rem;
                        font-weight: bold;
                        z-index: 9999;
                    }
                `;
                document.head.appendChild(style);
            }
            
            // Auto-login in test mode if not already authenticated
            if (!isAuthenticated) {
                try {
                    console.log("🧪 Test Mode: Attempting auto-login");
                    const loginResponse = await fetch('/api/auth/login', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ username: 'test-user', password: 'test-password' })
                    });
                    
                    if (loginResponse.ok) {
                        const loginData = await loginResponse.json();
                        if (loginData.success && loginData.token) {
                            localStorage.setItem('authToken', loginData.token);
                            isAuthenticated = true;
                            console.log("🧪 Test Mode: Auto-login successful");
                            updateAuthUI();
                        }
                    }
                } catch (error) {
                    console.error("🧪 Test Mode: Auto-login failed", error);
                }
            }
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
        if (!isAuthenticated && !testMode) {
            showLoginModal(() => {
                modal.classList.add('show');
            });
            return;
        }
        if (testMode && !isAuthenticated) {
            console.log("🧪 Test Mode: Bypassing authentication for log controls");
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
        if (e.target === modal && !modal.classList.contains('required-setup')) {
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

        console.log("Prayer settings:", settings);
        
        // Store the current prayer settings
        currentPrayerSettings = settings;
        originalPrayerSettings = JSON.parse(JSON.stringify(settings)); // Deep copy for comparison
        
        return settings;
    } catch (error) {
        console.error('Error fetching prayer settings:', error);
        return null;
    }
}

// Fetch feature settings
async function fetchFeatureSettings() {
    try {
        const response = await fetch('/api/features');
        const features = await response.json();
                
        // Store in app config
        appConfig.features = features;
        
        return features;
    } catch (error) {
        console.error('Error fetching feature settings:', error);
        return {
            azanEnabled: true,
            announcementEnabled: true
        };
    }
}

// Gather settings from form
function getSettingsFromForm() {
    const settings = {
        globalAzanEnabled: document.getElementById('global-azan-toggle').checked,
        globalAnnouncementEnabled: document.getElementById('global-announcement-toggle').checked,
        prayers: {},
        prayerSource: {}
    };
    
            // Get prayer-specific settings
        for (const prayer of ['fajr', 'zuhr', 'asr', 'maghrib', 'isha']) {
            const azanToggle = document.getElementById(`${prayer}-azan-toggle`);
            const azanStartRadio = document.getElementById(`${prayer}-azan-start`);
            const announcementToggle = document.getElementById(`${prayer}-announcement-toggle`);
            
            if (azanToggle && azanStartRadio && announcementToggle) {
                settings.prayers[prayer] = {
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
    
    // Compare global settings with features
    if (newSettings.globalAzanEnabled !== appConfig.features?.azanEnabled ||
        newSettings.globalAnnouncementEnabled !== appConfig.features?.announcementEnabled) {
        return true;
    }
    
    // Compare prayer-specific settings
    for (const prayer of ['fajr', 'zuhr', 'asr', 'maghrib', 'isha']) {
        const newPrayer = newSettings.prayers[prayer];
        const currentPrayer = currentSettings.prayers[prayer];
        
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
        // Save global feature toggles
        const featuresResponse = await fetch('/api/features', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': localStorage.getItem('authToken')
            },
            body: JSON.stringify({
                azanEnabled: settings.globalAzanEnabled,
                announcementEnabled: settings.globalAnnouncementEnabled
            })
        });
        
        if (!featuresResponse.ok) {
            throw new Error(`Failed to save feature settings: ${featuresResponse.statusText}`);
        }
        
        // Save prayer-specific settings
        const prayerResponse = await fetch('/api/prayer-settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': localStorage.getItem('authToken')
            },
            body: JSON.stringify({
                prayers: settings.prayers
            })
        });
        
        if (!prayerResponse.ok) {
            throw new Error(`Failed to save prayer settings: ${prayerResponse.statusText}`);
        }
        
        // Save prayer source settings
        const sourceResponse = await fetch('/api/prayer-source', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': localStorage.getItem('authToken')
            },
            body: JSON.stringify(settings.prayerSource)
        });
        
        if (!sourceResponse.ok) {
            throw new Error(`Failed to save prayer source settings: ${sourceResponse.statusText}`);
        }
        
        // Update current settings cache
        currentSettings = {
            prayers: settings.prayers
        };
        
        // Update app config with new feature states
        appConfig.features = {
            ...appConfig.features,
            azanEnabled: settings.globalAzanEnabled,
            announcementEnabled: settings.globalAnnouncementEnabled
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
    
    // initialise settings modules
    console.log("initialising settings modules...");
    
    // Make sure the prayer source settings module is initialised
    if (window.prayerSourceSettings) {
        console.log("Initialising prayer source settings module...");
        window.prayerSourceSettings.initialise();
        window.prayerSourceSettingsinitialised = true;
    } else {
        console.error("Prayer source settings module not found!");
    }
    
    // initialise Azan Settings tab
    if (window.azanSettings) {
        console.log("Initialising azan settings module...");
        window.azanSettings.initialise();
    } else {
        console.error("Azan settings module not found!");
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
        // Skip authentication check if already authenticated or in test mode
        if (isAuthenticated || testMode) {
            if (testMode && !isAuthenticated) {
                console.log("🧪 Test Mode: Bypassing authentication for settings access");
            }
            showSettingsModal();
        } else {
            // Only show login modal if not already authenticated and not in test mode
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
                
                // Close the settings modal first
                settingsModal.classList.remove('show');
                
                // Show the saving modal
                const savingModal = document.getElementById('settings-saving-modal');
                const progressBar = savingModal.querySelector('.progress-bar');
                const setupMessage = savingModal.querySelector('.setup-message');
                savingModal.classList.add('show');
                
                // Update progress function
                const updateProgress = (percent, message) => {
                    progressBar.style.width = `${percent}%`;
                    if (message) {
                        setupMessage.textContent = message;
                    }
                };
                
                let success = true;
                let errorMessage = '';
                
                // Initial progress
                updateProgress(10, 'Preparing to save settings...');
                
                // Save azan settings if changed
                if (azanSettingsChanged && window.azanSettings) {
                    updateProgress(30, 'Saving azan and announcement settings...');
                    const saveResult = await window.azanSettings.save();
                    if (!saveResult.success) {
                        success = false;
                        errorMessage = saveResult.error || 'Failed to save azan settings';
                        console.error('Failed to save azan settings:', saveResult.error);
                    }
                }
                
                // Save prayer source settings if changed
                if (sourceSettingsChanged && window.prayerSourceSettings) {
                    updateProgress(60, 'Saving prayer source settings...');
                    const saveResult = await window.prayerSourceSettings.save(prayerSourceSettings);
                    if (!saveResult.success) {
                        success = false;
                        errorMessage = saveResult.error || 'Failed to save prayer source settings';
                        console.error('Failed to save prayer source settings:', saveResult.error);

                        // If it's a guild ID error, handle it specifically
                        if (saveResult.isGuildIdError) {
                            // Display error in the saving modal
                            setupMessage.classList.add('error');
                            updateProgress(100, 'Invalid Guild ID. Please try again.');
                            
                            await new Promise(resolve => setTimeout(resolve, 2000));
                            
                            // Clean up and hide modal
                            setupMessage.classList.remove('error');
                            savingModal.classList.remove('show');
                            
                            // Re-open settings modal and navigate to the correct tab
                            showSettingsModal();
                            const prayerSourceTab = document.querySelector('.tab-btn[data-tab="prayer-source"]');
                            if (prayerSourceTab) {
                                prayerSourceTab.click();
                            }

                            // Show error message under the input in the settings modal
                            const guildIdInput = document.getElementById('mymasjid-guild-id');
                            const guildIdError = document.getElementById('settings-mymasjid-error');

                            if (guildIdInput) {
                                guildIdInput.classList.add('invalid-input');
                            }
                            if (guildIdError) {
                                guildIdError.textContent = saveResult.error || 'Invalid Guild ID. Please check and try again.';
                                guildIdError.style.display = 'block';
                            }
                            
                            return; // Stop further execution
                        }
                    }
                }
                
                updateProgress(90, 'Updating prayer times...');
                
                // Add a small delay for better user experience
                await new Promise(resolve => setTimeout(resolve, 500));
                
                updateProgress(100, success ? 'Settings saved successfully!' : 'Error saving settings');
                
                // Add a delay before closing the modal
                await new Promise(resolve => setTimeout(resolve, 1500));
                
                // Hide the saving modal
                savingModal.classList.remove('show');
                
                if (success) {
                    // Log success
                    updateLogs({
                        type: 'system',
                        message: 'Prayer settings updated successfully',
                        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
                    });
                    
                    // Close settings modal
                    settingsModal.classList.remove('show');
                    
                    // Refresh prayer data
                    updatePrayerData();
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
        if (e.target === settingsModal && !settingsModal.classList.contains('required-setup')) {
            settingsModal.classList.remove('show');
        }
    });
    
    // Close confirm modal if clicking outside
    settingsConfirmModal.addEventListener('click', (e) => {
        if (e.target === settingsConfirmModal && !settingsConfirmModal.classList.contains('required-setup')) {
            settingsConfirmModal.classList.remove('show');
        }
    });
}

// Show settings modal
async function showSettingsModal() {
    try {
        // If we have the azan settings module, refresh it
        if (window.azanSettings && window.azanSettings.refresh) {
            await window.azanSettings.refresh();
        }
        
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

// initialise the application
document.addEventListener('DOMContentLoaded', () => {
    // Since moment.js is already loaded in the HTML head, we can just call initialise
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
        if (e.target === modal && !modal.classList.contains('required-setup')) {
            modal.classList.remove('show');
        }
    });
});

// Store app config
let appConfig = {};

// Initialise feature states
async function initialiseFeatureStates() {
    try {
        const features = await fetchFeatureSettings();
        
        // Store app config
        appConfig = { features };
    } catch (error) {
        console.error('Error initialising feature states:', error);
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
            
            // After successful login, refresh prayer source settings with authenticated data
            if (window.prayerSourceSettings) {
                console.log("Refreshing prayer source settings after login...");
                await window.prayerSourceSettings.fetch();
                window.prayerSourceSettingsinitialised = true;
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
        const features = await fetchFeatureSettings();
        
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