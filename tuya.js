const axios = require('axios');
require('dotenv').config();
const { config } = require('dotenv');
const moment = require('moment-timezone');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const DISCORD_WEBHOOK_URL = 'https://discordapp.com/api/webhooks/1253114538534899712/_5Zw9yavHyxgNfCneFLLVR3qOklfQi8lfRCNUK3VT64cFVZAGeSaxC7vtEbpxWBIhrDs';

async function sendDebugMessage(message) { 
    const currentDay = moment.tz('Europe/London');
    const nextDay = moment.tz('Europe/London').add(1, 'day').startOf('day').add(1, 'minute');
    
    const debugMessage = 
    //`\`\`\`` + `\n` +
    `# DEBUG` + `\n\n` +
    `\`\`\`diff` +`\n` +
     `${message}` + `\n` +
     `\`\`\`` + `\n` +
    `\`Current date/time: ${currentDay.format('HH:mm:ss DD-MM-YYYY')}\`` + `\n` +
    `\`Next date/time: ${nextDay.format('HH:mm:ss DD-MM-YYYY')}\`` + `\n`;
    //`\`\`\``;

    await fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: debugMessage }),
    });
}

// Get the access token
async function getAccessToken() {
    const base_url = "https://px1.tuyaeu.com";

    const auth_headers = {
        "Content-Type": "application/x-www-form-urlencoded"
    };

    const auth_payload = new URLSearchParams({
        "userName": process.env.user_name,
        "password": process.env.password,
        "countryCode": "uk",
        "from": "tuya",
    });
    const response = await axios.post(`${base_url}/homeassistant/auth.do`, auth_payload, { headers: auth_headers });

    //console.log(response.data);

    if(!response.data.access_token) 
        return "An error occurred while getting the access token."

    return response.data.access_token;
}

async function switchOn(token) {
    const base_url = "https://px1.tuyaeu.com";

    header = {
        "name": "turnOnOff",
        "namespace": "control",
        "payloadVersion": 1,
        }

    payload = {
        "devId": "vdevo171922040889662",
        "value": "1",
        "accessToken": token,
    }

    const data = { header, payload };
    
    try {
        const response = await axios.post(`${base_url}/homeassistant/skill`, data, { headers: { 'Content-Type': 'application/json' } });
        return response.data;
    } catch (error) {
        console.error(error);
    }
}

async function playAzan() {
    const token = await getAccessToken();
    //const token = "EUv051hf2210e54eu171921999509907XvbfiOQh2vwes";
    console.log(`Token: ${token}`);

    const response = await switchOn(token);
    
    try {
        if(response.header.code === "SUCCESS") {
            sendDebugMessage("+ Tuya switch turned on successfully.");
        } else {
            sendDebugMessage("- Tuya switch failed to turn on.");
        }
    } catch (e) {}
}

module.exports = {
    playAzan,
};

