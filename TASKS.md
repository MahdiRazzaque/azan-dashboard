# Project Tasks

## Task 1: Project Setup and Dependencies
- **Status:** done
- **Priority:** high
- **Dependencies:** []
- **Description:** Install and configure necessary dependencies for Aladhan API integration
- **Details:**
Install node-fetch or axios for API calls to Aladhan API. Review and adapt code from prayer_calculator module for integration. Set up any additional dependencies needed for the enhanced settings dashboard and modal interface.
- **Test Strategy:**
Verify all dependencies are installed correctly and application starts without errors. Test API connectivity to both MyMasjid and Aladhan endpoints.
- **Subtasks:**
  - 1.1: Install HTTP client library (node-fetch/axios) - **Status:** done - **Dependencies:** []
  - 1.2: Review prayer_calculator module structure - **Status:** done - **Dependencies:** []
  - 1.3: Identify reusable components from prayer_calculator - **Status:** done - **Dependencies:** [1.2]

## Task 2: Configuration Schema Extension
- **Status:** done
- **Priority:** high
- **Dependencies:** []
- **Description:** Extend config.json schema to support both MyMasjid and Aladhan prayer time sources
- **Details:**
Update the configuration structure to include prayerData.source field and prayerData.aladhan object with all necessary Aladhan parameters (latitude, longitude, timezone, calculationMethodId, asrJuristicMethodId, latitudeAdjustmentMethodId, midnightModeId, iqamahOffsets). Ensure backward compatibility with existing MyMasjid configurations.
- **Test Strategy:**
Test configuration loading with both old and new config formats. Verify all Aladhan parameters are properly stored and retrieved.
- **Subtasks:**
  - 2.1: Define extended config.json schema - **Status:** done - **Dependencies:** []
  - 2.2: Update config-service.js to handle new schema - **Status:** done - **Dependencies:** [2.1]
  - 2.3: Add validation for Aladhan parameters - **Status:** done - **Dependencies:** [2.2]
  - 2.4: Test backward compatibility with existing configs - **Status:** done - **Dependencies:** [2.2]

## Task 3: Prayer Times JSON Schema Consolidation
- **Status:** done
- **Priority:** high
- **Dependencies:** []
- **Description:** Create consolidated prayer_times.json schema to support both MyMasjid and Aladhan data sources
- **Details:**
Design and implement a unified prayer_times.json structure with details object containing sourceApi, year, and source-specific metadata. Include salahTimings array with daily prayer and iqamah times. Add validated flag for file integrity checking.
- **Test Strategy:**
Verify schema works with data from both sources. Test file validation logic correctly identifies valid/invalid files.
- **Subtasks:**
  - 3.1: Design consolidated JSON schema - **Status:** done - **Dependencies:** []
  - 3.2: Update prayer times validation logic - **Status:** done - **Dependencies:** [3.1]
  - 3.3: Test schema with real API data from both sources - **Status:** pending - **Dependencies:** [3.2]

## Task 4: Aladhan API Integration
- **Status:** done
- **Priority:** high
- **Dependencies:** [1, 2, 3]
- **Description:** Integrate Aladhan API for prayer time calculation based on geographical coordinates
- **Details:**
Adapt logic from prayer_calculator.apiClient.js to fetch annual prayer times from Aladhan API /v1/calendar/{year} endpoint. Implement parameter handling for calculation methods, location coordinates, and timezone. Handle API responses and transform to consolidated schema format.
- **Test Strategy:**
Test API calls with various parameter combinations. Verify correct data transformation to prayer_times.json format. Test error handling for API failures.
- **Subtasks:**
  - 4.1: Create aladhan-provider.js module - **Status:** done - **Dependencies:** [1, 2, 3]
  - 4.2: Implement calendar data fetching - **Status:** done - **Dependencies:** [4.1]
  - 4.3: Add parameter validation and error handling - **Status:** done - **Dependencies:** [4.2]
  - 4.4: Transform API response to consolidated format - **Status:** done - **Dependencies:** [4.2]

