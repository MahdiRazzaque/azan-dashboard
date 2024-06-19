// Dynamic imports for node-fetch and node-schedule
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const schedule = require('node-schedule');

// Discord webhook URL
const DISCORD_WEBHOOK_URL = 'https://discordapp.com/api/webhooks/1253114538534899712/_5Zw9yavHyxgNfCneFLLVR3qOklfQi8lfRCNUK3VT64cFVZAGeSaxC7vtEbpxWBIhrDs';

// Function to fetch namaz timings from the API
async function fetchMasjidTimings() {
    try {
        const response = await fetch("https://time.my-masjid.com/api/TimingsInfoScreen/GetMasjidTimings?GuidId=03b8d82c-5b0e-4cb9-ad68-8c7e204cae00");
        const data = await response.json();
        const salahTimings = data.model.salahTimings;

        // Get today's date
        const today = new Date();
        const todayDay = today.getDate();
        const todayMonth = today.getMonth() + 1;

        // Filter today's timings
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

// Function to send a message to a Discord webhook
async function sendDiscordMessage(message) {
    try {
        if(typeof message === 'object') {
            prayerListing = "# __**Prayer timings**__ \n\n"
            for(var [name, time] of Object.entries(message)) {
                name = name.charAt(0).toUpperCase() + name.slice(1)
                prayerListing += `**${name}**: ${time}\n`
            }
        }            

        await fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: typeof message === 'object' ? prayerListing : `It's time for ${message} prayer.` }),
        });
    } catch (error) {
        console.log("Error sending Discord message:", error);
    }
}

// Function to schedule namaz timers
async function scheduleNamazTimers() {
    const timings = await fetchMasjidTimings();

    if (!timings) {
        console.log("Could not fetch today's timings.");
        return;
    }

    const prayerTimes = {
        fajr: timings.fajr,
        zuhr: timings.zuhr,
        asr: timings.asr,
        maghrib: timings.maghrib,
        isha: timings.isha,
    };

    sendDiscordMessage(prayerTimes)

    console.log(prayerTimes)

    const now = new Date(); // Define 'now' at the beginning of the function

    let allPassed = true; // Flag to check if all prayer times have passed

    Object.entries(prayerTimes).forEach(([prayerName, time]) => {
        const [hour, minute] = time.split(':').map(Number);

        const prayerTime = new Date();
        prayerTime.setHours(hour);
        prayerTime.setMinutes(minute);
        prayerTime.setSeconds(0);

        if (prayerTime > now) {
            allPassed = false; // At least one prayer time is in the future
            console.log(`Scheduling ${prayerName} prayer at ${time}`);
            schedule.scheduleJob(prayerTime, async () => {
                await sendDiscordMessage(prayerName);
                console.log(`${prayerName} prayer time.`);

                if (prayerName === 'isha') {
                    // After Isha, fetch the next day's timings and schedule again
                    console.log("Fetching next day's namaz timings.");
                    await scheduleNamazTimers();
                }
            });
        } else {
            console.log(`${prayerName} prayer time has already passed.`);
        }
    });

    // If all prayer times have passed, schedule for the next day's timings
    if (allPassed) {
        console.log("All today's prayer times have passed. Scheduling for the next day.");
        const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 1, 0); // Set to one minute past midnight
        schedule.scheduleJob(nextDay, async () => {
            console.log("Fetching next day's namaz timings.");
            await scheduleNamazTimers();
        });
    }
}

// Start the process
scheduleNamazTimers();
