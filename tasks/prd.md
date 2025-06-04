# Azan Dashboard - Enhanced Prayer Time Source and Settings Configuration PRD

## 1. Introduction

### 1.1. Purpose
This document outlines the requirements for a new feature in the Azan Dashboard application. The feature will enhance the prayer time data sourcing capabilities by integrating an alternative calculation method using the Aladhan API, alongside the existing MyMasjid API integration. It also includes a significant redesign and enhancement of the settings dashboard to accommodate these new options and improve user configuration experience.

### 1.2. Feature Description
The core of this feature is to provide users with a choice for their prayer time data:
1.  **MyMasjid API:** Continue to support fetching prayer times from a specific mosque via its MyMasjid Guild ID.
2.  **Aladhan API:** Introduce the ability to calculate prayer times based on geographical coordinates (latitude/longitude) and various calculation parameters, using the Aladhan API.

This feature will also introduce a new web-based initial setup flow if no configuration exists, guiding users through the selection and setup of their preferred prayer time source. The existing settings dashboard will be revamped to allow users to switch between these sources post-setup and manage all related parameters, in addition to the existing Azan and announcement settings.

## 2. Product overview
The Azan Dashboard is a Node.js web application designed to display real-time prayer times and manage azan and prayer announcements, primarily via Alexa devices using the VoiceMonkey API. It currently fetches prayer times from the MyMasjid API and stores them locally. The application features a web interface for displaying prayer times and a settings panel for configuring application behaviours, including prayer-specific azan and announcement toggles. User access to settings is protected by admin authentication.

## 3. Goals and objectives

*   **Increase Flexibility:** Provide users with an alternative to the MyMasjid API, enabling prayer time calculations for locations or preferences not covered by available MyMasjid listings.
*   **Enhance User Control:** Allow users to define specific calculation parameters when using the Aladhan API, offering more tailored prayer times.
*   **Improve User Experience:** Streamline the initial setup process by moving it to a web-based interface, making it more accessible than the current terminal-based approach for `guildId`.
*   **Centralise Configuration:** Create a more comprehensive and user-friendly settings dashboard that consolidates all application settings, including prayer time source management and existing azan/announcement controls.
*   **Maintain Reliability:** Ensure that prayer times are fetched and stored efficiently at startup or upon configuration changes, providing consistent data to the application.

## 4. Target audience
*   **Primary Users:** Individuals or families using the Azan Dashboard in locations where their local mosque is not available on the MyMasjid API, or who prefer to use specific Islamic prayer time calculation methods and parameters.
*   **Existing Users:** Current users of the Azan Dashboard who may wish to switch to or experiment with an alternative prayer time calculation method.

## 5. Features and requirements

### 5.1. Initial Setup (Web-Based)
*   If `config.json` is not present on application start-up, the user interface (UI) will be overlaid with a modal prompting for initial setup. The rest of the dashboard will be inaccessible until setup is complete.
*   The setup modal will offer a choice between two prayer time sources:
    *   MyMasjid API
    *   Aladhan API
*   Clear explanations for each option will be provided within the UI (e.g., MyMasjid uses mosque-specific data; Aladhan uses geographical coordinates and calculation methods).
*   **MyMasjid Setup:**
    *   If selected, the user will be prompted to enter a MyMasjid `guildId`.
    *   The provided `guildId` will be validated by attempting to fetch data from the MyMasjid API.
    *   Upon successful validation, prayer times for the current year will be fetched and stored in `prayer_times.json`.
    *   The `guildId` and source type (`mymasjid`) will be saved in `config.json`.
