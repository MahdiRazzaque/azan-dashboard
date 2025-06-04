/**
 * Prayer Source Switching Tests
 * 
 * This file contains tests for verifying that users can switch between
 * MyMasjid and Aladhan prayer time sources in the settings dashboard.
 */

const { Builder, By, until } = require('selenium-webdriver');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('Prayer Source Switching Tests', function() {
  // Increase timeout for longer running tests
  this.timeout(30000);
  
  let driver;
  
  // Sample test data
  const myMasjidSettings = {
    guildId: 'test-guild-id-123'
  };
  
  const aladhanSettings = {
    latitude: 51.5074,
    longitude: -0.1278,
    timezone: 'Europe/London',
    calculationMethodId: 2, // ISNA
    asrJuristicMethodId: 0, // Shafi'i
    latitudeAdjustmentMethodId: 3, // AngleBasedMethod
    midnightModeId: 0, // Standard
    iqamahOffsets: {
      fajr: 20,
      zuhr: 10,
      asr: 10,
      maghrib: 5,
      isha: 15
    }
  };
  
  // Helper function to backup and restore config.json
  const configPath = path.join(__dirname, '../config.json');
  const configBackupPath = path.join(__dirname, '../config.json.bak');
  
  function backupConfig() {
    if (fs.existsSync(configPath)) {
      fs.copyFileSync(configPath, configBackupPath);
    }
  }
  
  function restoreConfig() {
    if (fs.existsSync(configBackupPath)) {
      fs.copyFileSync(configBackupPath, configPath);
      fs.unlinkSync(configBackupPath);
    }
  }
  
  // Setup before tests
  before(async function() {
    // Backup existing config
    backupConfig();
    
    // Initialize WebDriver
    driver = await new Builder().forBrowser('chrome').build();
    
    // Navigate to the application
    await driver.get('http://localhost:3000');
    
    // Login as admin
    await login('admin', 'password');
  });
  
  // Teardown after tests
  after(async function() {
    // Restore original config
    restoreConfig();
    
    // Close the browser
    if (driver) {
      await driver.quit();
    }
  });
  
  // Helper function for admin login
  async function login(username, password) {
    // Click settings button to trigger login modal
    const settingsBtn = await driver.findElement(By.id('settings-btn'));
    await settingsBtn.click();
    
    // Wait for login modal
    await driver.wait(until.elementLocated(By.id('login-modal')), 5000);
    
    // Fill login form
    await driver.findElement(By.id('username')).sendKeys(username);
    await driver.findElement(By.id('password')).sendKeys(password);
    
    // Submit login form
    await driver.findElement(By.id('login-submit')).click();
    
    // Wait for settings modal to appear (indicating successful login)
    await driver.wait(until.elementLocated(By.id('settings-modal')), 5000);
  }
  
  // Helper function to open settings modal
  async function openSettings() {
    const settingsBtn = await driver.findElement(By.id('settings-btn'));
    await settingsBtn.click();
    
    // Wait for settings modal
    await driver.wait(until.elementLocated(By.id('settings-modal')), 5000);
    
    // Click on Prayer Time Source tab
    const sourceTabBtn = await driver.findElement(By.css('[data-tab="prayer-source"]'));
    await sourceTabBtn.click();
    
    // Wait for tab content to be visible
    await driver.wait(until.elementIsVisible(
      await driver.findElement(By.id('prayer-source-tab'))
    ), 5000);
  }
  
  // Test: Switch from MyMasjid to Aladhan
  it('should switch from MyMasjid to Aladhan source', async function() {
    // Open settings
    await openSettings();
    
    // Select MyMasjid source first (to ensure we're starting with MyMasjid)
    await driver.findElement(By.id('source-mymasjid')).click();
    
    // Enter MyMasjid guild ID
    const guildIdInput = await driver.findElement(By.id('mymasjid-guild-id'));
    await guildIdInput.clear();
    await guildIdInput.sendKeys(myMasjidSettings.guildId);
    
    // Save settings
    await driver.findElement(By.id('settings-save')).click();
    
    // Confirm changes
    await driver.wait(until.elementLocated(By.id('settings-confirm-modal')), 5000);
    await driver.findElement(By.id('settings-confirm-apply')).click();
    
    // Wait for success message
    await driver.wait(until.elementLocated(By.className('success-message')), 10000);
    
    // Open settings again
    await openSettings();
    
    // Now switch to Aladhan source
    await driver.findElement(By.id('source-aladhan')).click();
    
    // Wait for Aladhan settings to be visible
    await driver.wait(until.elementIsVisible(
      await driver.findElement(By.id('aladhan-settings'))
    ), 5000);
    
    // Fill in Aladhan settings
    await driver.findElement(By.id('aladhan-latitude')).sendKeys(aladhanSettings.latitude);
    await driver.findElement(By.id('aladhan-longitude')).sendKeys(aladhanSettings.longitude);
    await driver.findElement(By.id('aladhan-timezone')).sendKeys(aladhanSettings.timezone);
    
    // Select calculation method
    const calculationMethodSelect = await driver.findElement(By.id('settings-calculation-method'));
    await calculationMethodSelect.findElement(By.css(`option[value="${aladhanSettings.calculationMethodId}"]`)).click();
    
    // Select Asr method
    const asrMethodSelect = await driver.findElement(By.id('settings-asr-method'));
    await asrMethodSelect.findElement(By.css(`option[value="${aladhanSettings.asrJuristicMethodId}"]`)).click();
    
    // Select latitude adjustment method
    const latAdjustSelect = await driver.findElement(By.id('settings-latitude-adjustment'));
    await latAdjustSelect.findElement(By.css(`option[value="${aladhanSettings.latitudeAdjustmentMethodId}"]`)).click();
    
    // Select midnight mode
    const midnightSelect = await driver.findElement(By.id('settings-midnight-mode'));
    await midnightSelect.findElement(By.css(`option[value="${aladhanSettings.midnightModeId}"]`)).click();
    
    // Set iqamah offsets
    await driver.findElement(By.id('settings-iqamah-fajr')).sendKeys(aladhanSettings.iqamahOffsets.fajr);
    await driver.findElement(By.id('settings-iqamah-zuhr')).sendKeys(aladhanSettings.iqamahOffsets.zuhr);
    await driver.findElement(By.id('settings-iqamah-asr')).sendKeys(aladhanSettings.iqamahOffsets.asr);
    await driver.findElement(By.id('settings-iqamah-maghrib')).sendKeys(aladhanSettings.iqamahOffsets.maghrib);
    await driver.findElement(By.id('settings-iqamah-isha')).sendKeys(aladhanSettings.iqamahOffsets.isha);
    
    // Save settings
    await driver.findElement(By.id('settings-save')).click();
    
    // Confirm changes
    await driver.wait(until.elementLocated(By.id('settings-confirm-modal')), 5000);
    await driver.findElement(By.id('settings-confirm-apply')).click();
    
    // Wait for success message
    await driver.wait(until.elementLocated(By.className('success-message')), 10000);
    
    // Verify config.json was updated with Aladhan source
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.strictEqual(config.prayerData.source, 'aladhan', 'Source should be changed to aladhan');
    assert.strictEqual(config.prayerData.aladhan.latitude, aladhanSettings.latitude, 'Latitude should match');
    assert.strictEqual(config.prayerData.aladhan.longitude, aladhanSettings.longitude, 'Longitude should match');
  });
  
  // Test: Switch from Aladhan to MyMasjid
  it('should switch from Aladhan to MyMasjid source', async function() {
    // Open settings
    await openSettings();
    
    // Select MyMasjid source
    await driver.findElement(By.id('source-mymasjid')).click();
    
    // Wait for MyMasjid settings to be visible
    await driver.wait(until.elementIsVisible(
      await driver.findElement(By.id('mymasjid-settings'))
    ), 5000);
    
    // Enter MyMasjid guild ID
    const guildIdInput = await driver.findElement(By.id('mymasjid-guild-id'));
    await guildIdInput.clear();
    await guildIdInput.sendKeys(myMasjidSettings.guildId);
    
    // Save settings
    await driver.findElement(By.id('settings-save')).click();
    
    // Confirm changes
    await driver.wait(until.elementLocated(By.id('settings-confirm-modal')), 5000);
    await driver.findElement(By.id('settings-confirm-apply')).click();
    
    // Wait for success message
    await driver.wait(until.elementLocated(By.className('success-message')), 10000);
    
    // Verify config.json was updated with MyMasjid source
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.strictEqual(config.prayerData.source, 'mymasjid', 'Source should be changed to mymasjid');
    assert.strictEqual(config.prayerData.mymasjid.guildId, myMasjidSettings.guildId, 'Guild ID should match');
    
    // Verify that Aladhan settings are still preserved in config
    assert.ok(config.prayerData.aladhan, 'Aladhan settings should be preserved');
    assert.strictEqual(config.prayerData.aladhan.latitude, aladhanSettings.latitude, 'Preserved latitude should match');
  });
  
  // Test: Verify UI updates correctly when switching sources
  it('should update UI correctly when switching between sources', async function() {
    // Open settings
    await openSettings();
    
    // Check initial state (should be MyMasjid from previous test)
    const myMasjidSettings = await driver.findElement(By.id('mymasjid-settings'));
    const aladhanSettings = await driver.findElement(By.id('aladhan-settings'));
    
    // Verify MyMasjid settings are visible
    assert.strictEqual(
      await myMasjidSettings.isDisplayed(), 
      true, 
      'MyMasjid settings should be visible initially'
    );
    
    assert.strictEqual(
      await aladhanSettings.isDisplayed(), 
      false, 
      'Aladhan settings should be hidden initially'
    );
    
    // Switch to Aladhan
    await driver.findElement(By.id('source-aladhan')).click();
    
    // Wait for animation
    await driver.sleep(500);
    
    // Verify Aladhan settings are now visible and MyMasjid settings are hidden
    assert.strictEqual(
      await myMasjidSettings.isDisplayed(), 
      false, 
      'MyMasjid settings should be hidden after switch'
    );
    
    assert.strictEqual(
      await aladhanSettings.isDisplayed(), 
      true, 
      'Aladhan settings should be visible after switch'
    );
    
    // Switch back to MyMasjid
    await driver.findElement(By.id('source-mymasjid')).click();
    
    // Wait for animation
    await driver.sleep(500);
    
    // Verify MyMasjid settings are visible again
    assert.strictEqual(
      await myMasjidSettings.isDisplayed(), 
      true, 
      'MyMasjid settings should be visible after switching back'
    );
    
    assert.strictEqual(
      await aladhanSettings.isDisplayed(), 
      false, 
      'Aladhan settings should be hidden after switching back'
    );
    
    // Close settings without saving
    await driver.findElement(By.id('settings-cancel')).click();
  });
  
  // Test: Verify settings are preserved when switching sources
  it('should preserve settings when switching between sources', async function() {
    // Open settings
    await openSettings();
    
    // Select Aladhan source
    await driver.findElement(By.id('source-aladhan')).click();
    
    // Verify Aladhan settings are preserved from previous configuration
    const latitude = await driver.findElement(By.id('aladhan-latitude')).getAttribute('value');
    const longitude = await driver.findElement(By.id('aladhan-longitude')).getAttribute('value');
    const timezone = await driver.findElement(By.id('aladhan-timezone')).getAttribute('value');
    
    assert.strictEqual(parseFloat(latitude), aladhanSettings.latitude, 'Latitude should be preserved');
    assert.strictEqual(parseFloat(longitude), aladhanSettings.longitude, 'Longitude should be preserved');
    assert.strictEqual(timezone, aladhanSettings.timezone, 'Timezone should be preserved');
    
    // Switch to MyMasjid
    await driver.findElement(By.id('source-mymasjid')).click();
    
    // Verify MyMasjid settings are preserved
    const guildId = await driver.findElement(By.id('mymasjid-guild-id')).getAttribute('value');
    assert.strictEqual(guildId, myMasjidSettings.guildId, 'Guild ID should be preserved');
    
    // Close settings without saving
    await driver.findElement(By.id('settings-cancel')).click();
  });
}); 