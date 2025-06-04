// configManager.js
import fs from 'fs';
import path from 'path';
import readlineSync from 'readline-sync';
import {
    CONFIG_FILE,
    CALCULATION_METHODS,
    ASR_JURISTIC_METHODS,
    LATITUDE_ADJUSTMENT_METHODS,
    MIDNIGHT_MODES,
    IQAMAH_PRAYERS
} from './constants.js';

function isValidTimeZone(tz) {
    if (!tz) return false;
    try {
        Intl.DateTimeFormat(undefined, { timeZone: tz });
        return true;
    } catch (ex) {
        return false;
    }
}

function solicitChoice(prompt, options, showKeys = true) {
    console.log(`\n${prompt}`);
    const keys = Object.keys(options);
    keys.forEach((key, index) => {
        console.log(`  ${index + 1}. ${options[key]}${showKeys ? ` (ID: ${key})` : ''}`);
    });
    let choiceIndex;
    while (true) {
        const input = readlineSync.question(`Enter your choice (1-${keys.length}): `);
        choiceIndex = parseInt(input, 10) - 1;
        if (choiceIndex >= 0 && choiceIndex < keys.length) {
            return keys[choiceIndex];
        }
        console.log("Invalid selection. Please try again.");
    }
}

export function setupConfig() {
    console.log("--- Prayer Time Calculator Configuration Setup ---");
    const config = {};

    config.latitude = readlineSync.questionFloat("Enter your latitude (e.g., 34.0522): ", {
        limitMessage: "Invalid latitude. Please enter a number between -90 and 90."
    });
    while (config.latitude < -90 || config.latitude > 90) {
        console.log("Latitude must be between -90 and 90.");
        config.latitude = readlineSync.questionFloat("Enter your latitude: ");
    }

    config.longitude = readlineSync.questionFloat("Enter your longitude (e.g., -118.2437): ", {
        limitMessage: "Invalid longitude. Please enter a number between -180 and 180."
    });
    while (config.longitude < -180 || config.longitude > 180) {
        console.log("Longitude must be between -180 and 180.");
        config.longitude = readlineSync.questionFloat("Enter your longitude: ");
    }
    
    config.timezone = readlineSync.question("Enter your timezone (e.g., America/Los_Angeles, Europe/London): ", {
        limit: isValidTimeZone,
        limitMessage: "Invalid timezone. Please enter a valid IANA timezone name."
    });

    config.calculationMethod = parseInt(solicitChoice("Select Prayer Calculation Method:", CALCULATION_METHODS), 10);
    
    config.asrJuristicMethod = parseInt(solicitChoice("Select Asr Juristic Method (School):", ASR_JURISTIC_METHODS), 10);

    const latAdjOptions = { ...LATITUDE_ADJUSTMENT_METHODS, "NONE": "None" };
    const latAdjChoice = solicitChoice("Select High Latitude Adjustment Method:", latAdjOptions);
    config.latitudeAdjustmentMethod = (latAdjChoice === "NONE") ? null : parseInt(latAdjChoice, 10);

    config.midnightMode = parseInt(solicitChoice("Select Midnight Mode:", MIDNIGHT_MODES), 10);

    console.log("\n--- Iqamah Offset Configuration ---");
    console.log("Enter the number of minutes to add to Azan for Iqamah time.");
    config.iqamahOffsets = {};
    IQAMAH_PRAYERS.forEach(prayer => {
        config.iqamahOffsets[prayer] = readlineSync.questionInt(`Offset for ${prayer.charAt(0).toUpperCase() + prayer.slice(1)} (minutes): `, {
            limitMessage: "Please enter a valid integer for minutes."
        });
    });

    // Default other API params that are not interactively configured
    config.shafaq = "general"; // Default for Aladhan API
    config.iso8601 = false; // We want HH:MM for easier processing

    saveConfig(config);
    console.log(`Configuration saved to ${CONFIG_FILE}`);
    return config;
}

export function loadConfig() {
    if (fs.existsSync(CONFIG_FILE)) {
        try {
            const rawData = fs.readFileSync(CONFIG_FILE);
            const config = JSON.parse(rawData);
            // Add basic validation if needed
            if (config.latitude !== undefined && config.iqamahOffsets) {
                return config;
            }
            console.warn("Config file is malformed. Re-Initialising.");
        } catch (error) {
            console.error(`Error reading or parsing config file ${CONFIG_FILE}:`, error);
        }
    }
    return null;
}

export function saveConfig(config) {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    } catch (error) {
        console.error(`Error writing config file ${CONFIG_FILE}:`, error);
    }
}