*   **Aladhan Setup:**
    *   If selected, the user will be prompted to configure parameters necessary for the Aladhan API:
        *   Latitude (validated: -90 to 90)
        *   Longitude (validated: -180 to 180)
        *   Timezone (validated: valid IANA timezone name)
        *   Prayer Calculation Method (dropdown selection based on `prayer_calculator` constants)
        *   Asr Juristic Method (School) (dropdown selection)
        *   High Latitude Adjustment Method (dropdown selection, including "None")
        *   Midnight Mode (dropdown selection)
        *   Iqamah Offsets (integer inputs for Fajr, Zuhr, Asr, Maghrib, Isha in minutes)
    *   Client-side validation will be performed on input fields.
    *   Upon submission, prayer times for the current year will be fetched using the Aladhan API and the provided parameters.
    *   Iqamah times will be calculated based on the fetched Azan times and user-defined offsets, applying the rounding rules from `prayer_calculator.timeUtils.js`.
    *   The fetched/calculated data will be stored in `prayer_times.json`.
    *   All Aladhan parameters and source type (`aladhan`) will be saved in `config.json`.
*   A success message will be displayed upon completion, and the setup modal will close, granting access to the dashboard.
*   If API calls fail during setup (for either source), an error message will be displayed, prompting the user to check parameters or try again later. The setup will not complete until successful.

### 5.2. Enhanced Settings Dashboard
*   The existing settings dashboard will be redesigned with a tabbed or sectioned interface.
    *   One tab/section for "Prayer Time Source" settings.
    *   Another tab/section for existing "Azan and Announcement" settings (global toggles, prayer-specific toggles, azan timing).
*   **Prayer Time Source Management:**
    *   Users can switch between MyMasjid and Aladhan as the prayer time source.
    *   Dynamically display relevant configuration parameters based on the selected source.
        *   **MyMasjid:** Display current `guildId` and allow editing. Validation will occur upon saving.
        *   **Aladhan:** Display all current Aladhan parameters (latitude, longitude, timezone, methods, iqamah offsets, etc.) and allow editing. Input validation (dropdowns, range checks) will be applied.
    *   When switching sources or modifying parameters for the current source:
        *   A loading indicator (e.g., spinner) will be shown while new prayer times are fetched and processed.
        *   The application will attempt to fetch new prayer data for the *entire current year* using the new settings.
        *   If the fetch and processing are successful:
            *   The new `prayer_times.json` will be saved.
            *   The new configuration will be saved to `config.json`.
            *   A success message will be displayed.
            *   The scheduler will be updated with the new times.
        *   If the fetch fails (e.g., API error, invalid parameters):
            *   An error message will be displayed.
            *   The *previous* prayer time settings and `prayer_times.json` data will be retained. The new, problematic settings will *not* be saved to `config.json`.
    *   Previously configured parameters for an inactive source (e.g., Aladhan settings when MyMasjid is active) should be retained in `config.json` to allow easier switching back, but should not be actively used.

### 5.3. Prayer Time Data Handling (`prayer_times.json`)
*   A consolidated JSON schema will be used for `prayer_times.json`, regardless of the source.
*   **Root Structure:**
    ```json
    {
      "details": {
        "sourceApi": "mymasjid" | "aladhan", // Indicator of the source
        "year": YYYY, // Year of the prayer times
        // MyMasjid specific (if sourceApi is "mymasjid")
        "masjidName": "Name of Masjid",
        "guildId": "xxxx-xxxx-xxxx",
        // Aladhan specific (if sourceApi is "aladhan")
        "latitude": 0.0,
        "longitude": 0.0,
        "timezone": "IANA/Timezone",
        "calculationMethodId": 0, // ID from constants
        "calculationMethodName": "Method Name", // Descriptive name
        "asrJuristicMethodId": 0,
        "asrJuristicMethodName": "Method Name",
        // ... other Aladhan parameters used for calculation ...
      },
      "salahTimings": [
        {
          "day": 1,
          "month": 1,
          "fajr": "HH:MM",
          "shouruq": "HH:MM", // Sunrise
          "zuhr": "HH:MM",
          "asr": "HH:MM",
          "maghrib": "HH:MM",
          "isha": "HH:MM",
          "iqamah_fajr": "HH:MM",
          "iqamah_zuhr": "HH:MM",
          "iqamah_asr": "HH:MM",
          "iqamah_maghrib": "HH:MM",
          "iqamah_isha": "HH:MM"
        }
        // ... entries for all days of the year
      ],
      "validated": true // Flag indicating the file content is considered valid
    }
    ```
