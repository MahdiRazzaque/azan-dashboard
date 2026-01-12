### Phase 0: Project Initialization
*The foundation required before any specific feature can be built.*

1.  **Project Skeleton & Server Setup**
    *   **Action:** Initialize `npm`, install Express.js, and create the basic directory structure (`/src`, `/public`, `/config`). Set up a basic HTTP server listening on a port.
    *   **Why:** You cannot serve an API or a Dashboard without a running web server.

### Phase 1: Data Layer (The "Brain")
*Goal: Get accurate prayer times into the system. Nothing else matters if the time is wrong.*

2.  **Multi-Source Data Retrieval & Validation**
    *   **Action:** Implement the `fetch` logic for MyMasjid and Aladhan APIs. Create the JSON schema validation to ensure the API response is readable.
    *   **Why:** This is the raw material. You need to verify you can actually get data from the outside world before processing it.
3.  **Data Caching System**
    *   **Action:** Implement logic to save the fetched JSON to a local file (`data/cache.json`) and read from it if the network fails.
    *   **Why:** **Critical for development.** Without this, you will hit API rate limits constantly while restarting your server to test the code below.
4.  **Aladhan Parametrisation**
    *   **Action:** Add logic to handle calculation methods, Juristic settings (Hanafi/Shafi'i), and latitude adjustments in the API request URL.
    *   **Why:** Ensures the data fetched in Step 2 is actually correct for the user's location.
5.  **Iqamah Calculation & Smart Rounding**
    *   **Action:** Implement the logic to take a prayer start time, add the user-defined offset (e.g., +10 mins), and apply rounding rules (e.g., round to next 15 mins).
    *   **Why:** This transforms "raw data" into "application data" ready for the display.

### Phase 2: Presentation Layer (The "Face")
*Goal: Visualize the data calculated in Phase 1.*

6.  **Dynamic Schedule Table**
    *   **Action:** Create the HTML/JS to fetch data from your local backend API and render the 5 prayers + sunrise in a table.
    *   **Why:** The primary user value is seeing the time. This validates that the backend is serving data correctly to the frontend.
7.  **Real-Time Countdown & Visual Status**
    *   **Action:** Implement the client-side clock. Add logic to compare "Now" vs "Next Prayer" to generate the countdown and dim passed rows in the table.
    *   **Why:** Transforms a static table into a "live" dashboard.
8.  **Responsive Design**
    *   **Action:** Apply CSS Media Queries to ensure the table and countdown look good on mobile and large screens.
    *   **Why:** Easier to style the elements now while they are fresh than to refactor the entire UI later.

### Phase 3: Automation Layer (The "Hands")
*Goal: Make the system act on the data.*

9.  **Precise Job Scheduling**
    *   **Action:** Implement the internal scheduler (e.g., using `node-schedule`) to parse today's prayer times and queue jobs in memory.
    *   **Why:** You need a trigger mechanism before you can fire an action.
10. **VoiceMonkey Integration & Debouncing**
    *   **Action:** Create the function to call the VoiceMonkey API. Wrap it in "Debounce" logic to ensure it never fires twice in a few seconds.
    *   **Why:** Connects the scheduler (Step 9) to the real world (Alexa). Debouncing is added now to protect your ears/wallet during testing.
11. **Granular Toggles & Pre-Prayer Announcements**
    *   **Action:** Add logic inside the scheduler to check configuration flags (e.g., `isFajrEnabled`) and calculate offsets for "15-minute warning" announcements.
    *   **Why:** Refines the automation to be usable in a real home environment (e.g., not waking kids up at Fajr).

### Phase 4: Administration & Infrastructure
*Goal: Remove hardcoded files and make the system robust.*

12. **Server-Sent Events (SSE) Logging**
    *   **Action:** Create a backend log stream and a frontend "console" div to display server logs in the browser.
    *   **Why:** Essential for debugging Phase 5. You need to see "Config Saved" or "Auth Failed" messages in the browser without looking at the server terminal.
13. **Admin Settings Panel & Hot-Reloading**
    *   **Action:** Build the UI form to edit the config file. Implement the backend logic to write to `config.json` and immediately trigger the "Fetch & Schedule" function (from Phase 1 & 3).
    *   **Why:** Allows changing prayer offsets or API sources without crashing or restarting the server.
14. **Configuration Backups**
    *   **Action:** Add a middleware that copies `config.json` to `config.bak` before the Admin Panel writes any changes.
    *   **Why:** Safety net. If the Admin Panel writes bad JSON, the system can recover.
15. **Interactive Setup Wizard**
    *   **Action:** Add a check on server boot: `if (!config.exists) showWizard()`.
    *   **Why:** The final polish for new deployments.

### Phase 5: Security & Testing (The "Shield")
*Goal: Secure the application and verify logic.*

16. **PBKDF2 Authentication & Session Management**
    *   **Action:** Implement login routes, hash passwords, and protect the `/admin` routes created in Step 13.
    *   **Why:** Do this last so you don't have to constantly log in/out while developing the Admin Panel.
17. **Rate Limiting**
    *   **Action:** Add middleware to limit repeated hits to the login route.
    *   **Why:** Prevents brute force attacks.
18. **Test Mode**
    *   **Action:** Create a mechanism to "fake" the system time in the Scheduler and Frontend.
    *   **Why:** Allows you to verify that the "Maghrib Azan" works at 10 AM, ensuring the system is reliable without waiting for the actual sun to set.