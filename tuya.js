const axios = require('axios');
require('dotenv').config();
const { config } = require('dotenv');

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
    //const token = "EUv051h8362463ceu171921999509907XvbZJdjm5mD8v";
    console.log(token);

    const response = await switchOn(token);
    console.log(response);
}

module.exports = {
    playAzan,
};

