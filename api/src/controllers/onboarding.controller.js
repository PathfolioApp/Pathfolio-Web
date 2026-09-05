const onboardingService = require('../services/onboarding.service');
const authService = require('../services/auth.service');

class OnboardingController {
  async checkUsername(req, res, next) {
    try {
      const { username } = req.body;
      const result = await onboardingService.checkUsernameAvailability(username);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async verifyRollNumber(req, res, next) {
    try {
      const { rollNumber } = req.body;
      const result = await onboardingService.verifyRollNumber(rollNumber);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async register(req, res, next) {
    try {
      const student = await onboardingService.registerStudent(req.body);
      const session = await authService.register(await require('../models/studentStore').getStudentById(student.id));
      res.cookie('pf_session', session.token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 24 * 7, path: '/' });
      return res.status(201).json({
        success: true,
        message: 'Onboarding profile registered successfully.',
        data: session.student
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to complete registration.'
      });
    }
  }

  async complete(req, res, next) {
    try {
      const { studentId } = req.body;
      const result = await onboardingService.completeOnboarding(studentId);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to complete onboarding.'
      });
    }
  }
}

module.exports = new OnboardingController();
