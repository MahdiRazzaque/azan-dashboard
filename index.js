import moment from 'moment-timezone';
import fetch from 'node-fetch';
import schedule from 'node-schedule';
import { config } from 'dotenv';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

// Store the latest prayer times in memory
let currentPrayerTimes = null;
let nextPrayer = null;

// Utility function for consistent logging
function logSection(title) {
    console.log('\n' + '='.repeat(40));
    console.log(`🕌 ${title.toUpperCase()} 🕌`);
    console.log('='.repeat(40));
}

// Utility function to log prayer times in a table
function logPrayerTimesTable(timings, title) {
    console.log(`\n${title}:`);
    console.table(
        Object.entries(timings).map(([name, time]) => ({
            'Prayer': name.charAt(0).toUpperCase() + name.slice(1),
            'Time': time
        }))
    );
}

async function fetchMasjidTimings() {
    try {
        const response = await fetch("https://time.my-masjid.com/api/TimingsInfoScreen/GetMasjidTimings?GuidId=03b8d82c-5b0e-4cb9-ad68-8c7e204cae00");
        const data = await response.json();
        const salahTimings = data.model.salahTimings;

        const today = moment.tz('Europe/London');
        const todayDay = today.date();
        const todayMonth = today.month() + 1;

        const todayTimings = salahTimings.filter(obj => obj.day === todayDay && obj.month === todayMonth);

        if (todayTimings.length > 0) {
            return todayTimings[0];
        } else {
            console.error("❌ No timings found for today.");
            return null;
        }
    } catch (error) {
        console.error("❌ Error fetching data:", error);
        return null;
    }
}

async function sendDiscordMessage(message) {
  
    await fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message.toString() }),
    });
}

async function scheduleNextDay() {
    logSection("Next Day Scheduling");
    const nextDay = moment.tz('Europe/London').add(1, 'day').startOf('day').add(2, 'hours');
    
    console.log(`📅 Next Update: ${nextDay.format('HH:mm:ss DD-MM-YYYY')}`);
    
    sendDiscordMessage(
        `\`\`\`fix` + `\n` + 
        `All today's prayer times have passed. Scheduling for the next day.`+ `\n\n` +
        `Next update: ${nextDay.format('HH:mm:ss DD-MM-YYYY')}` + `\n` +
        `\`\`\``
    );
    
    schedule.scheduleJob(nextDay.toDate(), async() => {
        console.log("🔄 Fetching next day's namaz timings.");
        await scheduleNamazTimers();
    });
}

async function sendPrayerTimes(prayerTimes) {
    const currentTime = `\`${moment.tz('Europe/London').format('YYYY-MM-DD HH:mm:ss')}\``;

    var prayerListing = "# __**Prayer timings**__ \n\n"
    for(var [name, time] of Object.entries(prayerTimes)) {
        name = name.charAt(0).toUpperCase() + name.slice(1)
        prayerListing += `**${name}**: ${time}\n`
    }

    prayerListing += `\n${currentTime}`;

    await sendDiscordMessage(prayerListing);
}

async function scheduleNamazTimers() {
    const timings = await fetchMasjidTimings();

    if (!timings) {
        console.error("❌ Could not fetch today's timings.");
        return;
    }

    const prayerTimes = {
        fajr: timings.iqamah_Fajr,
        zuhr: timings.iqamah_Zuhr,
        asr: timings.iqamah_Asr,
        maghrib: timings.maghrib,
        isha: timings.iqamah_Isha,
    };

    currentPrayerTimes = prayerTimes;
    updateNextPrayer();

    const prayerAnnouncementTimes = Object.entries(prayerTimes).reduce((acc, [prayerName, time]) => {
        const updatedTime = moment(time, 'HH:mm').subtract(15, 'minutes').format('HH:mm');
        acc[prayerName] = updatedTime; return acc; }, {});

    sendPrayerTimes(prayerTimes);

    logSection("Today's Prayer Iqamah Timings");
    logPrayerTimesTable(prayerTimes, "Iqamah Times");

    logSection("Today's Prayer Times");
    logPrayerTimesTable(prayerAnnouncementTimes, "Announcement Times");

    const now = moment.tz('Europe/London');
    console.log(`⏰ Current Date/Time: ${now.format('HH:mm:ss DD-MM-YYYY')}`);

    logSection("Scheduling Prayer Iqamah Times");
    await Promise.all(Object.entries(prayerTimes).map(([prayerName, time]) => 
        scheduleAzanTimer(prayerName, time)
    ));

    logSection("Scheduling Prayer Announcement Times");
    await Promise.all(Object.entries(prayerAnnouncementTimes).map(([prayerName, time]) => 
        scheduleAzanAnnouncementTimer(prayerName, time)
    ));
}

