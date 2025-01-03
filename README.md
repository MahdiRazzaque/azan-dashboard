# Azan Dashboard

## Overview

This project is a Node.js application designed to automate the playing of the Islamic call to prayer (Azan) at the correct times based on a specific mosque's timings. It features a web interface for monitoring and control, along with integrations for playing the Azan through various devices.

## Main Features

- **Prayer Time Management**
  - Fetches daily prayer timings from the "time.my-masjid.com" API
  - Displays current time, next prayer, and countdown
  - Shows prayer start times and Iqamah times in a clean interface
  - Automatically schedules next day's timings at midnight

- **Azan and Announcements**
  - Plays Azan through Amazon Alexa devices at prayer times
  - Optional 15-minute advance announcements before prayers
  - Different Azan audio for Fajr prayer
  - Toggleable Azan and announcement features

- **System Management**
  - Secure authentication system for administrative controls
  - Real-time system logs with automatic updates
  - Clear logs functionality with confirmation
  - Test mode for timing verification
  - Error tracking and display

## Setup Instructions

1. **Clone the repository:**
   ```bash
   git clone <repository_url>
   cd azan-dashboard
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configuration:**

   a. Create a `config.json` file using the example:
   ```bash
   cp config.example.json config.json
   ```
   Edit `config.json` and set:
   - `GuidId`: Your mosque's ID from my-masjid.com
   - Other settings as needed

   b. Create a `.env` file using the example:
   ```bash
   cp .env.example .env
   ```
   Set the following:
   - `ADMIN_USERNAME`: Admin username for the dashboard
   - `ADMIN_PASSWORD_HASH`: Generated password hash (see below)
   - `SALT`: Random salt for password security
   - `VOICEMONKEY_TOKEN`: Your Voice Monkey API token (for Alexa integration)

4. **Generate Password Hash:**
   ```bash
   node -e "console.log(require('crypto').createHash('sha256').update('YOUR_PASSWORD' + 'YOUR_SALT').digest('hex'))"
   ```
   Replace `YOUR_PASSWORD` with your chosen password and `YOUR_SALT` with your salt value.

## Usage

1. **Start the server:**
   ```bash
   node index.js
   ```

2. **Access the dashboard:**
   Open `http://localhost:3000` in your web browser

3. **Authentication:**
   - Use the configured admin credentials to access protected features
   - Session expires after 1 hour of inactivity

## Protected Features

The following features require authentication:
- Toggling Azan playback
- Toggling announcements
- Clearing system logs

## Technical Notes

- Built with Node.js and Express
- Uses WebSocket for real-time updates
- Implements secure session management
- Supports timezone handling for accurate timing
- Includes error handling and logging
- Mobile-responsive interface

## Security Features

- Password hashing with salt
- Session-based authentication
- Environment variable-based configuration
- Protected API endpoints
- Automatic session expiry