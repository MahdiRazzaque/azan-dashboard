/**
 * Global error handling middleware for Express.
 * Formats error responses and logs errors to the console in non-test environments.
 * 
 * @param {Error|Object} err - The error object.
 * @param {import('express').Request} req - The Express request object.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The next middleware function.
 * @returns {void}
 */
const errorHandler = (err, req, res, next) => {
    const status = err.status || (err.response ? err.response.status : 500);
    const message = err.message || 'Internal Server Error';
    
    // Log error for debugging
    if (process.env.NODE_ENV !== 'test') {
        console.error(`[API Error] ${req.method} ${req.path}:`, message);
        if (err.stack && process.env.NODE_ENV === 'development') {
            console.error(err.stack);
        }
    }

    res.status(status).json({
        success: false,
        error: message
    });
};

module.exports = errorHandler;
