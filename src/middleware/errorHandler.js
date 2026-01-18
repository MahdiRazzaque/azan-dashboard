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