## Task 5: Iqamah Time Calculation
- **Status:** done
- **Priority:** medium
- **Dependencies:** [4]
- **Description:** Implement iqamah time calculation with rounding rules for Aladhan-sourced times
- **Details:**
Adapt timeUtils.js logic from prayer_calculator to calculate iqamah times from azan times plus user-defined offsets. Implement rounding rules: for Fajr/Zuhr/Asr/Isha round to nearest 0,15,30,45 minutes; for Maghrib use exact offset without rounding.
- **Test Strategy:**
Test iqamah calculations with various offset values. Verify rounding rules are applied correctly for each prayer. Test edge cases around midnight transitions.
- **Subtasks:**
  - 5.1: Create time-calculator utility module - **Status:** done - **Dependencies:** [4]
  - 5.2: Implement iqamah offset calculation - **Status:** done - **Dependencies:** [5.1]
  - 5.3: Apply rounding rules for different prayers - **Status:** done - **Dependencies:** [5.2]
  - 5.4: Test edge cases and time transitions - **Status:** done - **Dependencies:** [5.3]

## Task 6: Prayer Data Provider Refactoring
- **Status:** done
- **Priority:** high
- **Dependencies:** [4, 5]
- **Description:** Refactor prayer-data-provider.js to act as facade for both MyMasjid and Aladhan sources
- **Details:**
Update prayer-data-provider.js to delegate to appropriate source handler based on config.json source setting. Ensure consistent interface regardless of underlying source. Handle data fetching at startup and configuration changes.
- **Test Strategy:**
Test data provider correctly routes to MyMasjid or Aladhan based on configuration. Verify consistent output format from both sources. Test switching between sources.
- **Subtasks:**
  - 6.1: Create source delegation logic - **Status:** done - **Dependencies:** [4, 5]
  - 6.2: Maintain consistent interface for both sources - **Status:** done - **Dependencies:** [6.1]
  - 6.3: Handle configuration change triggers - **Status:** done - **Dependencies:** [6.2]
  - 6.4: Test source switching functionality - **Status:** done - **Dependencies:** [6.3]

## Task 7: Initial Setup Modal UI
- **Status:** done
- **Priority:** high
- **Dependencies:** [2]
- **Description:** Create web-based initial setup modal for first-time configuration
- **Details:**
Build modal overlay that appears when config.json is missing. Provide clear choice between MyMasjid and Aladhan APIs with explanations. Include input forms for each source type with appropriate validation. Handle setup completion and modal closure.
- **Test Strategy:**
Test modal appears correctly on missing config. Verify form validation works for both source types. Test successful setup completion and modal dismissal.
- **Subtasks:**
  - 7.1: Create modal HTML structure and styling - **Status:** done - **Dependencies:** [2]
  - 7.2: Add source selection interface - **Status:** done - **Dependencies:** [7.1]
  - 7.3: Build MyMasjid setup form - **Status:** done - **Dependencies:** [7.2]
  - 7.4: Build Aladhan setup form with parameter inputs - **Status:** done - **Dependencies:** [7.2]
  - 7.5: Implement client-side form validation - **Status:** done - **Dependencies:** [7.3, 7.4]
  - 7.6: Handle setup submission and completion - **Status:** done - **Dependencies:** [7.5]

## Task 8: Enhanced Settings Dashboard UI
- **Status:** pending
- **Priority:** high
- **Dependencies:** [6, 7]
- **Description:** Redesign settings dashboard with tabbed interface for prayer source and azan settings
- **Details:**
Create tabbed interface with "Prayer Time Source" and "Azan & Announcements" sections. Implement dynamic parameter display based on selected source. Add loading indicators for save operations. Maintain existing styling consistency.
- **Test Strategy:**
Test tab switching functionality. Verify dynamic parameter display. Test save operations with loading feedback. Ensure existing azan settings remain functional.
- **Subtasks:**
  - 8.1: Create tabbed interface structure - **Status:** done - **Dependencies:** [6, 7]
  - 8.2: Build Prayer Time Source tab - **Status:** done - **Dependencies:** [8.1]
  - 8.3: Migrate existing Azan settings to separate tab - **Status:** done - **Dependencies:** [8.1]
  - 8.4: Implement dynamic parameter forms - **Status:** done - **Dependencies:** [8.2]
  - 8.5: Add loading indicators and feedback - **Status:** done - **Dependencies:** [8.4]
  - 8.6: Test source switching in settings - **Status:** done - **Dependencies:** [8.5]