async function scheduleAzanTimer(prayerName, time) {
    const [hour, minute] = time.split(':').map(Number);
    const now = moment.tz('Europe/London');

    const prayerTime = moment.tz('Europe/London');
    prayerTime.set({ hour, minute, second: 0 });

    let allPassed = true;

    if (prayerTime > now) {
        allPassed = false;
        console.log(`🕰️ Scheduling ${prayerName.toUpperCase()} prayer at ${time}`);
        schedule.scheduleJob(prayerTime.toDate(), async () => {
            await sendDiscordMessage(`# It's time for ${prayerName} prayer.`);
            //await playAzan();
            playAzanAlexa(prayerName === 'fajr');

            console.log("Azan played.")

            console.log(`${prayerName} prayer time.`);

            if (prayerName === 'isha') {
                await scheduleNextDay();
            }

        });
    } else {
        console.log(`⏩ ${prayerName.toUpperCase()} prayer time has already passed.`);
    }

    if (allPassed && prayerName === 'isha') {
        await scheduleNextDay();
    }
}

async function scheduleAzanAnnouncementTimer(prayerName, time) {
    const [hour, minute] = time.split(':').map(Number);
    const now = moment.tz('Europe/London');

    const prayerAnnouncementTime = moment.tz('Europe/London');
    prayerAnnouncementTime.set({ hour, minute, second: 0 });

    if(prayerAnnouncementTime < now) {
        console.log(`⏩ ${prayerName.toUpperCase()} prayer announcement time has already passed.`);
        return;
    }

    console.log(`📢 Scheduling ${prayerName.toUpperCase()} announcement at ${time}`);
    
    schedule.scheduleJob(prayerAnnouncementTime.toDate(), async () => {
        await playPrayerAnnoucement(prayerName);

        console.log(`📣 ${prayerName.toUpperCase()} announcement time.`);
    });
}

async function playAzanAlexa(isFajr = false) {
    const url = 'https://api-v2.voicemonkey.io/announcement';
    const baseAudioUrl = 'https://la-ilaha-illa-allah.netlify.app';
    
    const voice_monkey_token = process.env.VOICEMONKEY_TOKEN;
    
    if (!voice_monkey_token) {
        console.error("Error: Voice Monkey API token is missing!");
        return;
    }

    const payload = {
        token: voice_monkey_token, 
        device: 'voice-monkey-speaker-1',
        audio: baseAudioUrl + (isFajr ? '/mp3/fajr-azan.mp3' : '/mp3/azan.mp3'),
    };

    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('Azan triggered successfully:', data);
    })
    .catch(error => {
        console.error('Error triggering azan:', error);
    });
}

async function playPrayerAnnoucement(prayerName) {
    const prayerToAnnouncmentFile = {
        fajr: 't-minus-15-fajr.mp3',
        zuhr: 't-minus-15-dhuhr.mp3',
        asr: 't-minus-15-asr.mp3',
        maghrib: 't-minus-15-maghrib.mp3',
        isha: 't-minus-15-isha.mp3',
    };

    const url = 'https://api-v2.voicemonkey.io/announcement';
    const baseAudioUrl = 'https://la-ilaha-illa-allah.netlify.app/mp3/';

    const voice_monkey_token = process.env.VOICEMONKEY_TOKEN;
    
    if (!voice_monkey_token) {
        console.error("Error: Voice Monkey API token is missing!");
        return;
    }

    const payload = {
        token: voice_monkey_token, 
        device: 'voice-monkey-speaker-1',
        audio: baseAudioUrl + prayerToAnnouncmentFile[prayerName],
    };

    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('Azan announcment triggered successfully:', data);
    })
    .catch(error => {
        console.error('Error triggering azan announcment:', error);
    });
}

// Function to determine the next prayer
function updateNextPrayer() {
    if (!currentPrayerTimes) return;

    const now = moment.tz('Europe/London');
    let nextPrayerName = null;
    let nextPrayerTime = null;

    for (const [prayer, time] of Object.entries(currentPrayerTimes)) {
        const prayerTime = moment.tz(time, 'HH:mm', 'Europe/London');
        if (prayerTime.isAfter(now)) {
            nextPrayerName = prayer;
            nextPrayerTime = prayerTime;
            break;
        }
    }

    nextPrayer = nextPrayerName ? {
        name: nextPrayerName,
        time: nextPrayerTime.format('HH:mm'),
        countdown: moment.duration(nextPrayerTime.diff(now)).asMilliseconds()
    } : null;
}

