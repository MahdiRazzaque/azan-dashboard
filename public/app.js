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

    if (data.nextPrayer) {
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
    } else {
        nextPrayerName.textContent = 'No more prayers today';
        nextPrayerTime = null;
        countdownDisplay.textContent = '--:--:--';
    }
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
        const response = await fetch('/api/prayer-times');
        const data = await response.json();
        
        // Store the current prayer data
        currentPrayerData = data;

        updatePrayerTable(data.iqamahTimes, data.startTimes, data.nextPrayer);
        updateTimeAndNextPrayer(data);
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
    if (!settings) return;
    
    // Set global settings
    globalAzanToggle.checked = features.azanEnabled;
    globalAnnouncementToggle.checked = features.announcementEnabled;
    
    // Clear existing prayer settings
    prayerSettingsContainer.innerHTML = '';
    
    // Add settings for each prayer
    const prayers = ['fajr', 'zuhr', 'asr', 'maghrib', 'isha'];
    prayers.forEach(prayer => {
        const prayerSettings = settings.prayers[prayer] || {
            azanEnabled: true,
            announcementEnabled: true,
            azanAtIqamah: false
        };
        
        const prayerSettingDiv = document.createElement('div');
        prayerSettingDiv.className = 'prayer-setting';
        prayerSettingDiv.innerHTML = `
            <h5>${PRAYER_DISPLAY_NAMES[prayer]}</h5>
            <div class="setting-group">
                <div class="setting-row">
                    <label>Enable Azan</label>
                    <div class="toggle-switch">
                        <input type="checkbox" id="${prayer}-azan-toggle" class="toggle-input" ${prayerSettings.azanEnabled ? 'checked' : ''}>
                        <label for="${prayer}-azan-toggle" class="toggle-label"></label>
                    </div>
                </div>
                <div class="setting-row">
                    <label>Azan Timing</label>
                    <div class="radio-group">
                        <div class="radio-option">
                            <input type="radio" id="${prayer}-azan-start" name="${prayer}-azan-timing" value="start" ${!prayerSettings.azanAtIqamah ? 'checked' : ''}>
                            <label for="${prayer}-azan-start">Prayer Start</label>
                        </div>
                        <div class="radio-option">
                            <input type="radio" id="${prayer}-azan-iqamah" name="${prayer}-azan-timing" value="iqamah" ${prayerSettings.azanAtIqamah ? 'checked' : ''}>
                            <label for="${prayer}-azan-iqamah">Iqamah Time</label>
                        </div>
                    </div>
                </div>
                <div class="setting-row">
                    <label>Enable Announcement (15 min before prayer)</label>
                    <div class="toggle-switch">
                        <input type="checkbox" id="${prayer}-announcement-toggle" class="toggle-input" ${prayerSettings.announcementEnabled ? 'checked' : ''}>
                        <label for="${prayer}-announcement-toggle" class="toggle-label"></label>
                    </div>
                </div>
            </div>
        `;
        
        prayerSettingsContainer.appendChild(prayerSettingDiv);
    });
    
    // Initialize prayer-specific toggle states based on global settings
    if (!features.azanEnabled) {
        togglePrayerSpecificControls('azan', false);
    }
    
    if (!features.announcementEnabled) {
        togglePrayerSpecificControls('announcement', false);
    }
}

// Gather settings from form
function getSettingsFromForm() {
    const settings = {
        prayers: {},
        globalAzanEnabled: globalAzanToggle.checked,
        globalAnnouncementEnabled: globalAnnouncementToggle.checked
    };
    
    const prayers = ['fajr', 'zuhr', 'asr', 'maghrib', 'isha'];
    prayers.forEach(prayer => {
        const azanEnabled = document.getElementById(`${prayer}-azan-toggle`).checked;
        const announcementEnabled = document.getElementById(`${prayer}-announcement-toggle`).checked;
        const azanAtIqamah = document.getElementById(`${prayer}-azan-iqamah`).checked;
        
        settings.prayers[prayer] = {
            azanEnabled,
            announcementEnabled,
            azanAtIqamah
        };
    });
    
    return settings;
}

