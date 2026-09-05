const onboardingService = require('../services/onboarding.service');

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
      return res.status(201).json({
        success: true,
        message: 'Onboarding profile registered successfully.',
        data: student
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