*   Data fetching for the entire year will occur at:
    *   Initial application start-up (after successful web-based setup if `config.json` was missing).
    *   Application start-up if `prayer_times.json` is missing or invalid (e.g., wrong year, `validated: false`).
    *   After a user successfully changes and saves prayer time source settings in the dashboard.
*   The `prayer_times.json` validation logic from `azan-dashboard` (checking year, structure, `validated` flag) will be adapted to support both data sources. If the file is invalid, it will be deleted and new data fetched based on `config.json`.

### 5.4. Backend Logic
*   Adapt `prayer-data-provider.js` to handle fetching/calculating from Aladhan API, including iqamah calculation using adapted logic from `prayer_calculator.timeUtils.js`.
*   Modify `config-service.js` to manage the new Aladhan-specific parameters in `config.json`.
*   The initial startup sequence in `server.js` will need to be adapted to trigger the web-based setup flow if `config.json` is missing, instead of the terminal-based one.

## 6. User stories and acceptance criteria

| ID      | User Story                                                                                                                               | Acceptance Criteria                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| :------ | :--------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ST-101  | As a new user, when I first run the application without a `config.json` file, I want to be prompted via a web UI modal to set up my prayer time source so that I can configure the dashboard easily. | - A modal is displayed over the main dashboard, making other content inaccessible.<br>- The modal clearly presents two choices: MyMasjid API or Aladhan API.<br>- Brief explanations are provided for each choice.                                                                                                                                                                                                                                                                                                                                                                                    |
| ST-102  | As a new user setting up with MyMasjid, I want to enter my mosque's `guildId` and have it validated so that I know I'm using the correct data source. | - The UI provides an input field for the `guildId`.<br>- On submission, the system attempts to fetch data using the `guildId`.<br>- If validation is successful, a confirmation is shown, `prayer_times.json` is populated, `config.json` is created with MyMasjid source and `guildId`, and the modal closes.<br>- If validation fails, an error message is shown, and the user can retry.                                                                                                                                                                                                                           |
| ST-103  | As a new user setting up with Aladhan, I want to input all necessary geographical and calculation parameters so that prayer times are calculated accurately for my location and preferences. | - The UI provides input fields/dropdowns for: latitude, longitude, timezone, calculation method, Asr juristic method, high latitude adjustment, midnight mode, and iqamah offsets for all 5 prayers.<br>- Inputs are validated client-side (e.g., ranges, formats).<br>- On submission, the system attempts to fetch data using these parameters.<br>- If successful, `prayer_times.json` is populated (including calculated iqamahs), `config.json` is created with Aladhan source and parameters, and the modal closes.<br>- If fetching fails, an error message is shown. |
| ST-104  | As an admin user, I want to access a "Prayer Time Source" settings area to view and change my current prayer time source (MyMasjid or Aladhan). | - A dedicated section/tab for "Prayer Time Source" is available in the settings dashboard.<br>- This section is accessible only after admin login.<br>- The UI clearly indicates the currently active source.<br>- Options to switch to the other source are present.                                                                                                                                                                                                                                                                                                                                                            |
| ST-105  | As an admin user, if MyMasjid is my active source, I want to be able to view and update the `guildId` in the settings.                        | - The current `guildId` is displayed.<br>- An input field allows modification of the `guildId`.<br>- On saving, the new `guildId` is validated.<br>- If valid, `config.json` is updated, new `prayer_times.json` is fetched, and a success message is shown with a loading indicator during the process.<br>- If invalid, an error is shown, and previous settings are retained.                                                                                                                                                                                                                                         |
| ST-106  | As an admin user, if Aladhan is my active source, I want to be able to view and update all Aladhan-specific parameters (location, methods, iqamah offsets). | - All current Aladhan parameters are displayed for editing.<br>- On saving, new parameters are used to fetch prayer times.<br>- If successful, `config.json` is updated, new `prayer_times.json` is fetched, and a success message is shown with a loading indicator.<br>- If fetching fails, an error is shown, and previous settings are retained.                                                                                                                                                                                                                                                               |
| ST-107  | As an admin user, when I switch prayer time sources (e.g., MyMasjid to Aladhan), I want the system to fetch data for the new source and update the application accordingly. | - When the source is switched, the UI prompts for necessary parameters for the new source (if not already configured).<br>- On saving, the system fetches data for the new source.<br>- `config.json` and `prayer_times.json` are updated.<br>- The dashboard reflects times from the new source.<br>- Previous settings for the newly *deactivated* source are retained in `config.json`.                                                                                                                                                                                                          |
| ST-108  | As an admin user, I want the "Azan and Announcement" settings tab to function as it currently does, allowing me to manage global and prayer-specific azan/announcement toggles and timings. | - The existing functionality for Azan and Announcement settings is preserved within its own tab/section.<br>- These settings are independent of the prayer time source chosen, but apply to the times fetched by that source.                                                                                                                                                                                                                                                                                                                                                                |
| ST-109  | As a system, when fetching data from either MyMasjid or Aladhan, I want the resulting `prayer_times.json` to conform to the specified consolidated schema. | - The `prayer_times.json` file includes a `details` object with `sourceApi`, `year`, and source-specific metadata.<br>- The `salahTimings` array contains daily prayer times (Fajr, Shouruq, Zuhr, Asr, Maghrib, Isha) and corresponding iqamah times (`iqamah_fajr`, etc.).<br>- A `validated: true` flag is present.                                                                                                                                                                                                                                                                        |
| ST-110  | As a system, when Aladhan API is used, I want Iqamah times to be calculated based on user-defined offsets from Azan times, applying specified rounding rules. | - For Fajr, Zuhr, Asr, Isha: Iqamah minutes are rounded to the nearest 0, 15, 30, or 45 based on the rules (e.g. 7.5 -> 15, 22.5 -> 30, 37.5 -> 45, 52.5 -> next hour 00).<br>- For Maghrib: Iqamah time is the Azan time plus the exact offset, with no rounding of minutes.                                                                                                                                                                                                                                                                                                     |
| ST-111  | As an admin user, I want my access to the enhanced settings dashboard (both prayer time source and azan/announcement settings) to be protected by the existing admin authentication. | - User must log in with admin credentials (`ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH` from `.env`) to access any part of the settings dashboard.<br>- Unauthenticated users attempting to access settings are denied.                                                                                                                                                                                                                                                                                                                                                               |
| ST-112  | As a system, when `config.json` is missing, I want the application to wait for web-based setup completion before fully initialising other services like the prayer scheduler. | - `scheduleNamazTimers` and other critical initialisations that depend on `config.json` or `prayer_times.json` are deferred until the web setup provides a valid configuration.                                                                                                                                                                                                                                                                                                                                                                                               |
| ST-113  | As a user, when the system is fetching/processing a full year of prayer times after a settings change, I want to see a loading indicator so I know the system is working. | - A visual loading spinner or message is displayed on the settings page when a save action triggers a full data refresh. <br>- The UI remains responsive or indicates that an operation is in progress.                                                                                                                                                                                                                                                                                                                                                                  |

