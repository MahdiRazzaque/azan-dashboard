const moment = require('moment-timezone');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const schedule = require('node-schedule');
//const { playAzan } = require("./tuya.js");
require('dotenv').config();
const { config } = require('dotenv');

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

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
            console.log("No timings found for today.");
            return null;
        }
    } catch (error) {
        console.log("Error fetching data:", error);
        return null;
    }
}

async function sendDiscordMessage(message) {
    const currentTime = `\`${moment.tz('Europe/London').format('YYYY-MM-DD HH:mm:ss')}\``;
    
    await fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message.toString() /*+ `\n${currentTime}`*/ }),
    });
}

async function scheduleNextDay() {
    console.log("======================================");
    console.log("All today's prayer times have passed. Scheduling for the next day.");
    const nextDay = moment.tz('Europe/London').add(1, 'day').startOf('day').add(2, 'hours');
    console.log(`Next date/time: ${nextDay.format('HH:mm:ss DD-MM-YYYY')}`);
    sendDiscordMessage(
        `\`\`\`fix` + `\n` + 
        `All today's prayer times have passed. Scheduling for the next day.`+ `\n\n` +
        `Next update: ${nextDay.format('HH:mm:ss DD-MM-YYYY')}` + `\n` +
        `\`\`\``
    );
    
    schedule.scheduleJob(nextDay.toDate(), async() => {
        console.log("Fetching next day's namaz timings.");
        await scheduleNamazTimers();
    });
}

async function sendPrayerTimes(prayerTimes) {
    const currentTime = `\`${moment.tz('Europe/London').format('YYYY-MM-DD HH:mm:ss')}\``;

    prayerListing = "# __**Prayer timings**__ \n\n"
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
        console.log("Could not fetch today's timings.");
        return;
    }

    const prayerTimes = {
        fajr: timings.iqamah_Fajr,
        zuhr: timings.iqamah_Zuhr,
        asr: timings.iqamah_Asr,
        maghrib: timings.maghrib,
        isha: timings.iqamah_Isha,
    };

    sendPrayerTimes(prayerTimes);

    console.log("======================================");
    console.log(Object.entries(prayerTimes).map(([name, time]) => `${name}: ${time}`).join('\n'));
    console.log("======================================");

    const now = moment.tz('Europe/London');

    console.log(`Current date/time: ${now.format('HH:mm:ss DD-MM-YYYY')}`);
    console.log("======================================");

    let allPassed = true;

    Object.entries(prayerTimes).forEach(([prayerName, time]) => {
        const [hour, minute] = time.split(':').map(Number);

        const prayerTime = moment.tz('Europe/London');
        prayerTime.set({ hour, minute, second: 0 });

        if (prayerTime > now) {
            allPassed = false;
            console.log(`Scheduling ${prayerName} prayer at ${time}`);
            schedule.scheduleJob(prayerTime.toDate(), async () => {
                await sendDiscordMessage(`# It's time for ${prayerName} prayer.`);
                //await playAzan();
                if (prayerName === 'fajr') {
                    await playAzanAlexa(true);
                } else {
                    await playAzanAlexa(false);
                }
                console.log("Azan played.")

                console.log(`${prayerName} prayer time.`);

                if (prayerName === 'isha') {
                    await scheduleNextDay();
                }

            });
        } else {
            console.log(`${prayerName} prayer time has already passed.`);
        }
    });

    if (allPassed) {
        await scheduleNextDay();
    }
    
    console.log("======================================");
}

async function playAzanAlexa(isFajr = false) {
    const url = 'https://api-v2.voicemonkey.io/announcement';
    const baseAudioUrl = 'https://la-ilaha-illa-allah.netlify.app';
    
    // Get token from environment variables
    const voice_mokey_token = process.env.VOICEMONKEY_TOKEN;
    
    if (!voice_mokey_token) {
        console.error("Error: Voice Monkey API token is missing!");
        return;
    }

    const payload = {
        token: voice_mokey_token, 
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

scheduleNamazTimers();
