const express = require("express");
const router = express.Router();
const asyncHandler = require("@middleware/asyncHandler");
const authController = require("@controllers/authController");
const { securityLimiter } = require("@middleware/rateLimiters");
const authenticateToken = require("@middleware/auth");

router.get("/status", asyncHandler(authController.checkStatus));
router.post("/setup", securityLimiter, asyncHandler(authController.setup));
router.post(
  "/change-password",
  securityLimiter,
  authenticateToken,
  asyncHandler(authController.changePassword),
);
router.post("/login", securityLimiter, asyncHandler(authController.login));
router.post("/logout", asyncHandler(authController.logout));
router.get("/check", authenticateToken, asyncHandler(authController.checkAuth));

module.exports = router;
