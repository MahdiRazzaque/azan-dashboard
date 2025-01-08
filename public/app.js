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

// DOM Elements
const prayerTable = document.getElementById('prayer-table').getElementsByTagName('tbody')[0];
const currentTimeDisplay = document.getElementById('current-time-display');
const nextPrayerName = document.getElementById('next-prayer-name');
const countdownDisplay = document.getElementById('countdown-display');
const logContainer = document.getElementById('log-container');
const logsContainer = document.querySelector('.logs-container');
const container = document.querySelector('.container');
const logControls = document.querySelector('.log-controls');

// Store next prayer time globally
let nextPrayerTime = null;

// Add global variable to track auto-scroll state
let shouldAutoScroll = true;

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

        updatePrayerTable(data.iqamahTimes, data.startTimes, data.nextPrayer);
        updateTimeAndNextPrayer(data);
    } catch (error) {
        console.error('Error fetching prayer times:', error);
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

// Add feature toggle functionality
const azanToggle = document.getElementById('azan-toggle');
const announcementToggle = document.getElementById('announcement-toggle');

// Initialise feature states
async function initialiseFeatureStates() {
    try {
        const response = await fetch('/api/features');
        const features = await response.json();
        
        // Update azan toggle
        azanToggle.classList.toggle('enabled', features.azanEnabled);
        azanToggle.classList.toggle('disabled', !features.azanEnabled);
        
        // Update announcement toggle
        announcementToggle.classList.toggle('enabled', features.announcementEnabled);
        announcementToggle.classList.toggle('disabled', !features.announcementEnabled);
    } catch (error) {
        console.error('Error fetching feature states:', error);
    }
}

// Toggle feature function
async function toggleFeature(feature, button) {
    if (!isAuthenticated) {
        showLoginModal(async () => {
            await toggleFeature(feature, button);
        });
        return;
    }

    try {
        const currentState = button.classList.contains('enabled');
        const newState = !currentState;
        
        const response = await fetch('/api/features', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': authToken
            },
            body: JSON.stringify({
                [feature]: newState
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            button.classList.toggle('enabled', newState);
            button.classList.toggle('disabled', !newState);
        } else {
            console.error(`Failed to toggle ${feature}:`, result.error);
            // Revert button state if there was an error
            button.classList.toggle('enabled', currentState);
            button.classList.toggle('disabled', !currentState);
        }
    } catch (error) {
        console.error(`Error toggling ${feature}:`, error);
        // Show error in logs
        logStore.addLog('error', `Error toggling ${feature}: ${error.message}`);
        broadcastLogs(logStore.logs[logStore.logs.length - 1]);
    }
}

// Add event listeners for toggles
azanToggle.addEventListener('click', () => toggleFeature('azanEnabled', azanToggle));
announcementToggle.addEventListener('click', () => toggleFeature('announcementEnabled', announcementToggle));

// Initialise feature states on page load
initialiseFeatureStates();

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
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error logging in:', error);
        return false;
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
    usernameInput.focus();

    const handleSubmit = async () => {
        errorMessage.textContent = '';
        const success = await login(usernameInput.value, passwordInput.value);
        
        if (success) {
            modal.classList.remove('show');
            usernameInput.value = '';
            passwordInput.value = '';
            if (onSuccess) onSuccess();
        } else {
            errorMessage.textContent = 'Invalid username or password';
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
    
    showLogsBtn.addEventListener('click', () => {
        logsContainer.classList.remove('hidden');
        showLogsBtn.style.display = 'none';
        container.classList.add('logs-visible');
    });

    hideLogsBtn.addEventListener('click', () => {
        logsContainer.classList.add('hidden');
        showLogsBtn.style.display = 'block';
        container.classList.remove('logs-visible');
    });
});