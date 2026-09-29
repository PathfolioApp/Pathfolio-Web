const express = require('express');
const router = express.Router();
const onboardingController = require('./onboarding.controller');
const auth = require('../../shared/authenticate');

// Username availability check
router.post('/check-username', (req, res, next) => onboardingController.checkUsername(req, res, next));

// Roll number verification
router.post('/verify-roll-number', (req, res, next) => onboardingController.verifyRollNumber(req, res, next));

// Register student onboarding data
router.post('/register', (req, res, next) => onboardingController.register(req, res, next));

// Finalize onboarding status
router.post('/complete', auth, (req, res, next) => onboardingController.complete(req, res, next));

module.exports = router;