## Task 9: Backend API Routes for Settings
- **Status:** done
- **Priority:** high
- **Dependencies:** [6, 8]
- **Description:** Create/update API routes for saving and retrieving prayer time source settings
- **Details:**
Implement endpoints for saving prayer time source configurations. Handle validation of parameters before saving. Trigger prayer data refresh after successful configuration changes. Maintain admin authentication protection.
- **Test Strategy:**
Test API endpoints with valid and invalid parameters. Verify admin authentication is enforced. Test configuration save and data refresh workflow.
- **Subtasks:**
  - 9.1: Create prayer source configuration endpoints - **Status:** done - **Dependencies:** [6, 8]
  - 9.2: Implement parameter validation on server side - **Status:** done - **Dependencies:** [9.1]
  - 9.3: Add configuration save and data refresh logic - **Status:** done - **Dependencies:** [9.2]
  - 9.4: Ensure admin authentication protection - **Status:** done - **Dependencies:** [9.3]

## Task 10: Server Initialization Logic Update
- **Status:** done
- **Priority:** medium
- **Dependencies:** [7, 9]
- **Description:** Update server startup to handle missing config.json and defer scheduler initialization
- **Details:**
Modify server.js to detect missing config.json and serve setup modal instead of failing. Defer prayer scheduler and other config-dependent initializations until setup completion. Ensure graceful handling of missing or invalid configuration files.
- **Test Strategy:**
Test server startup with missing config.json. Verify setup modal is served correctly. Test scheduler initialization after setup completion.
- **Subtasks:**
  - 10.1: Add config.json existence check at startup - **Status:** done - **Dependencies:** [7, 9]
  - 10.2: Defer scheduler initialization - **Status:** done - **Dependencies:** [10.1]
  - 10.3: Handle invalid prayer_times.json files - **Status:** done - **Dependencies:** [10.2]
  - 10.4: Test complete initialization flow - **Status:** done - **Dependencies:** [10.3]

## Task 11: Frontend Prayer Display Updates
- **Status:** done
- **Priority:** medium
- **Dependencies:** [3, 6]
- **Description:** Update frontend to display prayer times and source information from new schema
- **Details:**
Modify public/app.js to read and display prayer times from the new consolidated prayer_times.json format. Show source information (MyMasjid mosque name or Aladhan location details) in the UI. Ensure proper handling of both azan and iqamah times.
- **Test Strategy:**
Test prayer time display with data from both sources. Verify source information is shown correctly. Test proper formatting of times and dates.
- **Subtasks:**
  - 11.1: Update prayer time reading logic - **Status:** done - **Dependencies:** [3, 6]
  - 11.2: Add source information display - **Status:** done - **Dependencies:** [11.1]
  - 11.3: Handle iqamah time display - **Status:** done - **Dependencies:** [11.2]
  - 11.4: Test with both data sources - **Status:** done - **Dependencies:** [11.3]

## Task 12: Constants and Dropdown Data
- **Status:** done
- **Priority:** medium
- **Dependencies:** [1]
- **Description:** Adapt constants from prayer_calculator for Aladhan calculation methods and parameters
- **Details:**
Extract and adapt constants.js from prayer_calculator module for calculation methods, Asr juristic methods, latitude adjustment methods, and midnight modes. Ensure these are available for dropdown population in the UI.
- **Test Strategy:**
Verify all calculation method constants are correctly imported. Test dropdown population with constant values. Ensure method IDs match Aladhan API expectations.
- **Subtasks:**
  - 12.1: Extract calculation method constants - **Status:** done - **Dependencies:** [1]
  - 12.2: Create constants module for dashboard - **Status:** done - **Dependencies:** [12.1]
  - 12.3: Implement dropdown population logic - **Status:** done - **Dependencies:** [12.2]
  - 12.4: Validate constants against Aladhan API - **Status:** done - **Dependencies:** [12.3]

