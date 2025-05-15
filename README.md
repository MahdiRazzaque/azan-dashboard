# Azan System

A Node.js application for managing and announcing prayer times using Alexa devices.

## Features

-   Real-time prayer time display
-   Automatic azan playback at prayer times
-   Prayer time announcements 15 minutes before each prayer
-   Comprehensive settings panel for prayer-specific configurations
-   Smart dependency management between azan and announcement features
-   Interactive configuration setup with validation
-   Test mode for verifying announcements
-   System logs for monitoring
-   Secure admin authentication

## Prerequisites

-   Node.js (version compatible with ES modules, e.g., v14.x, v16.x or higher)
-   npm (usually comes with Node.js)
-   MongoDB (running and accessible)

## Configuration

### Initial Setup

When you start the application for the first time, it will prompt you in the terminal to enter your myMasjid guildId. This ID will be validated against the myMasjid API to ensure it is correct. If validation fails, you will be prompted to enter it again until a valid ID is provided. This guildId is then stored in the MongoDB configuration.

### Prayer Times Source

The system supports two sources for prayer times, configured in MongoDB (see "MongoDB Configuration" below):

1.  **MyMasjid API** (Default):
    The application will use the `guildId` provided during initial setup to fetch times from MyMasjid.

2.  **Local File**:
    To use a local file, you would need to update the configuration in MongoDB to set `prayerData.source` to `"local"`.
    When using a local file:
    -   Create a `prayer_times.json` file in the root directory of the project.
    -   Use the MyMasjid API format for this file:
        ```json
        {
            "model": {
                "masjidDetails": {
                    "name": "Your Masjid Name",
                    "website": null,
                    "year": 2025 // Ensure this matches the current year
                },
                "salahTimings": [
                    {
                        "fajr": "06:04",
                        "shouruq": "08:09",
                        "zuhr": "12:14",
                        "asr": "14:14",
                        "maghrib": "16:01",
                        "isha": "17:25",
                        "day": 1,
                        "month": 1,
                        "iqamah_Fajr": "07:30",
                        "iqamah_Zuhr": "13:00",
                        "iqamah_Asr": "15:00",
                        "iqamah_Maghrib": "16:06",
                        "iqamah_Isha": "19:30"
                    }
                    // ... entries for all 365/366 days of the year
                ]
            }
        }
        ```
    -   **Requirements for local file:**
        -   Must be named `prayer_times.json`.
        -   Must be in the project's root directory.
        -   The `year` in `masjidDetails` must match the current year.
        -   Must contain entries for all days of the current year.
        -   Each day's entry must have all required prayer times (fajr, shouruq, zuhr, asr, maghrib, isha) and iqamah times.
        -   Times must be in 24-hour format (HH:mm).
        -   The system validates this file on first use. If valid, it adds a `"validated": true` flag within the JSON to speed up subsequent loads.

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# .env - Azan System Configuration
# Do NOT commit your actual .env file to version control.

# Admin Credentials
ADMIN_USERNAME=your_username

# Password Security
# Generate a password hash using: node src/utils/generate-password-hash.js
ADMIN_PASSWORD_HASH=your_generated_password_hash
# IMPORTANT: If you change SALT after setup, your password hash will no longer work!
SALT=your_strong_random_salt_string

# Voice Monkey API Token (for Alexa announcements)
VOICEMONKEY_TOKEN=your_voicemonkey_api_token

# MongoDB Connection String (optional, defaults to mongodb://localhost:27017/azan_app)
MONGODB_URI=mongodb://user:pass@host:port/database_name

# Server Port (optional, defaults to 3002 if not set)
PORT=3000
```

To generate a password hash, run the included utility from the project root:
```bash
node src/utils/generate-password-hash.js
```
Follow the prompts, and then copy the generated hash into your `.env` file for `ADMIN_PASSWORD_HASH`.

### MongoDB Configuration

The system automatically manages its primary configuration in a MongoDB collection named `configs`. On first run, if no configuration exists, it will create a default one after prompting for the `myMasjid.guildId`.

An example of the full configuration document stored in MongoDB (managed by the application):
```json
{
    "_id": "...", // MongoDB ObjectId
    "prayerData": {
        "source": "mymasjid", // or "local"
        "mymasjid": {
            "guildId": "your-validated-guild-id-from-initial-setup"
        }
    },
    "features": {
        "azanEnabled": true,
        "announcementEnabled": true,
        "systemLogsEnabled": true
    },
    "auth": {
        "sessionTimeout": 3600000, // 1 hour in ms
        "maxSessions": 5
    },
    "prayerSettings": {
        "prayers": {
            "fajr": { "azanEnabled": false, "announcementEnabled": false, "azanAtIqamah": true },
            "zuhr": { "azanEnabled": true, "announcementEnabled": false, "azanAtIqamah": true },
            "asr": { "azanEnabled": true, "announcementEnabled": true, "azanAtIqamah": false },
            "maghrib": { "azanEnabled": true, "announcementEnabled": true, "azanAtIqamah": false },
            "isha": { "azanEnabled": true, "announcementEnabled": true, "azanAtIqamah": true }
        },
        "globalAzanEnabled": true,
        "globalAnnouncementEnabled": true
    },
    "updatedAt": "..." // Date of last update
}
```
You typically interact with these settings via the application's web UI rather than directly modifying the database.

## Installation

1.  Clone the repository:
    ```bash
    git clone <repository_url>
    cd azan
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Create and populate your `.env` file as described in "Environment Variables".
4.  If you plan to use a local prayer times file immediately, create `prayer_times.json` in the root directory.
5.  Start the server:
    ```bash
    npm start
    ```
    (This will run `node index.js` by default).
