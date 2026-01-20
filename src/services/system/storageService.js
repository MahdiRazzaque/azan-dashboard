const fs = require('fs');
const path = require('path');
const checkDiskSpace = require('check-disk-space').default;
const configService = require('@config');

const AUDIO_DIR = path.join(__dirname, '../../public/audio');
const CUSTOM_DIR = path.join(AUDIO_DIR, 'custom');
const CACHE_DIR = path.join(AUDIO_DIR, 'cache');

/**
 * Service for managing storage usage and quotas.
 */
const storageService = {
    /**
     * Recursively calculate directory size in bytes.
     * @param {string} dirPath 
     * @returns {number}
     */
    /**
     * Recursively calculate directory size in bytes.
     * Uses lstatSync to avoid following symlinks (prevents infinite recursion).
     * @param {string} dirPath 
     * @param {Set<string>} visitedPaths
     * @returns {number}
     */
    getDirSize(dirPath, visitedPaths = new Set()) {
        let size = 0;
        const realPath = path.resolve(dirPath);
        if (visitedPaths.has(realPath)) return 0;
        visitedPaths.add(realPath);

        try {
            if (!fs.existsSync(dirPath)) return 0;
            
            const files = fs.readdirSync(dirPath);
            for (const file of files) {
                const filePath = path.join(dirPath, file);
                try {
                    const stats = fs.lstatSync(filePath);
                    if (stats.isSymbolicLink()) {
                        continue; // Skip symlinks to avoid cross-device/circular issues
                    }
                    if (stats.isDirectory()) {
                        size += this.getDirSize(filePath, visitedPaths);
                    } else {
                        size += stats.size;
                    }
                } catch (statError) {
                    console.warn(`[StorageService] Could not lstat file: ${filePath}`, statError.message);
                }
            }
        } catch (dirError) {
            console.error(`[StorageService] Error reading directory: ${dirPath}`, dirError.message);
        }
        return size;
    },

    /**
     * Get current audio storage usage breakdown.
     * @returns {Promise<{total: number, custom: number, cache: number}>}
     */
    async getUsage() {
        const customSize = this.getDirSize(CUSTOM_DIR);
        const cacheSize = this.getDirSize(CACHE_DIR);
        
        return {
            total: customSize + cacheSize,
            custom: customSize,
            cache: cacheSize
        };
    },

    /**
     * Get system disk stats for the audio partition.
     * @returns {Promise<number|null>} Free space in bytes or null if failed.
     */
    async getSystemStats() {
        try {
            // Using AUDIO_DIR or current directory as reference
            const diskSpace = await checkDiskSpace(AUDIO_DIR);
            return diskSpace.free;
        } catch (error) {
            console.warn('[StorageService] Failed to get system disk stats:', error.message);
            return null;
        }
    },

    /**
     * Check if adding more bytes would exceed the configured quota.
     * @param {number} bytesToAdd 
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async checkQuota(bytesToAdd) {
        const config = configService.get();
        const limitGB = config.data?.storageLimit || 1.0;
        const limitBytes = limitGB * 1024 * 1024 * 1024;
        
        const usage = await this.getUsage();
        const totalAfter = usage.total + bytesToAdd;
        
        if (totalAfter > limitBytes) {
            return {
                success: false,
                message: 'Storage Limit Exceeded'
            };
        }
        
        return { success: true, message: 'Quota check passed' };
    },

    /**
     * Calculate a recommended storage limit based on active triggers.
     * @returns {number} Recommended limit in GB.
     */
    calculateRecommendedLimit() {
        const config = configService.get();
        const triggers = config.automation?.triggers;
        if (!triggers) return 0.5; // Base minimum

        let fileCount = 0;
        let ttsCount = 0;

        Object.values(triggers).forEach(prayerTriggers => {
            Object.values(prayerTriggers).forEach(event => {
                if (event.enabled) {
                    if (event.type === 'file') fileCount++;
                    else if (event.type === 'tts') ttsCount++;
                }
            });
        });

        // 0.5MB per file, 0.1MB per TTS (conservative)
        const estimatedBytes = (fileCount * 0.5 + ttsCount * 0.1) * 1024 * 1024;
        // Buffer of 2x + 100MB minimal
        const recommendedBytes = (estimatedBytes * 2) + (100 * 1024 * 1024);
        
        // Return rounded to 1 decimal place, minimum 0.5 GB
        const recommendedGB = Math.max(0.5, Math.ceil((recommendedBytes / (1024 * 1024 * 1024)) * 10) / 10);
        return recommendedGB;
    }
};

module.exports = storageService;
