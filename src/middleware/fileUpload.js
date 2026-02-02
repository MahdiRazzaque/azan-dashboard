const multer = require('multer');
const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = path.join(__dirname, '../../public/audio/custom');

// Ensure directory exists at module level to avoid repeated I/O in request path
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Multer configuration for handling custom audio file uploads.
 * Files are saved to public/audio/custom.
 */
const storage = multer.diskStorage({
    /**
     * Determines the destination directory for uploaded files.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {Object} file - The file object provided by Multer.
     * @param {Function} cb - The callback function to signal the destination.
     * @returns {void}
     */
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    /**
     * Determines the filename for the uploaded file.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {Object} file - The file object provided by Multer.
     * @param {Function} cb - The callback function to signal the filename.
     * @returns {void}
     */
    filename: (req, file, cb) => {
        // Sanitise the filename to prevent path traversal and ensure compatibility
        const baseName = path.basename(file.originalname);
        const safeName = baseName.replace(/[^a-z0-9.]/gi, '_');
        cb(null, safeName);
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    /**
     * Filters files based on their type and extension.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {Object} file - The file object provided by Multer.
     * @param {Function} cb - The callback function to signal acceptance or rejection.
     * @returns {void}
     */
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'audio/mpeg' || file.originalname.endsWith('.mp3')) {
            cb(null, true);
        } else {
            cb(new Error('Only mp3 files allowed'));
        }
    }
});

module.exports = upload;