## Task 13: Error Handling and Validation
- **Status:** pending
- **Priority:** medium
- **Dependencies:** [4, 7, 8]
- **Description:** Implement comprehensive error handling for API calls and user input validation
- **Details:**
Add robust error handling for Aladhan and MyMasjid API failures. Implement client-side and server-side validation for all configuration parameters. Provide meaningful error messages to users. Handle network timeouts and API rate limits.
- **Test Strategy:**
Test error handling with invalid API responses. Verify validation catches incorrect parameter ranges. Test error message display in UI. Test network failure scenarios.
- **Subtasks:**
  - 13.1: Implement API error handling - **Status:** pending - **Dependencies:** [4]
  - 13.2: Add comprehensive parameter validation - **Status:** pending - **Dependencies:** [7, 8]
  - 13.3: Create user-friendly error messages - **Status:** pending - **Dependencies:** [13.2]
  - 13.4: Handle network and timeout errors - **Status:** pending - **Dependencies:** [13.1]

## Task 14: Testing and Quality Assurance
- **Status:** pending
- **Priority:** medium
- **Dependencies:** [11, 12, 13]
- **Description:** Comprehensive testing of all new features and integration points
- **Details:**
Test complete workflow from initial setup through configuration changes. Verify data integrity across source switches. Test edge cases like leap years, timezone changes, and API failures. Ensure backward compatibility with existing installations.
- **Test Strategy:**
Execute full user workflows for both new and existing users. Test all configuration combinations. Verify prayer times accuracy against known values. Test performance with full year data loads.
- **Subtasks:**
  - 14.1: Test initial setup workflows - **Status:** pending - **Dependencies:** [11, 12, 13]
  - 14.2: Test source switching functionality - **Status:** pending - **Dependencies:** [14.1]
  - 14.3: Test edge cases and error scenarios - **Status:** pending - **Dependencies:** [14.2]
  - 14.4: Verify backward compatibility - **Status:** pending - **Dependencies:** [14.3]
  - 14.5: Performance testing with annual data - **Status:** pending - **Dependencies:** [14.4]

## Task 15: Documentation Updates
- **Status:** pending
- **Priority:** low
- **Dependencies:** [14]
- **Description:** Update README and documentation to reflect new features and setup process
- **Details:**
Update README.md with new configuration options and setup instructions. Document Aladhan parameter meanings and recommended values. Add troubleshooting section for common setup issues. Update any existing documentation about configuration.
- **Test Strategy:**
Verify documentation matches actual implementation. Test setup instructions with fresh installation. Ensure troubleshooting guide covers observed issues.
- **Subtasks:**
  - 15.1: Update README with new features - **Status:** pending - **Dependencies:** [14]
  - 15.2: Document Aladhan parameters and usage - **Status:** pending - **Dependencies:** [15.1]
  - 15.3: Add troubleshooting guide - **Status:** pending - **Dependencies:** [15.2]
  - 15.4: Review and update existing documentation - **Status:** pending - **Dependencies:** [15.3]

## Task 16: Security Review and Authentication
- **Status:** done
- **Priority:** medium
- **Dependencies:** [9]
- **Description:** Ensure all new settings endpoints and features maintain proper admin authentication
- **Details:**
Review all new API endpoints to ensure admin authentication is properly enforced. Verify that sensitive configuration data is protected. Test authentication bypass attempts. Ensure setup modal is accessible without auth but settings modifications require authentication.
- **Test Strategy:**
Test all endpoints with and without valid authentication. Verify setup modal accessibility for new users. Test authentication enforcement on settings modifications.
- **Subtasks:**
  - 16.1: Review authentication on new endpoints - **Status:** done - **Dependencies:** [9]
  - 16.2: Test authentication bypass prevention - **Status:** done - **Dependencies:** [16.1]
  - 16.3: Verify setup modal accessibility - **Status:** done - **Dependencies:** [16.2]
  - 16.4: Security testing of configuration handling - **Status:** done - **Dependencies:** [16.3]