## 7. Technical requirements / stack

*   **Backend:** Node.js, Express.js.
*   **Frontend:** HTML, CSS, Vanilla JavaScript.
*   **Configuration:**
    *   `config.json` will be extended to store:
        *   `prayerData.source`: "mymasjid" or "aladhan".
        *   `prayerData.mymasjid.guildId`: (existing).
        *   `prayerData.aladhan`: Object containing all Aladhan-specific parameters (latitude, longitude, timezone, calculationMethodId, asrJuristicMethodId, latitudeAdjustmentMethodId, midnightModeId, and iqamahOffsets object).
    *   `.env` for sensitive credentials (ADMIN_USERNAME, ADMIN_PASSWORD_HASH, SALT, VOICEMONKEY_TOKEN) remains unchanged.
*   **Data Storage:** `prayer_times.json` will store the annual prayer times in the new consolidated schema.
*   **API Interaction:**
    *   Continue using `node-fetch` or `axios` for MyMasjid API calls.
    *   Integrate `node-fetch` or `axios` for Aladhan API calls (referencing `prayer_calculator.apiClient.js`). The Aladhan endpoint `/v1/calendar/{year}` will be used.
*   **Module Integration:**
    *   Logic from `prayer_calculator.js` (specifically `apiClient.js`, `timeUtils.js`, and parts of `constants.js` related to Aladhan parameters and iqamah calculation) will be integrated into the `azan-dashboard/src/` directory. These might form new modules (e.g., `src/prayer/aladhan-provider.js`, `src/utils/time-calculator.js`) or be merged into existing ones.
    *   `src/prayer/prayer-data-provider.js` in `azan-dashboard` will be refactored to act as a facade, delegating to either MyMasjid-specific logic or the new Aladhan-specific logic based on `config.json`.
    *   `src/config/config-service.js` will need to handle the new Aladhan parameters and the modified initial setup flow.
    *   `src/server/server.js` initialisation logic will need to check for `config.json` and, if missing, ensure the Express app serves a page/modal for web-based setup before fully starting schedulers.
    *   The existing prayer scheduling logic in `src/scheduler/scheduler.js` will continue to use data from `prayer_times.json`, so it should largely remain unchanged once the data source provides times in the expected format.
