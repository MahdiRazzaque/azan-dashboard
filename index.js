import moment from 'moment-timezone';
import fetch from 'node-fetch';
import schedule from 'node-schedule';
import { config } from 'dotenv';
config();

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

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

    if (allPassed) {
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

// Start the scheduling
scheduleNamazTimers();