// API Endpoints
app.get('/api/prayer-times', (req, res) => {
    res.json({
        prayerTimes: currentPrayerTimes,
        nextPrayer: nextPrayer,
        currentTime: moment.tz('Europe/London').format('HH:mm:ss')
    });
});

// Create a Set to store all active SSE clients
const clients = new Set();

// Store logs in memory
const logStore = {
    logs: [],
    errors: [],
    maxLogs: 1000, // Keep last 1000 logs
    
    addLog(type, message) {
        const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
        const logEntry = {
            type,
            message,
            timestamp
        };
        
        this.logs.push(logEntry);
        if (type === 'error') {
            this.errors.push(logEntry);
        }
        
        // Keep only last maxLogs entries
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }
        if (this.errors.length > this.maxLogs) {
            this.errors = this.errors.slice(-this.maxLogs);
        }
        
        return logEntry;
    },
    
    clear() {
        this.logs = [];
        this.errors = [];
        broadcastLogs({
            type: 'system',
            message: 'Logs cleared'
        });
    },
    
    getLast(n = 15) {
        return this.logs.slice(-n);
    },
    
    getLastError() {
        return this.errors[this.errors.length - 1];
    }
};

// Function to broadcast logs to all connected clients
function broadcastLogs(logData) {
    const deadClients = new Set();
    
    clients.forEach(client => {
        try {
            client.write(`data: ${JSON.stringify(logData)}\n\n`);
        } catch (error) {
            console.error('Error sending to client:', error.message);
            deadClients.add(client);
        }
    });
    
    // Cleanup dead clients
    deadClients.forEach(client => {
        clients.delete(client);
    });
}

// Override console.log to capture and broadcast logs
const originalConsoleLog = console.log;
console.log = function(...args) {
    originalConsoleLog.apply(console, args);
    const logMessage = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : arg.toString()
    ).join(' ');
    
    const logEntry = logStore.addLog('log', logMessage);
    broadcastLogs(logEntry);
};

// Override console.error to capture and broadcast errors
const originalConsoleError = console.error;
console.error = function(...args) {
    originalConsoleError.apply(console, args);
    const logMessage = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : arg.toString()
    ).join(' ');
    
    const logEntry = logStore.addLog('error', logMessage);
    broadcastLogs(logEntry);
};

// SSE endpoint for real-time logs
app.get('/api/logs/stream', async (req, res) => {
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Send initial heartbeat
    res.write('data: {"type":"connected","message":"Connected to log stream"}\n\n');
    
    // Send existing logs
    logStore.logs.forEach(log => {
        res.write(`data: ${JSON.stringify(log)}\n\n`);
    });
    
    // Add client to the Set
    clients.add(res);

    // Handle client disconnect
    req.on('close', () => {
        clients.delete(res);
        console.log('Client disconnected from log stream');
    });

    // Handle connection errors
    req.on('error', (error) => {
        console.error('Client connection error:', error.message);
        clients.delete(res);
        // Don't throw the error, just log it
        if (!res.headersSent) {
            res.status(500).end();
        }
    });

    // Handle response errors
    res.on('error', (error) => {
        console.error('Response error:', error.message);
        clients.delete(res);
        // Don't throw the error, just cleanup
        try {
            if (!res.headersSent) {
                res.status(500).end();
            }
        } catch (e) {
            console.error('Error while handling response error:', e.message);
        }
    });
});

// Add new API endpoints for log management
app.post('/api/logs/clear', (req, res) => {
    logStore.clear();
    res.json({ success: true });
});

app.get('/api/logs/last', (req, res) => {
    const count = parseInt(req.query.count) || 15;
    res.json(logStore.getLast(count));
});

app.get('/api/logs/last-error', (req, res) => {
    const lastError = logStore.getLastError();
    res.json(lastError || { type: 'info', message: 'No errors found' });
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the Express server
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Handle server errors
server.on('error', (error) => {
    console.error('Server error:', error.message);
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use`);
        process.exit(1);
    }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error.message);
    // Keep the process running unless it's a critical error
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Keep the process running unless it's a critical error
});

// Update next prayer info every minute
setInterval(updateNextPrayer, 60000);

// Start the scheduling
scheduleNamazTimers();
