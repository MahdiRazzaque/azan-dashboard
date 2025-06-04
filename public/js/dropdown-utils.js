/**
 * Utility functions for populating dropdowns with prayer time calculation options
 */

/**
 * Populates a select element with options from the provided data
 * @param {string} selectId - ID of the select element to populate
 * @param {Array} options - Array of {id, name} objects for dropdown options
 * @param {number|null} selectedValue - Currently selected value (optional)
 */
function populateDropdown(selectId, options, selectedValue = null) {
    const selectElement = document.getElementById(selectId);
    if (!selectElement) {
        console.error(`Select element with ID ${selectId} not found`);
        return;
    }
    
    // Clear existing options
    selectElement.innerHTML = '';
    
    // Add new options
    options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option.id !== null ? option.id : 'null'; // Handle null values
        optionElement.textContent = option.name;
        
        // Set selected if matching the selectedValue
        if (selectedValue !== undefined && selectedValue !== null) {
            if ((option.id === null && selectedValue === null) || 
                option.id === selectedValue) {
                optionElement.selected = true;
            }
        }
        
        selectElement.appendChild(optionElement);
    });
}

/**
 * Fetches calculation method options from the server and populates the dropdown
 * @param {string} selectId - ID of the select element to populate
 * @param {number|null} selectedValue - Currently selected value (optional)
 */
async function populateCalculationMethodDropdown(selectId, selectedValue = null) {
    try {
        const response = await fetch('/api/prayer/constants/calculation-methods');
        if (!response.ok) {
            throw new Error(`Failed to fetch calculation methods: ${response.statusText}`);
        }
        const options = await response.json();
        populateDropdown(selectId, options, selectedValue);
    } catch (error) {
        console.error('Error populating calculation method dropdown:', error);
    }
}

/**
 * Fetches Asr juristic method options from the server and populates the dropdown
 * @param {string} selectId - ID of the select element to populate
 * @param {number|null} selectedValue - Currently selected value (optional)
 */
async function populateAsrJuristicMethodDropdown(selectId, selectedValue = null) {
    try {
        const response = await fetch('/api/prayer/constants/asr-methods');
        if (!response.ok) {
            throw new Error(`Failed to fetch Asr juristic methods: ${response.statusText}`);
        }
        const options = await response.json();
        populateDropdown(selectId, options, selectedValue);
    } catch (error) {
        console.error('Error populating Asr juristic method dropdown:', error);
    }
}

/**
 * Fetches latitude adjustment method options from the server and populates the dropdown
 * @param {string} selectId - ID of the select element to populate
 * @param {number|null} selectedValue - Currently selected value (optional)
 */
async function populateLatitudeAdjustmentMethodDropdown(selectId, selectedValue = null) {
    try {
        const response = await fetch('/api/prayer/constants/latitude-adjustments');
        if (!response.ok) {
            throw new Error(`Failed to fetch latitude adjustment methods: ${response.statusText}`);
        }
        const options = await response.json();
        populateDropdown(selectId, options, selectedValue);
    } catch (error) {
        console.error('Error populating latitude adjustment method dropdown:', error);
    }
}

/**
 * Fetches midnight mode options from the server and populates the dropdown
 * @param {string} selectId - ID of the select element to populate
 * @param {number|null} selectedValue - Currently selected value (optional)
 */
async function populateMidnightModeDropdown(selectId, selectedValue = null) {
    try {
        const response = await fetch('/api/prayer/constants/midnight-modes');
        if (!response.ok) {
            throw new Error(`Failed to fetch midnight modes: ${response.statusText}`);
        }
        const options = await response.json();
        populateDropdown(selectId, options, selectedValue);
    } catch (error) {
        console.error('Error populating midnight mode dropdown:', error);
    }
}

/**
 * Populates all Aladhan-related dropdowns at once
 * @param {Object} config - Current Aladhan configuration with selected values
 */
async function populateAllAladhanDropdowns(config = {}) {
    await Promise.all([
        populateCalculationMethodDropdown('calculationMethod', config.calculationMethodId),
        populateAsrJuristicMethodDropdown('asrJuristicMethod', config.asrJuristicMethodId),
        populateLatitudeAdjustmentMethodDropdown('latitudeAdjustmentMethod', config.latitudeAdjustmentMethodId),
        populateMidnightModeDropdown('midnightMode', config.midnightModeId)
    ]);
}

// Export functions for use in other files
window.populateCalculationMethodDropdown = populateCalculationMethodDropdown;
window.populateAsrJuristicMethodDropdown = populateAsrJuristicMethodDropdown;
window.populateLatitudeAdjustmentMethodDropdown = populateLatitudeAdjustmentMethodDropdown;
window.populateMidnightModeDropdown = populateMidnightModeDropdown;
window.populateAllAladhanDropdowns = populateAllAladhanDropdowns; 