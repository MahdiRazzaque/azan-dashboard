# Azan Dashboard & Alexa Announcer

A modern, Node.js-based system for managing and announcing Islamic prayer times. It features a real-time web dashboard and integrates with Alexa devices via VoiceMonkey for automated Azan playback and prayer announcements.

![Dashboard Preview](https://snipboard.io/uOq7Jc.jpg)

---

## 📚 Table of Contents

* [Key Features 🚀](#key-features-)
* [Installation 🛠️](#installation-)
* [Initial Setup & Usage ⚙️](#initial-setup--usage-workflow)
* [Configuration 🔧](#configuration-)
* [Test Mode 🧪](#test-mode-)
* [Troubleshooting 🐞](#troubleshooting-)
* [Technology Stack 🧱](#technology-stack-)
* [License 📄](#license)

---

## 🚀 Key Features

* **Dual Prayer Time Sources:**

  * **MyMasjid API:** Uses a fixed mosque schedule.
  * **Aladhan API:** Calculates times using location and method.
* **Interactive Setup Wizard:** Easy initial configuration via web UI.
* **Live Dashboard:** Current time, full schedule, countdown to next prayer.
* **Alexa Integration via VoiceMonkey:** Automated Azan and announcements.
* **Admin Panel:** Secure web-based configuration panel with session control.
* **Live Logging:** View system activity in real-time.
* **Test Mode:** Simulate different times of day for debugging.
* **Resilient Config Management:** Auto-handles changes and backups of settings.

---

## 🛠️ Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/MahdiRazzaque/azan
   ```
2. **Install dependencies:**

   ```bash
   npm install
   ```
3. **Configure Environment Variables:**
   Copy `.env.example` to `.env` and update required values (see [Configuration](#configuration-) for details).
4. **Start the application:**

   ```bash
   npm start
   ```

   Or in production:

   ```bash
   pm2 start index.js --name azan-dashboard
   ```

---

## ⚙️ Initial Setup & Usage Workflow

1. **Run the app:** `npm start` or with PM2.
2. **Visit:** `http://localhost:PORT` (defaults to 3002).
3. **Setup Wizard:**

   * Choose prayer source: MyMasjid (Guild ID) or Aladhan (location/calculation method).
   * System fetches and saves data to `prayer_times.json`.
   * `config.json` is created automatically.
4. **Dashboard:**

   * View current time, prayer times, countdown.
   * Show system logs in real-time.
5. **Settings Panel:**

   * Access with your admin credentials.
   * Configure Azan, announcements, timings, and toggles.

---

## 🔧 Configuration

The app uses two mechanisms: `.env` for sensitive data and `config.json` for app settings (UI-managed).

### 1. Environment Variables (`.env`)

<details>
<summary>Click to expand</summary>

```env
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

**Generate ADMIN\_PASSWORD\_HASH:**

```bash
node src/utils/generate-password-hash.js
```

</details>

### 2. Application Settings (`config.json`)

* Managed entirely via the dashboard.
* Auto-created and validated.
* **Do not edit manually.**

---

## 🧪 Test Mode

Simulates time to test UI and scheduling logic.

1. Set in `.env`:

   ```env
   TEST_MODE=true
   TEST_START_TIME=02:00:00
   TEST_TIMEZONE=Europe/London
   ```
2. Restart app. "🧪 Test Mode" badge appears.
3. Auth is disabled and Alexa playback is simulated.

To disable, set `TEST_MODE=false` and restart.

---

## 🐞 Troubleshooting

* **Logs:** Check web UI logs.
* **Environment Variables:** Ensure required `.env` values are set.
* **Corrupt Config:** Delete `config.json` and restart.
* **Prayer Times Missing:** Verify API parameters.

  * Test MyMasjid with: `https://time.my-masjid.com/api/TimingsInfoScreen/GetMasjidTimings?GuidId=YOUR_GUILD_ID`
* **VoiceMonkey Issues:** Confirm token is valid.
* **Port Conflict:** Change `PORT` in `.env` if needed.
* **Restart App** after any change.

---

## 🧱 Technology Stack

* **Backend:** Node.js, Express.js
* **Frontend:** Vanilla JS (ESM), HTML5, CSS3
* **Scheduling:** `node-schedule`
* **Date/Time:** `moment-timezone`
* **Persistence:** JSON files
* **Key Libraries:**

  * `dotenv`, `node-fetch`, `express-rate-limit`, `pm2`
* **External Services:**

  * MyMasjid API, Aladhan API, VoiceMonkey API

---

## 📄 License

This project is licensed under the MIT License.

---
