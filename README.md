# Azan Dashboard & Alexa Announcer

A modern, Node.js-based system for managing and announcing Islamic prayer times. It features a real-time web dashboard and integrates with Alexa devices via VoiceMonkey for automated Azan playback and prayer announcements.

![Dashboard Preview](https://snipboard.io/uOq7Jc.jpg)

## Key Features

*   **Dual Prayer Time Sources:** Choose between two data sources:
    *   **MyMasjid API:** Fetches a pre-set schedule directly from a specific mosque's MyMasjid account.
    *   **Aladhan API:** Dynamically calculates prayer times based on geographical coordinates and a wide range of calculation methods.
*   **Interactive Web-Based Setup:** A user-friendly, one-time setup wizard guides the administrator through the initial configuration process.
*   **Real-Time Dashboard:** Displays the current time, daily prayer schedule (start and iqamah times), and a live countdown to the next prayer.
*   **Automated Alexa Integration:** Plays the Azan and pre-prayer announcements automatically on configured Alexa devices using the VoiceMonkey service.
*   **Modular Settings Panel:** A secure, web-based admin panel to configure:
    *   The prayer time source and its specific parameters.
    *   Global and prayer-specific toggles for Azan and announcements.
    *   Azan timing (play at prayer start time or iqamah time).
*   **Real-Time System Logging:** A live log stream is available in the dashboard for monitoring application activity and troubleshooting.
*   **Secure Authentication:** The settings panel and administrative functions are protected by a secure login system with session management and rate limiting.
*   **Robust Configuration Management:** All settings are stored in a local `config.json` file, which is managed by the application. The system intelligently handles configuration changes, backups, and data refreshes.
*   **Test Mode:** A built-in test mode for developers to simulate different times of the day to verify scheduling and UI behavior without waiting.

## Technology Stack

*   **Backend:** Node.js, Express.js
*   **Frontend:** Vanilla JavaScript (ES Modules), HTML5, CSS3
*   **Scheduling:** `node-schedule`
*   **Date/Time:** `moment-timezone`
*   **Persistence:** Local file system (JSON files: `config.json`, `prayer_times.json`)
*   **In-Memory Storage:** For active user sessions and temporary logs.
*   **Key Libraries & Tools:**
    *   `dotenv` for environment variables.
    *   `node-fetch` for HTTP requests.
    *   `express-rate-limit` for security.
    *   `pm2` for production process management (development dependency).
*   **External Services:**
    *   MyMasjid API (for prayer times)
    *   Aladhan API (for prayer times calculation)
    *   VoiceMonkey API (for Alexa announcements)

## Prerequisites

*   Node.js (v16.x or higher recommended)
*   npm (included with Node.js)
*   A VoiceMonkey account and API token.

## Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/MahdiRazzaque/azan
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Configure Environment Variables:**
    Create a `.env` file in the project root by copying `.env.example`. See the **Configuration** section below for details on how to populate it.

4.  **Start the application:**
    ```bash
    npm start
    ```
    For production environments, it is highly recommended to use a process manager like PM2:
    ```bash
    pm2 start index.js --name azan-dashboard
    ```

## Configuration

The application uses two primary configuration mechanisms: environment variables for sensitive data and dynamic application settings managed via the web UI.

### 1. Environment Variables (`.env`)

This file stores secrets and crucial operational variables. **It must NOT be committed to version control.**

```env
# .env - Azan System Configuration

# Admin Credentials
# Username for accessing protected features in the web UI.
ADMIN_USERNAME=admin

# Password Security
# The application uses PBKDF2 for secure password hashing.
# Generate a password hash by running the provided utility.
# Copy the generated hash here.
ADMIN_PASSWORD_HASH=your_generated_pbkdf2_hash

# You MUST set a SALT value for password hashing security.
# This should be a strong, random string of characters (e.g., 16-32 random hex characters).
# IMPORTANT: If you change this SALT after setting up your password,
# your existing ADMIN_PASSWORD_HASH will no longer work, and you'll need to regenerate it!
SALT=a_very_strong_and_random_salt_string_here

# Voice Monkey API Token
# Required for azan and prayer announcement playback via Alexa.
# Register at https://voicemonkey.io to get your API token.
VOICEMONKEY_TOKEN=your_voicemonkey_api_token

# Server Port (Optional)
# Port for the web server to listen on. If not specified, defaults to 3002.
PORT=3000

# Test Mode Configuration (Optional)
# Set to 'true' to enable test mode. This simulates time, bypasses auth, and skips actual VoiceMonkey calls.
TEST_MODE=false
```

**To generate your `ADMIN_PASSWORD_HASH`:**
From the project root, run the following command:
```bash
node src/utils/generate-password-hash.js
```

Follow the prompts, then copy the output hash into your `.env` file.

### 2. Application Settings (`config.json`)

This file holds all other application configurations (prayer data source, feature toggles, prayer-specific settings, etc.). It is located in the project root and is **automatically created and updated by the application through the web UI.**

**DO NOT MANUALLY EDIT `config.json`**. Changes should always be made via the dashboard's settings panel to ensure data integrity and proper application behavior.

## Initial Setup & Usage Workflow

1.  **Start the Application:**
    *   Run `npm start` (or `pm2 start index.js --name azan-dashboard`).
    *   Observe the terminal for initial log messages.

2.  **Access the Dashboard:**
    *   Open your web browser and navigate to `http://localhost:PORT` (e.g., `http://localhost:3000` if you set `PORT=3000` in `.env`, or `http://localhost:3002` by default).

3.  **Initial Setup Wizard:**
    *   If `config.json` is missing or invalid, a "Welcome to Azan Dashboard" modal will appear.
    *   **Choose your prayer time source:**
        *   **MyMasjid API:** Enter your mosque's Guild ID. The system will validate it against the MyMasjid API.
        *   **Aladhan API:** Provide your geographical `latitude`, `longitude`, `timezone`, and select your preferred `calculation method`, `Asr juristic method`, `midnight mode`, and `Iqamah offsets`.
    *   Click "Submit". The application will automatically:
        *   Create `config.json` with your chosen settings.
        *   Fetch the entire year's prayer times from the selected API.
        *   Save the fetched data to `prayer_times.json`.
        *   Initialize the prayer scheduling system.
    *   The page will then reload, and the dashboard will populate with prayer times.

4.  **Admin Dashboard Interaction:**
    *   The main dashboard displays the current time, the daily prayer schedule (Start and Iqamah times), and a live countdown to the next prayer.
    *   **System Logs:** Click the "Show System Logs" button to reveal a real-time log stream for monitoring application activity.

5.  **Using the Settings Panel:**
    *   Click the **cog icon** (<i class="fas fa-cog"></i>) in the System Logs panel to open the settings modal.
    *   You will be prompted to log in using the `ADMIN_USERNAME` and `ADMIN_PASSWORD` you configured in your `.env` file.
    *   **Prayer Time Source Tab:**
        *   Change your prayer source (MyMasjid or Aladhan).
        *   Update specific parameters for the chosen source (e.g., Guild ID, coordinates, calculation methods).
        *   The system will automatically validate and, if successful, fetch new prayer data and reschedule events.
    *   **Azan & Announcements Tab:**
        *   Control global Azan and Announcement features with dedicated toggles.
        *   Configure each of the five daily prayers individually:
            *   Enable/disable Azan for a specific prayer.
            *   Choose whether Azan plays at the prayer's start time or Iqamah time.
            *   Enable/disable announcements for a specific prayer.
        *   **Dependency Logic:** Announcements for a specific prayer are only active if Azan for that same prayer is enabled. Global toggles override individual prayer settings.

## Test Mode

Test mode allows developers to simulate different times of the day for testing scheduling and UI behavior without waiting for actual prayer times.

1.  **Enable Test Mode:**
    *   In your `.env` file, set `TEST_MODE=true`.
    *   Optionally, set `TEST_START_TIME` (e.g., `02:00:00`) and `TEST_TIMEZONE` (e.g., `Europe/London`).
    *   Restart the application.

2.  **Observe Test Mode:**
    *   A "🧪 Test Mode" indicator will appear in the top-right corner of the web UI.
    *   The application will operate as if the current time is offset from your `TEST_START_TIME`.
    *   **Authentication Bypass:** When `TEST_MODE` is `true`, the settings panel can be accessed without providing credentials, simplifying testing.
    *   **Simulated Playback:** VoiceMonkey calls for Azan and announcements will be logged in the system logs but **not actually sent to Alexa devices.**

3.  **Disable Test Mode:**
    *   Set `TEST_MODE=false` in your `.env` file and restart the application.

## Troubleshooting

*   **Check System Logs:** The primary tool for debugging. The live log stream in the web UI provides detailed error messages and operational information.
*   **Verify `.env` file:** Double-check that all required environment variables (`ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `SALT`, `VOICEMONKEY_TOKEN`) are correctly set.
*   **`config.json` Issues:** If the application continuously prompts for setup or throws configuration errors, it might be due to a corrupt or invalid `config.json`. **Do not edit it manually.** Try deleting `config.json` (and `prayer_times.json` if it exists) from the project root. The application will then re-run the web-based setup wizard on the next restart.
*   **Prayer Data Fetching:** If prayer times are not displayed, ensure your selected prayer source parameters in the settings panel are correct and validated.
    *   **MyMasjid `guildId`:** You can test the MyMasjid API URL directly in a browser: `https://time.my-masjid.com/api/TimingsInfoScreen/GetMasjidTimings?GuidId=YOUR_GUILD_ID`.
    *   **Aladhan Parameters:** Verify `latitude`, `longitude`, and `timezone` are accurate.
*   **VoiceMonkey Token:** Ensure your `VOICEMONKEY_TOKEN` is valid and active in your VoiceMonkey account.
*   **Port Conflicts:** If the server fails to start, the configured port (default 3002 or from `.env`) might be in use. Change the `PORT` in your `.env` file.
*   **Application Restart:** After making changes to `.env` or if the application crashes, always restart the Node.js process.