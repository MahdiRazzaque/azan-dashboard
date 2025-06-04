/**
 * Setup Modal Handler for Azan Dashboard
 * Manages the initial setup process when config.json is missing
 */

class SetupModalHandler {
    constructor() {
        this.modal = document.getElementById('setup-modal');
        this.sourceSelection = document.getElementById('source-selection');
        this.mymasjidForm = document.getElementById('mymasjid-form');
        this.aladhanForm = document.getElementById('aladhan-form');
        this.setupProgress = document.getElementById('setup-progress');
        
        this.sourceOptions = document.querySelectorAll('.source-option');
        this.selectedSource = null;
        
        // Form elements - make sure we're selecting elements from the setup modal, not the settings modal
        this.mymasjidGuildId = this.modal.querySelector('#mymasjid-guildid');
        this.mymasjidError = this.modal.querySelector('#mymasjid-error');
        
        // Setup form elements - Aladhan form
        // We add proper modal context to the selectors to ensure we get elements from the setup modal
        this.aladhanLatitude = this.modal.querySelector('#aladhan-latitude');
        this.aladhanLongitude = this.modal.querySelector('#aladhan-longitude');
        this.aladhanTimezone = this.modal.querySelector('#aladhan-timezone');
        this.calculationMethod = this.modal.querySelector('#calculation-method');
        this.asrMethod = this.modal.querySelector('#asr-method');
        this.latitudeAdjustment = this.modal.querySelector('#latitude-adjustment');
        this.midnightMode = this.modal.querySelector('#midnight-mode');
        this.iqamahFajr = this.modal.querySelector('#iqamah-fajr');
        this.iqamahZuhr = this.modal.querySelector('#iqamah-zuhr');
        this.iqamahAsr = this.modal.querySelector('#iqamah-asr');
        this.iqamahMaghrib = this.modal.querySelector('#iqamah-maghrib');
        this.iqamahIsha = this.modal.querySelector('#iqamah-isha');
        
        // Button elements
        this.mymasjidBackBtn = this.modal.querySelector('#mymasjid-back');
        this.mymasjidSubmitBtn = this.modal.querySelector('#mymasjid-submit');
        this.aladhanBackBtn = this.modal.querySelector('#aladhan-back');
        this.aladhanSubmitBtn = this.modal.querySelector('#aladhan-submit');
        
        this.progressBar = this.modal.querySelector('.progress-bar');
        this.setupMessage = this.modal.querySelector('.setup-message');
        
        // Simple string logging that doesn't rely on moment.js
        const now = new Date();
        const timeString = now.toLocaleTimeString();
        const dateString = now.toLocaleDateString();
        console.log(`[${dateString} ${timeString}] Setup modal elements initialized`);
        
        this.init();
    }
    
    /**
     * Initialize the setup modal
     */
    init() {
        // Check if setup is needed
        this.checkIfSetupNeeded();
        
        // Add event listeners
        this.addEventListeners();
        
        // Populate dropdowns
        this.populateDropdowns();
        
        // Try to detect user's timezone
        this.detectUserTimezone();
    }
    
    /**
     * Check if setup is needed by querying the server
     */
    async checkIfSetupNeeded() {
        try {
            const response = await fetch('/api/config/status');
            const data = await response.json();
            
            if (data.needsSetup) {
                this.showModal();
            }
        } catch (error) {
            console.error('Error checking setup status:', error);
        }
    }
    
    /**
     * Add event listeners to form elements
     */
    addEventListeners() {
        // Source selection
        this.sourceOptions.forEach(option => {
            option.addEventListener('click', () => this.selectSource(option));
        });
        
        // MyMasjid form
        this.mymasjidBackBtn.addEventListener('click', () => this.showSourceSelection());
        this.mymasjidSubmitBtn.addEventListener('click', () => this.submitMyMasjidForm());
        
        // Aladhan form
        this.aladhanBackBtn.addEventListener('click', () => this.showSourceSelection());
        this.aladhanSubmitBtn.addEventListener('click', () => this.submitAladhanForm());
        
        // Form validation
        this.mymasjidGuildId.addEventListener('input', () => this.validateMyMasjidForm());
        this.aladhanLatitude.addEventListener('input', () => this.validateAladhanForm());
        this.aladhanLongitude.addEventListener('input', () => this.validateAladhanForm());
        this.aladhanTimezone.addEventListener('input', () => this.validateAladhanForm());
    }
    