// Check if settings have changed
function haveSettingsChanged(newSettings) {
    if (!originalPrayerSettings) return true;
    
    // Check global settings
    if (newSettings.globalAzanEnabled !== appConfig.features.azanEnabled) return true;
    if (newSettings.globalAnnouncementEnabled !== appConfig.features.announcementEnabled) return true;
    
    // Check prayer-specific settings
    const prayers = ['fajr', 'zuhr', 'asr', 'maghrib', 'isha'];
    for (const prayer of prayers) {
        const original = originalPrayerSettings.prayers[prayer];
        const updated = newSettings.prayers[prayer];
        
        if (!original || !updated) return true;
        
        if (original.azanEnabled !== updated.azanEnabled) return true;
        if (original.announcementEnabled !== updated.announcementEnabled) return true;
        if (original.azanAtIqamah !== updated.azanAtIqamah) return true;
    }
    
    return false;
}

// Save settings to server
async function saveSettings(settings) {
    try {
        const response = await fetch('/api/prayer-settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': authToken
            },
            body: JSON.stringify(settings)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to save settings');
        }
        
        const result = await response.json();
        
        // Update stored settings
        currentPrayerSettings = result.settings;
        originalPrayerSettings = JSON.parse(JSON.stringify(result.settings));
        
        // Update global feature flags
        await initialiseFeatureStates();
                
        return true;
    } catch (error) {
        console.error('Error saving settings:', error);
        return false;
    }
}

// Initialise settings panel
async function initialiseSettingsPanel() {
    // Settings button click handler
    settingsBtn.addEventListener('click', async () => {
        if (!isAuthenticated) {
            showLoginModal(async () => {
                await showSettingsModal();
            });
            return;
        }
        
        await showSettingsModal();
    });
    
    // Add event listeners for global toggles to disable/enable prayer-specific toggles
    globalAzanToggle.addEventListener('change', (e) => {
        togglePrayerSpecificControls('azan', e.target.checked);
    });
    
    globalAnnouncementToggle.addEventListener('change', (e) => {
        togglePrayerSpecificControls('announcement', e.target.checked);
    });
    
    // Save button click handler
    settingsSaveBtn.addEventListener('click', async () => {
        const newSettings = getSettingsFromForm();
        
        // Check if settings have changed
        if (haveSettingsChanged(newSettings)) {
            // Show confirmation modal
            settingsConfirmModal.classList.add('show');
            
            // Confirm button handler
            settingsConfirmApplyBtn.onclick = async () => {
                const success = await saveSettings(newSettings);
                
                if (success) {
                    updateLogs({
                        type: 'system',
                        message: 'Prayer settings updated successfully',
                        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
                    });
                    
                    // Close both modals
                    settingsConfirmModal.classList.remove('show');
                    settingsModal.classList.remove('show');
                    
                    // Refresh prayer data
                    await updatePrayerData();
                } else {
                    updateLogs({
                        type: 'error',
                        message: 'Failed to update prayer settings',
                        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
                    });
                    settingsConfirmModal.classList.remove('show');
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

// Add moment.js from CDN
const momentScript = document.createElement('script');
momentScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.1/moment.min.js';
momentScript.onload = initialise;
document.head.appendChild(momentScript);

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
        
        const data = await response.json();
        if (data.success) {
            authToken = data.token;
            localStorage.setItem('authToken', authToken);
            isAuthenticated = true;
            updateAuthUI();
            return { success: true };
        }
        
        // Return the error message from the server if available
        return { 
            success: false, 
            message: data.message || 'Invalid username or password'
        };
    } catch (error) {
        console.error('Error logging in:', error);
        return { success: false, message: 'Login failed' };
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

    modal.classList.add('show');
    usernameInput.focus();    const handleSubmit = async () => {
        errorMessage.textContent = '';
        const result = await login(usernameInput.value, passwordInput.value);
        
        if (result.success) {
            modal.classList.remove('show');
            usernameInput.value = '';
            passwordInput.value = '';
            if (onSuccess) onSuccess();
        } else {
            errorMessage.textContent = result.message;
        }
    };

    submitButton.onclick = handleSubmit;
    cancelButton.onclick = () => {
        modal.classList.remove('show');
        usernameInput.value = '';
        passwordInput.value = '';
        errorMessage.textContent = '';
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