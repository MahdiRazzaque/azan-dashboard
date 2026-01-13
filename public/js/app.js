/* global luxon */
const DateTime = luxon.DateTime;

// Global State
const appState = {
    prayers: {},      // Prayer times for the day
    nextPrayer: null, // { name, time, isTomorrow }
    meta: {
        location: 'UTC', 
        date: null
    },
    error: false
};

// DOM References
const els = {
    loading: document.getElementById('loading'),
    status: document.getElementById('status-indicator'),
    // These will be used in future tasks
    scheduleBody: document.getElementById('schedule-body'),
    digitalClock: document.getElementById('digital-clock'),
    dateDisplay: document.getElementById('date-display'),
    nextName: document.getElementById('next-name'),
    countdown: document.getElementById('countdown-timer')
};

/**
 * Initialize the application
 */
function init() {
    console.log('Azan Dashboard starting...');
    
    // Advanced Features
    initAdvancedFeatures();

    // Initial Fetch
    fetchData();

    // Poll every 15 minutes (900,000 ms)
    setInterval(fetchData, 15 * 60 * 1000);
    
    // Start Clock
    setInterval(updateClock, 1000);
    updateClock();
}

/**
 * Fetch prayer times from backend API
 */
async function fetchData() {
    try {
        const response = await fetch('/api/prayers');
        
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Update State
        appState.prayers = data.prayers;
        appState.nextPrayer = data.nextPrayer;
        appState.meta = data.meta;
        appState.error = false;
        
        // Update UI State
        els.loading.classList.add('hidden');
        updateOfflineStatus(false);
        
        console.log('State updated:', appState);
        
        // Trigger generic render (Will be implemented in Task 7/8)
        if (typeof renderTable === 'function') renderTable();
        // Clock loop reads state directly
        
    } catch (error) {
        console.error('Fetch failed:', error);
        appState.error = true;
        updateOfflineStatus(true);
    }
}

/**
 * Toggle the Red Dot indicator
 * @param {boolean} isOffline 
 */
function updateOfflineStatus(isOffline) {
    if (isOffline) {
        els.status.classList.add('visible');
    } else {
        els.status.classList.remove('visible');
    }
}

const prayerIcons = {
    fajr: '🌙',
    dhuhr: '☀️',
    asr: '🌤️',
    maghrib: '🌅',
    isha: '🌌'
};

function renderTable() {
    if (!els.scheduleBody) return;
    
    // Clear
    els.scheduleBody.innerHTML = '';
    
    const prayers = appState.prayers;
    if (!prayers) return;
    
    // Use server time for comparison
    const now = DateTime.now().setZone(appState.meta.location);
    const prayerNames = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
    
    prayerNames.forEach(name => {
        const data = prayers[name];
        if (!data) return;
        
        const row = document.createElement('tr');
        const prayerTime = DateTime.fromISO(data.start).setZone(appState.meta.location);
        const iqamahTime = DateTime.fromISO(data.iqamah).setZone(appState.meta.location);
        
        // Passed logic: If prayerTime is before now (with 1 min buffer?)
        if (prayerTime < now) {
            row.classList.add('dimmed');
        }
        
        // Highlight logic
        if (appState.nextPrayer && 
            appState.nextPrayer.name === name && 
            !appState.nextPrayer.isTomorrow) {
            row.classList.remove('dimmed'); // Ensure next prayer is not dimmed if close
            row.classList.add('highlight');
        }
        
        // Cells
        const nameCell = document.createElement('td');
        // Icon + Name
        nameCell.innerHTML = `<span class="icon">${prayerIcons[name] || ''}</span> ${name.charAt(0).toUpperCase() + name.slice(1)}`;
        
        const startCell = document.createElement('td');
        startCell.textContent = prayerTime.toFormat('HH:mm');
        
        const iqamahCell = document.createElement('td');
        iqamahCell.textContent = iqamahTime.toFormat('HH:mm');
        
        row.appendChild(nameCell);
        row.appendChild(startCell);
        row.appendChild(iqamahCell);
        
        els.scheduleBody.appendChild(row);
    });
}

/**
 * Update Clock and Countdown
 */
