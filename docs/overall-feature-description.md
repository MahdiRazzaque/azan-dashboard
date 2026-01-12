### Overall Codebase Description
The codebase represents a robust, Node.js-based digital dashboard and automation system designed for managing Islamic prayer times (Salah). Its primary architecture consists of an Express.js backend API that handles data fetching, calculation, and scheduling, coupled with a responsive, vanilla JavaScript frontend for display and configuration. The system serves two main purposes: acting as a visual information display (digital signage) showing current and upcoming prayer times, and functioning as a smart automation controller that triggers external audio announcements (Azan) via Alexa devices using the VoiceMonkey API. The application emphasises reliability through local caching, automated configuration backups, and a comprehensive setup wizard for initial deployment.

### Feature Specification

Prayer Time Calculation & Data Sources - Core logic for retrieving and processing accurate prayer schedules
 - Multi-Source Data Retrieval - Supports fetching schedules from the MyMasjid API (using Guild IDs) or calculating times via the Aladhan API based on geolocation.
 - Aladhan Parametrisation - Offers granular control over calculation methods, Asr juristic methods (Shafi'i/Hanafi), and high-latitude adjustments.
 - Iqamah Time Calculation - automatically calculates the congregation (Iqamah) time by applying configurable minute-based offsets to the start of the prayer.
 - Smart Rounding Logic - Implements specific rounding rules for Iqamah times (e.g. rounding to the nearest 15 minutes) based on the specific prayer type.
 - Data Validation & Caching - Validates fetched data against a strict schema and caches it locally to ensure system resilience during network outages.

Automation & Smart Home Integration - Scheduling logic for audio playback and external device control
 - Precise Job Scheduling - Utilises an internal scheduler to trigger events exactly at prayer start times or calculated announcement times.
 - VoiceMonkey Integration - Connects with the VoiceMonkey API to trigger routines and play MP3 files (Azan) on Alexa-enabled devices.
 - Pre-Prayer Announcements - Capable of scheduling reminder announcements a fixed duration before the Iqamah or prayer start time.
 - Granular Toggle Controls - Allows administrators to enable or disable Azan and announcements globally or on a per-prayer basis (e.g. disable Fajr audio only).
 - Event Debouncing - Includes logic to prevent duplicate audio triggers within short timeframes.

Dashboard & Visual Interface - The client-side display for end-users
 - Real-Time Countdown - Displays a live clock and a dynamic countdown timer indicating the time remaining until the next prayer.
 - Dynamic Schedule Table - Renders a daily timetable showing both the start time and Iqamah time for all five prayers and sunrise.
 - Visual Status Indicators - Highlights the next upcoming prayer and visually dims prayers that have already passed for the day.
 - Responsive Design - Adapts the layout for various screen sizes, ensuring readability on mobile devices, tablets, and large digital signage screens.
 - Live System Logs - Provides a real-time, scrolling console view of server activities, errors, and scheduling events directly within the browser.

Configuration & Administration - Tools for system setup and ongoing management
 - Interactive Setup Wizard - Detects missing configuration on startup and guides the user through source selection and location setup via a modal interface.
 - Admin Settings Panel - A secured UI allowing modification of prayer sources, offsets, and feature toggles without editing configuration files manually.
 - Configuration Backups - Automatically creates backups of configuration and data files before applying major setting changes to prevent data loss.
 - Hot-Reloading - Capable of refreshing prayer data and rescheduling timers immediately after configuration changes without requiring a full server restart.

Security & System Health - Features ensuring secure access and operational stability
 - PBKDF2 Authentication - Protects administrative routes and the settings panel using secure password hashing with salt.
 - Session Management - Manages administrative sessions with timeout logic and concurrent session limits.
 - Rate Limiting - Implements request limiting on login endpoints to prevent brute-force attacks.
 - Server-Sent Events (SSE) Logging - Streams server-side logs to the client in real-time for easier debugging and monitoring.
 - Test Mode - Includes a simulation mode allowing developers to offset system time to test scheduling logic and UI responses at different times of day.