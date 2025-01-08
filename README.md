# Azan System

A Node.js application for managing and announcing prayer times using Alexa devices.

## Features

- Real-time prayer time display
- Automatic azan playback at prayer times
- Prayer time announcements 15 minutes before each prayer
- Test mode for verifying announcements
- System logs for monitoring
- Secure admin authentication

## Configuration

### Prayer Times Source

The system supports two sources for prayer times:

1. **MyMasjid API** (Default):
   ```json
   {
       "prayerData": {
           "source": "mymasjid",
           "mymasjid": {
               "guidId": "your-guid-id-here"
           }
       }
   }
   ```

2. **Local File**:
   ```json
   {
       "prayerData": {
           "source": "local"
       }
   }
   ```

   When using a local file:
   - Create a `prayer_times.json` file in the root directory
   - Use the MyMasjid API format:
   ```json
   {
       "model": {
           "masjidDetails": {
               "name": "Your Masjid Name",
               "website": null,
               "year": 2025
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
               // ... entries for all days of the year
           ]
       }
   }
   ```

   Requirements for local file:
   - Must be named `prayer_times.json`
   - Must be in the root directory
   - Year must match current year
   - Must contain entries for all days of the year
   - Each day must have all required prayer times
   - Times must be in 24-hour format (HH:mm)

### Environment Variables

Create a `.env` file in the root directory with:

```env
ADMIN_USERNAME=your_username
ADMIN_PASSWORD_HASH=your_password_hash
VOICEMONKEY_TOKEN=your_voicemonkey_token
```

### Features Configuration

In `config.json`:
```json
{
    "PORT": 3002,
    "features": {
        "azanEnabled": true,
        "announcementEnabled": true,
        "systemLogsEnabled": true
    },
    "testMode": {
        "enabled": false,
        "startTime": "02:00:00",
        "timezone": "Europe/London"
    },
    "auth": {
        "sessionTimeout": 3600000,
        "maxSessions": 5
    }
}
```

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create `.env` file with required variables
4. Create or modify `config.json` with your settings
5. If using local prayer times, create `prayer_times.json`
6. Start the server:
   ```bash
   npm start
   ```

## Usage

1. Access the web interface at `http://localhost:3002` (or your configured port)
2. Log in using your admin credentials
3. Use the toggles to enable/disable azan and announcements
4. Monitor system logs for any issues

## Test Mode

Test mode allows you to verify announcements by setting a specific time:

1. Enable test mode in config.json
2. Set the desired test time
3. Restart the server
4. The system will use the test time instead of actual time

## Security

- Admin authentication required for all control features
- Session-based authentication with configurable timeout
- Secure password hashing
- Rate limiting on authentication endpoints

## Troubleshooting

- Check system logs for detailed error messages
- Verify prayer times source configuration
- Ensure all required environment variables are set
- Check file permissions for local prayer times file
- Verify network connectivity for MyMasjid API