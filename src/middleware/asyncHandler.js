/**
 * Asynchronous handler utility that wraps Express route handlers to capture 
 * unhandled promise rejections. Captured errors are automatically passed 
 * to the next middleware in the stack for global error processing.
 * 
 * @param {Function} fn - The asynchronous function or route handler to be wrapped.
 * @returns {Function} An Express middleware function that manages asynchronous execution.
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
