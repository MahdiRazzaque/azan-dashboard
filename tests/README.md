# Azan Dashboard Tests

This directory contains automated tests for the Azan Dashboard application.

## Prerequisites

Before running the tests, make sure you have the following installed:

1. Node.js and npm
2. Chrome browser
3. Required npm packages:
   - selenium-webdriver
   - chromedriver
   - mocha

You can install the required npm packages by running:

```bash
npm install --save-dev selenium-webdriver chromedriver mocha
```

## Running Tests

### 1. Start the Azan Dashboard Server

Before running the tests, make sure the Azan Dashboard server is running:

```bash
npm start
```

The server should be accessible at http://localhost:3000.

### 2. Run Tests

To run all tests, use the test runner script:

```bash
node tests/run-tests.js
```

To run a specific test file:

```bash
node tests/run-tests.js tests/source-switching.test.js
```

## Available Tests

### Source Switching Tests (`source-switching.test.js`)

These tests verify that users can switch between MyMasjid and Aladhan prayer time sources in the settings dashboard. The tests include:

1. Switching from MyMasjid to Aladhan source
2. Switching from Aladhan to MyMasjid source
3. Verifying UI updates correctly when switching sources
4. Ensuring settings are preserved when switching between sources

## Test Implementation Details

The tests use Selenium WebDriver to automate browser interactions. Each test:

1. Opens the settings modal
2. Navigates to the Prayer Time Source tab
3. Interacts with the source selection controls
4. Fills in and submits the appropriate form fields
5. Verifies the correct behavior and state changes

## Troubleshooting

If you encounter issues running the tests:

1. Make sure the server is running at http://localhost:3000
2. Verify that all dependencies are installed
3. Check that you're using a compatible version of Chrome with the installed chromedriver
4. If tests fail, check the console output for detailed error messages 