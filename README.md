# Azan Script

## Overview

This project is a Node.js application designed to automate the playing of the Islamic call to prayer (Azan) at the correct times based on the user's location and a specific mosque's timings. It utilises the `moment-timezone` library to handle time calculations, `node-schedule` to schedule tasks, and optionally integrates with external services like Discord for notifications, Voice Monkey API, and Tuya Smart devices for playing the Azan.

## Main Features

-   **Fetches Prayer Timings:** Retrieves daily prayer timings from the "time.my-masjid.com" API for a specific mosque.
-   **Schedules Azan:** Schedules the playing of the Azan for each prayer time (Fajr, Zuhr, Asr, Maghrib, Isha) using `node-schedule`.
-   **Discord Notifications:** Sends notifications to a Discord channel about prayer times and scheduling updates via a webhook.
-   **Voice Monkey Integration:** Plays the Azan through Amazon Alexa devices at the scheduled times via the Voice Monkey API.
-   **Tuya Smart Device Integration (Optional):** Optionally integrates with Tuya smart devices to trigger actions like turning on a speaker for the Azan.
-   **Error Handling:** Includes error handling for API requests and scheduling, with logging to the console and optional Discord notifications.
-   **Automatic Rescheduling:** If all prayer times for the day have passed, it automatically reschedules for the next day.

## Setup Instructions

1. **Clone the repository:**

    ```bash
    git clone <repository_url>
    cd <repository_name>
    ```

2. **Install dependencies:**

    ```bash
    npm install
    ```

3. **Environment Variables:**

    Create a `.env` file in the root directory and set the following environment variables:

    ```
    DISCORD_WEBHOOK_URL=<Your_Discord_Webhook_URL>
    VOICEMONKEY_TOKEN=<Your_Voice_Monkey_API_Token>
    user_name=<Your_Tuya_Username> (Optional for Tuya integration)
    password=<Your_Tuya_Password> (Optional for Tuya integration)
    ```
    -   `DISCORD_WEBHOOK_URL`: The URL of your Discord webhook for sending notifications.
    -   `VOICEMONKEY_TOKEN`: Your Voice Monkey API token for triggering Azan on Alexa devices.
    -   `user_name`, `password`: (Optional) Your Tuya Smart Life app credentials if you intend to use Tuya device integration.

## Usage

### Running the script

You can run the script directly using Node.js:

```bash
node index.js
```

### Functionality Breakdown and Notes

- **Functionality Breakdown:**

  - **`fetchMasjidTimings()`:** Fetches prayer timings from the specified mosque's API.
  - **`sendDiscordMessage(message)`:** Sends a message to the configured Discord channel.
  - **`scheduleNextDay()`:** Schedules the script to run again the next day at 2 AM.
  - **`sendPrayerTimes(prayerTimes)`:** Sends the formatted prayer times for the day to the Discord channel.
  - **`scheduleNamazTimers()`:** The main function that fetches timings, sends them to Discord, and schedules the Azan playing for each prayer.
  - **`playAzanAlexa(isFajr)`:** Triggers the Azan on Alexa devices through the Voice Monkey API. The `isFajr` parameter determines whether to play the Fajr Azan or the regular Azan.
  - **`playAzan()` (in `tuya.js`)**: (Optional) Turns on a Tuya smart device, potentially a speaker, to play the Azan.
  - **`getAccessToken()` (in `tuya.js`)**: (Optional) Retrieves an access token for Tuya API calls.
  - **`switchOn(token)` (in `tuya.js`)**: (Optional) Sends a command to turn on a Tuya device.

- **Notes:**

  - The script is designed to be run continuously and will automatically reschedule itself for the next day after Isha prayer.
  - The Azan audio files are assumed to be hosted at `https://la-ilaha-illa-allah.netlify.app/mp3/azan.mp3` and `https://la-ilaha-illa-allah.netlify.app/mp3/fajr-azan.mp3`.
  - The Tuya integration is optional and requires setting the appropriate environment variables.
  - Ensure that the Voice Monkey API token and device name are correctly configured for Alexa integration to function properly.