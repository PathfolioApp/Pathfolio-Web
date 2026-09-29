const express = require('express');
const router = express.Router();
const onboardingController = require('./onboarding.controller');
const auth = require('../../shared/authenticate');

// Institutional email format + early duplicate detection (first onboarding step)
router.post('/check-email', (req, res, next) => onboardingController.checkEmail(req, res, next));

// Roll number verification (derived from the email; kept for review-stage checks)
router.post('/verify-roll-number', (req, res, next) => onboardingController.verifyRollNumber(req, res, next));

// Register student onboarding data (202 + verification email when strict mode is on)
router.post('/register', (req, res, next) => onboardingController.register(req, res, next));

// Consume an emailed verification token (strict mode only)
router.post('/verify-email', (req, res, next) => onboardingController.verifyEmail(req, res, next));

// Finalize onboarding status
router.post('/complete', auth, (req, res, next) => onboardingController.complete(req, res, next));

module.exports = router;
