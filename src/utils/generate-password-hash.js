import crypto from 'crypto';
import { promisify } from 'util';
import * as dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import readline from 'readline';

// Load environment variables
dotenv.config();

// Create readline interface for input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Promisify the pbkdf2 function from crypto
const pbkdf2 = promisify(crypto.pbkdf2);

// Hash a password using PBKDF2 (more secure than SHA-256)
async function hashPassword(password) {
    const salt = process.env.SALT || crypto.randomBytes(16).toString('hex');
    const iterations = 10000; // Recommended minimum
    const keylen = 64;
    const digest = 'sha512';
    
    const derivedKey = await pbkdf2(password, salt, iterations, keylen, digest);
    return derivedKey.toString('hex');
}

// Main function to generate password hash
async function generatePasswordHash() {
    console.log('Starting password hash generation...');
    console.log('Waiting for password input...');
    
    // Use a promise to handle the readline flow
    return new Promise((resolve, reject) => {
        // Ask for the password
        rl.question('Enter the password to hash: ', async (password) => {
            try {
                console.log('Password received, generating hash...');
                // Generate the hash
                const hashedPassword = await hashPassword(password);
                console.log('\nPassword hash generated successfully!');
                console.log('\n===== GENERATED HASH =====');
                console.log(hashedPassword);
                console.log('==========================\n');
                console.log('Instructions:');
                console.log('1. Update your ADMIN_PASSWORD_HASH environment variable with this hash');
                console.log('2. Make sure your SALT environment variable is set (or a new one will be generated)');
                console.log('3. Restart your application for changes to take effect');
                
                // Close the readline interface
                rl.close();
                resolve();
            } catch (error) {
                console.error('Error generating password hash:', error);
                rl.close();
                reject(error);
            }
        });
    });
}

// Run the generator
console.log('Password hash generator starting...');
generatePasswordHash()
    .then(() => console.log('Password hash generator completed successfully.'))
    .catch(err => console.error('Password hash generator failed:', err));