    /**
     * Populate dropdown menus with options from the server
     */
    async populateDropdowns() {
        try {
            const response = await fetch('/api/prayer/constants/all');
            const data = await response.json();
            
            // Populate calculation methods
            this.populateDropdown(this.calculationMethod, data.calculationMethods);
            
            // Populate Asr juristic methods
            this.populateDropdown(this.asrMethod, data.asrJuristicMethods);
            
            // Populate latitude adjustment methods
            this.populateDropdown(this.latitudeAdjustment, data.latitudeAdjustmentMethods);
            
            // Populate midnight modes
            this.populateDropdown(this.midnightMode, data.midnightModes);
            
            // Set default values from default config
            const defaults = data.defaultConfig;
            this.calculationMethod.value = defaults.calculationMethodId;
            this.asrMethod.value = defaults.asrJuristicMethodId;
            this.latitudeAdjustment.value = defaults.latitudeAdjustmentId === null ? 'null' : defaults.latitudeAdjustmentId;
            this.midnightMode.value = defaults.midnightModeId;
            
            this.iqamahFajr.value = defaults.iqamahOffsets.fajr;
            this.iqamahZuhr.value = defaults.iqamahOffsets.zuhr;
            this.iqamahAsr.value = defaults.iqamahOffsets.asr;
            this.iqamahMaghrib.value = defaults.iqamahOffsets.maghrib;
            this.iqamahIsha.value = defaults.iqamahOffsets.isha;
        } catch (error) {
            console.error('Error populating dropdowns:', error);
        }
    }
    
