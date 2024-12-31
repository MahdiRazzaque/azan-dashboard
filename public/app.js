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

async function initializeTestMode() {
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

// Initialize log controls
function initializeLogControls() {
    const clearLogsBtn = document.getElementById('clear-logs');
    const scrollBottomBtn = document.getElementById('scroll-bottom');
    const lastErrorBtn = document.getElementById('last-error');
    const modal = document.getElementById('confirm-modal');
    const modalConfirm = document.getElementById('modal-confirm');
    const modalCancel = document.getElementById('modal-cancel');

    // Modal handling
    clearLogsBtn.addEventListener('click', () => {
        modal.classList.add('show');
    });

    modalCancel.addEventListener('click', () => {
        modal.classList.remove('show');
    });

    modalConfirm.addEventListener('click', async () => {
        try {
            await fetch('/api/logs/clear', { method: 'POST' });
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

// Initialize SSE connection for logs
function initializeLogStream() {
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
        setTimeout(initializeLogStream, 5000);
    };

    return eventSource;
}

// Initialize log container scroll handling
function initializeLogScroll() {
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

// Initialize with logs hidden by default
async function initialize() {
    await initializeTestMode();
    await updatePrayerData();
    initializeLogStream();
    initializeLogControls();
    initializeLogScroll();

    // Start intervals
    setInterval(() => {
        const now = getCurrentTime();
        currentTimeDisplay.textContent = now.format('HH:mm:ss');
        updateCountdown();
    }, UPDATE_INTERVAL);

    setInterval(updatePrayerData, 30000);
}

// Add moment.js from CDN
const momentScript = document.createElement('script');
momentScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.1/moment.min.js';
momentScript.onload = initialize;
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