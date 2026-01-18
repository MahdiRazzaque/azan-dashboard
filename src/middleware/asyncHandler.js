/**
 * Async handler utility to wrap async route handlers and catch errors.
 * Passes errors to Express next() for global error handling.
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
