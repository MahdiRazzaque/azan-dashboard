# Settings Panel Implementation Plan

## Overview
Add a settings panel to the Azan Dashboard that allows authenticated administrators to configure prayer-specific settings including:
- Toggle azan and announcement timers for each prayer
- Choose when azan goes off (at prayer start time or iqamah time)
- Customize announcement timing for each prayer

## Implementation Checklist

### 1. Backend API Enhancements
- [ ] Create new API endpoint `/api/prayer-settings` to get and update prayer-specific settings
- [ ] Modify config.json schema to store prayer-specific settings
- [ ] Update the scheduler logic to use prayer-specific settings
- [ ] Create middleware to validate settings changes

### 2. Frontend UI Components
- [ ] Create a modal overlay for settings rather than a separate page
- [ ] Add settings button to replace announcement and azan toggle buttons
- [ ] Implement authentication check when settings button is clicked
- [ ] Create CSS styles for the settings modal

### 3. Settings Features
- [ ] Add toggle switches for each prayer's azan and announcement
- [ ] Add radio buttons for azan timing option (start time vs iqamah time)
- [ ] Add input field for customizable announcement timing for each prayer
- [ ] Create save/cancel buttons with proper feedback
- [ ] Add reset to defaults functionality
- [ ] Implement confirmation dialog before applying settings changes

### 4. Authentication Flow
- [ ] Redirect unauthenticated users to login modal
- [ ] After successful authentication, show settings modal
- [ ] Add session persistence to maintain login state

### 5. Data Handling
- [ ] Create data models for per-prayer settings
- [ ] Implement settings validation logic
- [ ] Update scheduler to use the new per-prayer configuration
- [ ] Add error handling for settings operations

### 6. Testing
- [ ] Test authentication flow
- [ ] Test settings persistence
- [ ] Test prayer timers with new settings
- [ ] Test across different devices/browsers

## Answers to Implementation Questions
1. Settings will apply to individual prayers (per-prayer settings)
2. Yes, users will be able to customize announcement timings for each prayer
3. No additional settings beyond azan toggle, announcement toggle, and azan timing needed
4. Settings will be implemented as a modal overlay rather than a separate page
5. Yes, a confirmation step will be added before applying settings changes