6.  On the first run, follow the interactive setup process in your terminal to enter and validate your myMasjid guildId.

## Usage

1.  Access the web interface at `http://localhost:PORT` (e.g., `http://localhost:3000` if you set `PORT=3000` in `.env`, or `http://localhost:3002` if `PORT` is not set).
2.  Log in using your admin credentials (from `.env`).
3.  Access the settings panel by clicking the settings icon (cogwheel) in the System Logs section.
4.  Configure global and prayer-specific settings:
    -   Enable/disable azan globally or for specific prayers.
    -   Enable/disable announcements globally or for specific prayers.
    -   Set azan timing to play at prayer start or iqamah time for each prayer.
5.  Use the toggles to enable/disable azan and announcements.
6.  Monitor system logs for any issues or system events.

### Settings Panel

The settings panel provides fine-grained control over the azan system:

-   **Global Settings**:
    -   **Global Azan Toggle**: Enable/disable all azan playback.
    -   **Global Announcement Toggle**: Enable/disable all prayer announcements.
-   **Prayer-Specific Settings**:
    -   Individual controls for each prayer (Fajr, Zuhr, Asr, Maghrib, Isha).
    -   Enable/disable azan for specific prayers.
    -   Choose azan timing (prayer start or iqamah time).
    -   Enable/disable announcements for specific prayers.
-   **Dependency Logic**:
    -   Announcement features depend on azan being enabled (either globally or for the specific prayer).
    -   When global azan is disabled, all prayer-specific azan and announcement settings are effectively disabled.
    -   When a prayer's azan is disabled, its announcement is automatically disabled.
    -   Settings generally remember their state when re-enabled.

## Test Mode

Test mode allows you to verify announcements and prayer timings by simulating a specific start time:

1.  Edit `src/utils/utils.js`.
2.  Set `const TEST_MODE = true;`.
3.  Adjust `TEST_START_TIME` (e.g., `moment.tz('02:00:00', 'HH:mm:ss', 'Europe/London')`) to the desired simulation start time.
4.  Restart the server.
5.  The system will operate as if the current time initiated from your `TEST_START_TIME`. Remember to set `TEST_MODE = false;` for normal operation.

## Security

-   Admin authentication required for all control features (settings, log clearing).
-   Session-based authentication with configurable timeout (via MongoDB config, default 1 hour).
-   Secure password hashing using PBKDF2 and a unique `SALT`.
-   Rate limiting on authentication endpoints to prevent brute-force attacks.

## Key API Endpoints

The application exposes several API endpoints, primarily consumed by the frontend:

-   `/api/prayer-times`: (GET) Get current prayer times, next prayer, and countdown.
-   `/api/prayer-settings`: (GET, POST) Manage prayer configurations. (Auth required for POST)
-   `/api/features`: (GET, POST) Manage global feature flags. (Auth required for POST)
-   `/api/config`: (GET, POST) Manage parts of the main application configuration (e.g., features, prayerSettings). (Auth required)
-   `/api/logs/stream`: (GET) Server-Sent Events (SSE) for real-time system logs.
-   `/api/logs`: (GET) Retrieve all stored logs.
-   `/api/logs/clear`: (POST) Clear logs. (Auth required)
-   `/api/logs/last-error`: (GET) Retrieve the last recorded error log.
-   `/api/auth/login`: (POST) User login.
-   `/api/auth/logout`: (POST) User logout. (Auth required)
-   `/api/auth/status`: (GET) Check current authentication status.
-   `/api/test-mode`: (GET) Get current test mode configuration (read-only from `utils.js`).

## Troubleshooting

-   **Check system logs** in the web UI for detailed error messages or operational information.
-   **Verify `.env` file:** Ensure all required environment variables are correctly set.
-   **MongoDB Connection:** Confirm MongoDB is running and accessible with the provided `MONGODB_URI`.
-   **Prayer Times Source:** Double-check your prayer times source. If using "local", ensure `prayer_times.json` is correctly formatted, in the root directory, and for the current year.
-   **VoiceMonkey Token:** Ensure `VOICEMONKEY_TOKEN` is valid for Alexa announcements.
-   **MyMasjid guildId:** If MyMasjid API is used, ensure the `guildId` (entered during initial setup and stored in MongoDB) is correct. You can test the MyMasjid API URL directly in a browser: `https://time.my-masjid.com/api/TimingsInfoScreen/GetMasjidTimings?GuidId=YOUR_GUILD_ID`.
-   **Port Conflicts:** If the server fails to start, check if the configured port (default 3002 or from `.env`) is already in use.