*   **Error Handling:** Robust error handling for API calls, parameter validation, and file operations is required.
*   **Security:** Admin authentication (`src/auth/auth.js`) will protect all routes related to viewing and modifying settings.

## 8. Design and user interface
*   **Initial Setup Modal:**
    *   A clean, visually distinct modal overlaying the dashboard.
    *   Clear headings and instructions.
    *   Radio buttons or distinct clickable sections for choosing between "MyMasjid API" and "Aladhan API".
    *   Input fields for parameters will use appropriate HTML5 types (e.g., `number`, `text`).
    *   Dropdown menus (`<select>`) will be used for selecting Aladhan calculation methods, Asr method, latitude adjustment, and midnight mode, populated from constants.
    *   Standard buttons for "Save" / "Proceed" and "Cancel" (if applicable before completion).
*   **Enhanced Settings Dashboard:**
    *   A tabbed interface is preferred:
        *   Tab 1: "Prayer Time Source" (or similar) - Contains source selection (MyMasjid/Aladhan) and dynamic parameter fields for the selected source.
        *   Tab 2: "Azan & Announcements" (or similar) - Contains existing global and prayer-specific toggles.
    *   The UI should follow the existing theme and style of `public/styles.css` to maintain consistency.
    *   Visual feedback (e.g., success/error messages, loading spinners) should be provided for save operations.
    *   Form elements should be clearly labelled.
*   Detailed UI mockups or wireframes are not provided; implementation should follow standard web usability best practices.

## 9. Open questions / Assumptions made
*   **Assumption:** The existing admin authentication mechanism is sufficient for the new settings panel.
*   **Assumption:** The rounding rules for iqamah times as implemented in `prayer_calculator.timeUtils.js` are the desired rules for the Aladhan-sourced iqamah times.
*   **Assumption:** The `VOICEMONKEY_TOKEN` and related announcement functionality are not directly impacted by these changes, beyond relying on the prayer times from the updated `prayer_times.json`.
*   **Assumption:** The current frontend JavaScript (`public/app.js`) will be updated to correctly display prayer times and source details from the new `prayer_times.json` schema (specifically the `details` object). This PRD primarily focuses on backend and configuration changes but implies necessary frontend adaptations.