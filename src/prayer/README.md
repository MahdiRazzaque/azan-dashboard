# Prayer Module

This module handles prayer time calculations, data fetching, and related utilities for the Azan Dashboard application.

## Constants Module

The `constants.js` file provides a centralized location for all prayer calculation-related constants used throughout the application. It imports constants from the Aladhan module and re-exports them along with utility functions for dropdown population.

### Available Constants

- `CALCULATION_METHODS`: Different calculation methods for prayer times (e.g., Muslim World League, ISNA, etc.)
- `ASR_JURISTIC_METHODS`: Methods for calculating Asr time (Shafi'i/Standard or Hanafi)
- `LATITUDE_ADJUSTMENT_METHODS`: Methods for adjusting prayer times in high latitudes
- `MIDNIGHT_MODES`: Methods for calculating midnight (Standard or Jafari)
- `IQAMAH_PRAYERS`: List of prayers for which iqamah times are calculated

### Utility Functions

- `getDropdownOptions(constantsObj)`: Converts constants objects to array format for dropdown population
- Pre-formatted dropdown options:
  - `CALCULATION_METHOD_OPTIONS`
  - `ASR_JURISTIC_METHOD_OPTIONS` 
  - `MIDNIGHT_MODE_OPTIONS`
  - `LATITUDE_ADJUSTMENT_METHOD_OPTIONS` (includes special "None" option)
- `DEFAULT_ALADHAN_CONFIG`: Default values for new Aladhan configurations

### API Routes

The `constants-routes.js` file provides API endpoints for accessing these constants from the frontend:

- `GET /api/prayer/constants/calculation-methods`: Get calculation method options
- `GET /api/prayer/constants/asr-methods`: Get Asr juristic method options
- `GET /api/prayer/constants/latitude-adjustments`: Get latitude adjustment method options
- `GET /api/prayer/constants/midnight-modes`: Get midnight mode options
- `GET /api/prayer/constants/default-config`: Get default Aladhan configuration
- `GET /api/prayer/constants/all`: Get all constants in a single request

### Validation

The `validate-constants.js` script tests all constants against the Aladhan API to ensure they match the expected values. Run this validation using:

```
node tasks/validate-aladhan-constants.js
```

## Frontend Usage

The constants are used in the frontend via the `public/js/dropdown-utils.js` module, which provides functions for populating dropdown elements with options from the API:

- `populateDropdown(selectId, options, selectedValue)`: Generic dropdown population
- `populateCalculationMethodDropdown(selectId, selectedValue)`: Populates calculation method dropdown
- `populateAsrJuristicMethodDropdown(selectId, selectedValue)`: Populates Asr method dropdown
- `populateLatitudeAdjustmentMethodDropdown(selectId, selectedValue)`: Populates latitude adjustment dropdown
- `populateMidnightModeDropdown(selectId, selectedValue)`: Populates midnight mode dropdown
- `populateAllAladhanDropdowns(config)`: Populates all dropdowns at once with current config values 