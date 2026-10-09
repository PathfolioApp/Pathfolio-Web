const express = require('express');
const router = express.Router();
const onboardingController = require('./onboarding.controller');
const auth = require('../../shared/authenticate');
const rateLimit = require('../../shared/rateLimit');

// Registration is the spammable public surface (creates accounts, may send
// verification email); keep it to a modest per-IP ceiling.
const registerLimiter = rateLimit({ windowMs: 60 * 60_000, max: 10, message: 'Too many registration attempts from this network. Please try again later.' });
const checkLimiter = rateLimit({ windowMs: 60_000, max: 20, message: 'Too many availability checks. Please slow down.' });

// Institutional email format + early duplicate detection (first onboarding step)
router.post('/check-email', checkLimiter, (req, res, next) => onboardingController.checkEmail(req, res, next));

// Roll number verification (derived from the email; kept for review-stage checks)
router.post('/verify-roll-number', (req, res, next) => onboardingController.verifyRollNumber(req, res, next));

// Register student onboarding data (202 + verification email when strict mode is on)
router.post('/register', registerLimiter, (req, res, next) => onboardingController.register(req, res, next));

// Consume an emailed verification token (strict mode only)
router.post('/verify-email', (req, res, next) => onboardingController.verifyEmail(req, res, next));

// Finalize onboarding status
router.post('/complete', auth, (req, res, next) => onboardingController.complete(req, res, next));

module.exports = router;
