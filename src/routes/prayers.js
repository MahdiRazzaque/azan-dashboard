const express = require("express");
const router = express.Router();
const asyncHandler = require("@middleware/asyncHandler");
const prayerController = require("@controllers/prayerController");

router.get("/", asyncHandler(prayerController.getPrayers));

module.exports = router;