function updateClock() {
    if (!appState.meta.location) return;

    // Current Time in Server Timezone
    const now = DateTime.now().setZone(appState.meta.location);
    
    // Update Digital Clock
    if (els.digitalClock) els.digitalClock.textContent = now.toFormat('HH:mm:ss');
    if (els.dateDisplay) els.dateDisplay.textContent = now.toFormat('cccc, d MMMM yyyy');

    // Update Countdown
    if (appState.nextPrayer && appState.nextPrayer.time) {
        const nextTime = DateTime.fromISO(appState.nextPrayer.time).setZone(appState.meta.location);
        const name = appState.nextPrayer.name;
        
        // Display Name
        if (els.nextName) els.nextName.textContent = name.charAt(0).toUpperCase() + name.slice(1);
        
        const diff = nextTime.diff(now, ['hours', 'minutes', 'seconds']);
        const secondsLeft = diff.as('seconds');
        
        if (secondsLeft <= 0) {
            els.countdown.textContent = "00:00:00";
            
            // Beep at exact 0 (approximate poll)
            // Just verify we didn't miss it by too much
            if (secondsLeft > -1.5) { 
                 playBeep();
                 // Delay fetch slightly to ensure backend has updated if logic matches
                 setTimeout(fetchData, 2000); 
            }
        } else {
            els.countdown.textContent = diff.toFormat('hh:mm:ss');
        }
    } else {
        if (els.nextName) els.nextName.textContent = "--";
        if (els.countdown) els.countdown.textContent = "--:--:--";
    }
}

let wakeLock = null;

async function initAdvancedFeatures() {
    // 1. Wake Lock
    const params = new URLSearchParams(window.location.search);
    if (params.get('alwaysOn') === 'true') {
        try {
            if ('wakeLock' in navigator) {
                wakeLock = await navigator.wakeLock.request('screen');
                console.log('Wake Lock active');
                
                document.addEventListener('visibilitychange', async () => {
                   if (wakeLock !== null && document.visibilityState === 'visible') {
                       wakeLock = await navigator.wakeLock.request('screen');
                   }
                });
            }
        } catch (err) {
            console.error(`Wake Lock failed: ${err.name}, ${err.message}`);
        }
    }

    // 2. Audio Interactions
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.addEventListener('click', enableAudio);
    }
}

function playBeep() {
    // Web Audio API Beep
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.type = 'sine';
        osc.frequency.value = 880; // A5
        gain.gain.value = 0.1;
        
        osc.start();
        setTimeout(() => {
            osc.stop();
            ctx.close();
        }, 500); // 0.5s beep
    } catch (e) {
        console.error('Audio play failed', e);
    }
}

// Start when content loaded
document.addEventListener('DOMContentLoaded', init);

/* Audio & Automation Logic (Task 8) */

function enableAudio() {
    const overlay = document.getElementById('interaction-overlay');
    if (overlay) overlay.style.display = 'none';
    
    // Unlock Audio Context
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
        const ctx = new AudioContext();
        ctx.resume();
    }
    
    startSSE();
}

function startSSE() {
    logMessage('Connecting to Event Stream...');
    const source = new EventSource('/api/logs');
    
    source.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log('SSE Event:', data);
            
            if (data.type === 'LOG') {
                logMessage(data.payload.message);
            } else if (data.type === 'AUDIO_PLAY') {
                playAudio(data.payload.url);
            }
        } catch (e) {
            console.error('SSE Parse Error', e);
        }
    };
    
    source.onerror = () => {
        logMessage('SSE Disconnected. Retrying...');
        source.close();
        setTimeout(startSSE, 5000);
    };
    
    source.onopen = () => {
        logMessage('System Connected.');
    };
}

function logMessage(msg) {
    const list = document.getElementById('logs-list');
    if (!list) return;
    
    const li = document.createElement('li');
    li.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    list.prepend(li);
    
    // Limit history
    if (list.children.length > 50) {
        list.removeChild(list.lastChild);
    }
}

function playAudio(url) {
    logMessage(`Playing Audio: ${url}`);
    const audio = new Audio(url);
    audio.play().catch(e => {
        console.error('Playback failed', e);
        logMessage(`Audio Error: ${e.message}`);
    });
}

