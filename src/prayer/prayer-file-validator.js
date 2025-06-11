import fs from 'fs';
import path from 'path';
import { validatePrayerTimes } from './schema.js';

/**
 * Validates a prayer times file and adds 'validated: true' flag if valid
 * @param {string} filePath - Path to the prayer_times.json file
 * @returns {boolean} - True if valid, false otherwise
 */
export function validateAndFlagPrayerTimesFile(filePath) {
    try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(fileContent);

        // Use the schema validation function
        const validationResult = validatePrayerTimes(data);
        
        if (validationResult.isValid) {
            // If not already flagged as validated, add the flag and save
            if (data.validated !== true) {
                data.validated = true;
                fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
                console.info(`✅ Local prayer times file ${path.basename(filePath)} validated and flagged.`);
            } else {
                console.info(`📄 Local prayer times file ${path.basename(filePath)} is already flagged as validated.`);
            }
            return true;
        } else {
            console.error(`Error: Invalid prayer times file format in ${path.basename(filePath)}. ${validationResult.error}`);
            return false;
        }
    } catch (error) {
        console.error(`Error validating local prayer times file ${path.basename(filePath)}:`, error);
        return false;
    }
}

/**
 * Deletes a potentially corrupt prayer times file
 * @param {string} filePath - Path to the file to delete
 * @returns {boolean} - True if successfully deleted or file didn't exist, false if deletion failed
 */
export function deletePrayerTimesFile(filePath) {
    if (fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
            console.log(`🗑️ Deleted potentially corrupt file: ${path.basename(filePath)}`);
            return true;
        } catch (error) {
            console.error(`Error deleting file ${path.basename(filePath)}:`, error);
            return false;
        }
    }
    return true; // File didn't exist, so no need to delete
}

/**
 * Checks if the prayer times file exists and is valid
 * @param {string} filePath - Path to the prayer_times.json file
 * @returns {boolean} - True if file exists and is valid, false otherwise
 */
export function isPrayerTimesFileValid(filePath) {
    if (!fs.existsSync(filePath)) {
        console.log(`📄 Prayer times file ${path.basename(filePath)} not found.`);
        return false;
    }
    
    console.log(`📄 File ${path.basename(filePath)} found. Validating...`);
    return validateAndFlagPrayerTimesFile(filePath);
} 