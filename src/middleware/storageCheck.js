const storageService = require("@services/system/storageService");

/**
 * Middleware to check if an incoming file upload would exceed the storage quota.
 * Uses the Content-Length header for a pre-check before Multer processes the file.
 *
 * @param {import('express').Request} req - The Express request object.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The next middleware function.
 * @returns {Promise<void|import('express').Response>} A promise that resolves when the check is complete.
 */
const storageCheck = async (req, res, next) => {
  const contentLength = parseInt(req.headers["content-length"], 10);

  if (isNaN(contentLength)) {
    // If content length is missing, we can't do a pre-check.
    // We'll let Multer handle it via its own limits, but this is less ideal.
    return next();
  }

  try {
    const quotaCheck = await storageService.checkQuota(contentLength);

    if (!quotaCheck.success) {
      console.warn(
        `[StorageCheck] Quota exceeded for request: ${contentLength} bytes. Rejecting with 413.`,
      );
      // Sending 'Connection: close' can help prevent ERR_CONNECTION_RESET
      // by telling the client we are stopping the request.
      res.set("Connection", "close");
      return res.status(413).json({
        error: "Storage Limit Exceeded",
        message:
          quotaCheck.message ||
          "The uploaded file would exceed the storage quota.",
      });
    }

    next();
  } catch (error) {
    console.error("[StorageCheck] Error during quota check:", error);
    // Default to allowing the request if the check fails internally,
    // to avoid blocking all uploads if the service has an issue.
    next();
  }
};

module.exports = storageCheck;