    /**
     * Helper function to populate a dropdown with options
     */
    populateDropdown(selectElement, options) {
        if (!selectElement) return;
        
        // Clear existing options
        selectElement.innerHTML = '';
        
        // Add new options
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.id !== null ? option.id : 'null';
            optionElement.textContent = option.name;
            selectElement.appendChild(optionElement);
        });
    }
    
    /**
     * Try to detect user's timezone
     */
    detectUserTimezone() {
        try {
            const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            if (timezone) {
                this.aladhanTimezone.value = timezone;
            }
        } catch (error) {
            console.error('Error detecting timezone:', error);
        }
    }
    
    /**
     * Show the setup modal
     */
    showModal() {
        this.modal.classList.add('show');
        this.showSourceSelection();
    }
    
    /**
     * Hide the setup modal
     */
    hideModal() {
        this.modal.classList.remove('show');
    }
    
    /**
     * Show the source selection section
     */
    showSourceSelection() {
        this.sourceSelection.classList.remove('hidden');
        this.mymasjidForm.classList.add('hidden');
        this.aladhanForm.classList.add('hidden');
        this.setupProgress.classList.add('hidden');
    }
    
    /**
     * Select a prayer time source
     */
    selectSource(option) {
        // Remove selected class from all options
        this.sourceOptions.forEach(opt => opt.classList.remove('selected'));
        
        // Add selected class to clicked option
        option.classList.add('selected');
        
        // Store selected source
        this.selectedSource = option.dataset.source;
        
        // Show appropriate form
        if (this.selectedSource === 'mymasjid') {
            this.showMyMasjidForm();
        } else if (this.selectedSource === 'aladhan') {
            this.showAladhanForm();
        }
    }
    
    /**
     * Show the MyMasjid form
     */
    showMyMasjidForm() {
        this.sourceSelection.classList.add('hidden');
        this.mymasjidForm.classList.remove('hidden');
        this.aladhanForm.classList.add('hidden');
        this.setupProgress.classList.add('hidden');
        
        // Focus on guild ID input
        setTimeout(() => this.mymasjidGuildId.focus(), 100);
    }
    
    /**
     * Show the Aladhan form
     */
    showAladhanForm() {
        this.sourceSelection.classList.add('hidden');
        this.mymasjidForm.classList.add('hidden');
        this.aladhanForm.classList.remove('hidden');
        this.setupProgress.classList.add('hidden');
        
        // Focus on latitude input
        setTimeout(() => this.aladhanLatitude.focus(), 100);
    }
    
    /**
     * Show the setup progress section
     */
    showSetupProgress(message = 'Please wait while we fetch prayer times...') {
        this.sourceSelection.classList.add('hidden');
        this.mymasjidForm.classList.add('hidden');
        this.aladhanForm.classList.add('hidden');
        this.setupProgress.classList.remove('hidden');
        
        this.setupMessage.textContent = message;
        this.progressBar.style.width = '0%';
    }
    
    /**
     * Update the progress bar
     */
    updateProgress(percent, message) {
        this.progressBar.style.width = `${percent}%`;
        if (message) {
            this.setupMessage.textContent = message;
        }
    }
    
    /**
     * Validate the MyMasjid form
     */
    validateMyMasjidForm() {
        const guildId = this.mymasjidGuildId.value.trim();
        
        if (!guildId) {
            this.mymasjidError.textContent = 'Guild ID is required';
            return false;
        }
        
        this.mymasjidError.textContent = '';
        return true;
    }
    
    /**
     * Validate the Aladhan form
     */
    validateAladhanForm() {
        console.log("Validating Aladhan form");
        let isValid = true;
        
        // Get the values directly from the inputs
        const latitudeStr = this.aladhanLatitude.value.trim();
        console.log("Latitude string: '" + latitudeStr + "'");
        const longitudeStr = this.aladhanLongitude.value.trim();
        console.log("Longitude string: '" + longitudeStr + "'");
        const timezone = this.aladhanTimezone.value.trim();
        console.log("Timezone string: '" + timezone + "'");
        
        const latitudeError = document.getElementById('latitude-error');
        const longitudeError = document.getElementById('longitude-error');
        const timezoneError = document.getElementById('timezone-error');
        
        // Reset all error messages and styling
        latitudeError.textContent = '';
        longitudeError.textContent = '';
        timezoneError.textContent = '';
        
        latitudeError.style.display = 'none';
        longitudeError.style.display = 'none';
        timezoneError.style.display = 'none';
        
        // Debug the DOM elements
        console.log("Latitude input:", this.aladhanLatitude);
        console.log("Longitude input:", this.aladhanLongitude);
        console.log("Timezone input:", this.aladhanTimezone);
        
        // Validate latitude
        if (!latitudeStr) {
            console.log("Empty Latitude");
            latitudeError.textContent = 'Latitude is required';
            latitudeError.style.display = 'block';
            latitudeError.style.color = 'red';
            isValid = false;
        } else {
            const latitude = parseFloat(latitudeStr);
            console.log("Parsed latitude:", latitude);
            if (isNaN(latitude)) {
                console.log("Invalid Latitude");
                latitudeError.textContent = 'Latitude must be a number';
                latitudeError.style.display = 'block';
                latitudeError.style.color = 'red';
                isValid = false;
            } else if (latitude < -90 || latitude > 90) {
                console.log("Invalid Latitude 2");
                latitudeError.textContent = 'Latitude must be between -90 and 90';
                latitudeError.style.display = 'block';
                latitudeError.style.color = 'red';
                isValid = false;
            } else {
                console.log("Valid Latitude: " + latitude);
            }
        }
        
        // Validate longitude
        if (!longitudeStr) {
            console.log("Empty Longitude");
            longitudeError.textContent = 'Longitude is required';
            longitudeError.style.display = 'block';
            longitudeError.style.color = 'red';
            isValid = false;
        } else {
            const longitude = parseFloat(longitudeStr);
            console.log("Parsed longitude:", longitude);
            if (isNaN(longitude)) {
                console.log("Invalid Longitude");
                longitudeError.textContent = 'Longitude must be a number';
                longitudeError.style.display = 'block';
                longitudeError.style.color = 'red';
                isValid = false;
            } else if (longitude < -180 || longitude > 180) {
                console.log("Invalid Longitude 2");
                longitudeError.textContent = 'Longitude must be between -180 and 180';
                longitudeError.style.display = 'block';
                longitudeError.style.color = 'red';
                isValid = false;
            } else {
                console.log("Valid Longitude: " + longitude);
            }
        }
        
        // Validate timezone
        if (!timezone) {
            console.log("Invalid Timezone");
            timezoneError.textContent = 'Timezone is required';
            timezoneError.style.display = 'block';
            timezoneError.style.color = 'red';
            isValid = false;
        } else {
            try {
                console.log("Testing Timezone: " + timezone);
                Intl.DateTimeFormat(undefined, { timeZone: timezone });
                console.log("Valid Timezone");
            } catch (e) {
                console.log("Invalid Timezone 2: " + e.message);
                timezoneError.textContent = 'Invalid timezone';
                timezoneError.style.display = 'block';
                timezoneError.style.color = 'red';
                isValid = false;
            }
        }
        
        // Final validation result
        console.log("Form validation result: " + (isValid ? "VALID" : "INVALID"));
        return isValid;
    }
    
    /**
     * Submit the MyMasjid form
     */
    async submitMyMasjidForm() {
        if (!this.validateMyMasjidForm()) {
            return;
        }
        
        const guildId = this.mymasjidGuildId.value.trim();
        
        // Show progress
        this.showSetupProgress('Validating Guild ID...');
        this.updateProgress(10);
        
        try {
            // Validate guild ID
            const validationResponse = await fetch(`/api/prayer/validate-guildid?guildId=${encodeURIComponent(guildId)}`);
            
            // Check if the response is not OK (e.g., 404, 500)
            if (!validationResponse.ok) {
                this.showMyMasjidForm();
                this.mymasjidError.textContent = 'Error validating Guild ID. Server returned: ' + 
                    validationResponse.status + ' ' + validationResponse.statusText;
                return;
            }
            
            let validationData;
            try {
                validationData = await validationResponse.json();
            } catch (e) {
                this.showMyMasjidForm();
                this.mymasjidError.textContent = 'Invalid response from server. Please try again.';
                return;
            }
            
            if (!validationData.valid) {
                this.showMyMasjidForm();
                this.mymasjidError.textContent = validationData.error || 'Invalid Guild ID. Please check and try again.';
                return;
            }
            
            this.updateProgress(30, 'Guild ID validated. Creating configuration...');
            
            // Submit configuration
            const configResponse = await fetch('/api/config/setup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    source: 'mymasjid',
                    mymasjid: {
                        guildId: guildId
                    }
                })
            });
            
            // Check if the response is not OK (e.g., 404, 500)
            if (!configResponse.ok) {
                this.showMyMasjidForm();
                this.mymasjidError.textContent = 'Error creating configuration. Server returned: ' + 
                    configResponse.status + ' ' + configResponse.statusText;
                return;
            }
            
            let configData;
            try {
                configData = await configResponse.json();
            } catch (e) {
                this.showMyMasjidForm();
                this.mymasjidError.textContent = 'Invalid response from server. Please try again.';
                return;
            }
            
            if (!configData.success) {
                this.showMyMasjidForm();
                this.mymasjidError.textContent = configData.error || 'Failed to create configuration';
                return;
            }
            
            this.updateProgress(50, 'Configuration created. Initialising services...');
            
            // Initialize prayer services
            try {
                const initResponse = await fetch('/api/initialize-services', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                if (!initResponse.ok) {
                    console.warn('Warning: Failed to initialize services. Status:', initResponse.status);
                } else {
                    const initData = await initResponse.json();
                    if (!initData.success) {
                        console.warn('Warning: Failed to initialize services:', initData.error);
                    }
                }
            } catch (error) {
                console.warn('Warning: Error Initialising services:', error);
            }
            
            this.updateProgress(60, 'Fetching prayer times...');
            
            // Wait for prayer times to be fetched
            let retryCount = 0;
            const maxRetries = 10;
            const statusCheckInterval = setInterval(async () => {
                try {
                    retryCount++;
                    if (retryCount > maxRetries) {
                        clearInterval(statusCheckInterval);
                        this.updateProgress(100, 'Setup complete, but prayer times may need to be refreshed');
                        // Reload the page after a short delay
                        setTimeout(() => {
                            window.location.reload();
                        }, 1500);
                        return;
                    }
                    
                    const statusResponse = await fetch('/api/prayer/status');
                    if (!statusResponse.ok) {
                        console.warn('Warning: Failed to check prayer status. Status:', statusResponse.status);
                        return;
                    }
                    
                    const statusData = await statusResponse.json();
                    
                    if (statusData.ready) {
                        clearInterval(statusCheckInterval);
                        this.updateProgress(100, 'Setup complete!');
                        
                        // Reload the page after a short delay
                        setTimeout(() => {
                            window.location.reload();
                        }, 1500);
                    }
                } catch (error) {
                    console.error('Error checking prayer status:', error);
                }
            }, 2000);
            
        } catch (error) {
            console.error('Error submitting MyMasjid form:', error);
            this.showMyMasjidForm();
            this.mymasjidError.textContent = 'An error occurred: ' + error.message;
        }
    }
    
    /**
     * Submit the Aladhan form
     */
    async submitAladhanForm() {
        console.log("Submitting Aladhan Form");
        if (!this.validateAladhanForm()) {
            console.log("Invalid Aladhan Form");
            return;
        }
        
        console.log("Valid Aladhan Form");
        // Get form values - ensure we properly parse numeric values
        const latitude = parseFloat(this.aladhanLatitude.value.trim());
        const longitude = parseFloat(this.aladhanLongitude.value.trim());
        const timezone = this.aladhanTimezone.value.trim();
        
        // Log the values we're sending for debugging
        console.log("Sending data:", {
            latitude,
            longitude,
            timezone,
            calculationMethodId: parseInt(this.calculationMethod.value),
            asrJuristicMethodId: parseInt(this.asrMethod.value),
            latitudeAdjustmentMethodId: this.latitudeAdjustment.value === 'null' ? null : parseInt(this.latitudeAdjustment.value),
            midnightModeId: parseInt(this.midnightMode.value),
            iqamahOffsets: {
                fajr: parseInt(this.iqamahFajr.value),
                zuhr: parseInt(this.iqamahZuhr.value),
                asr: parseInt(this.iqamahAsr.value),
                maghrib: parseInt(this.iqamahMaghrib.value),
                isha: parseInt(this.iqamahIsha.value)
            }
        });
        
        const calculationMethodId = parseInt(this.calculationMethod.value);
        const asrJuristicMethodId = parseInt(this.asrMethod.value);
        const latitudeAdjustmentMethodId = this.latitudeAdjustment.value === 'null' ? null : parseInt(this.latitudeAdjustment.value);
        const midnightModeId = parseInt(this.midnightMode.value);
        
        const iqamahOffsets = {
            fajr: parseInt(this.iqamahFajr.value),
            zuhr: parseInt(this.iqamahZuhr.value),
            asr: parseInt(this.iqamahAsr.value),
            maghrib: parseInt(this.iqamahMaghrib.value),
            isha: parseInt(this.iqamahIsha.value)
        };
        
        // Show progress
        this.showSetupProgress('Creating configuration...');
        this.updateProgress(20);
        
        try {
            // Submit configuration
            const configResponse = await fetch('/api/config/setup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    source: 'aladhan',
                    aladhan: {
                        latitude,
                        longitude,
                        timezone,
                        calculationMethodId,
                        asrJuristicMethodId,
                        latitudeAdjustmentMethodId,
                        midnightModeId,
                        iqamahOffsets
                    }
                })
            });
            
            // Check if the response is not OK (e.g., 404, 500)
            if (!configResponse.ok) {
                this.showAladhanForm();
                const timezoneError = document.getElementById('timezone-error');
                timezoneError.textContent = 'Error creating configuration. Server returned: ' + 
                    configResponse.status + ' ' + configResponse.statusText;
                timezoneError.style.display = 'block';
                timezoneError.style.color = 'red';
                console.error("Server error:", configResponse.status, configResponse.statusText);
                return;
            }
            
            let configData;
            try {
                configData = await configResponse.json();
            } catch (e) {
                this.showAladhanForm();
                const timezoneError = document.getElementById('timezone-error');
                timezoneError.textContent = 'Invalid response from server. Please try again.';
                timezoneError.style.display = 'block';
                timezoneError.style.color = 'red';
                console.error("JSON parse error:", e);
                return;
            }
            
            if (!configData.success) {
                this.showAladhanForm();
                const timezoneError = document.getElementById('timezone-error');
                timezoneError.textContent = configData.error || 'Failed to create configuration';
                timezoneError.style.display = 'block';
                timezoneError.style.color = 'red';
                console.error("Config error:", configData.error || 'Unknown error');
                return;
            }
            
            this.updateProgress(40, 'Configuration created. Initialising services...');
            
            // Initialize prayer services
            try {
                const initResponse = await fetch('/api/initialize-services', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                if (!initResponse.ok) {
                    console.warn('Warning: Failed to initialize services. Status:', initResponse.status);
                } else {
                    const initData = await initResponse.json();
                    if (!initData.success) {
                        console.warn('Warning: Failed to initialize services:', initData.error);
                    }
                }
            } catch (error) {
                console.warn('Warning: Error Initialising services:', error);
            }
            
            this.updateProgress(50, 'Fetching prayer times...');
            
            // Wait for prayer times to be fetched
            let retryCount = 0;
            const maxRetries = 10;
            const statusCheckInterval = setInterval(async () => {
                try {
                    retryCount++;
                    if (retryCount > maxRetries) {
                        clearInterval(statusCheckInterval);
                        this.updateProgress(100, 'Setup complete, but prayer times may need to be refreshed');
                        // Reload the page after a short delay
                        setTimeout(() => {
                            window.location.reload();
                        }, 1500);
                        return;
                    }
                    
                    const statusResponse = await fetch('/api/prayer/status');
                    if (!statusResponse.ok) {
                        console.warn('Warning: Failed to check prayer status. Status:', statusResponse.status);
                        return;
                    }
                    
                    let statusData;
                    try {
                        statusData = await statusResponse.json();
                    } catch (e) {
                        console.warn('Warning: Invalid response from prayer status endpoint');
                        return;
                    }
                    
                    if (statusData.ready) {
                        clearInterval(statusCheckInterval);
                        this.updateProgress(100, 'Setup complete!');
                        
                        // Reload the page after a short delay
                        setTimeout(() => {
                            window.location.reload();
                        }, 1500);
                    }
                } catch (error) {
                    console.error('Error checking prayer status:', error);
                }
            }, 2000);
            
        } catch (error) {
            console.error('Error submitting Aladhan form:', error);
            this.showAladhanForm();
            const timezoneError = document.getElementById('timezone-error');
            timezoneError.textContent = 'An error occurred: ' + error.message;
            timezoneError.style.display = 'block';
            timezoneError.style.color = 'red';
        }
    }
}

// Initialize the setup modal handler when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.setupModalHandler = new SetupModalHandler();
}); 