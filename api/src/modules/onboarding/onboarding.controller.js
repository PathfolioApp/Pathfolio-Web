const onboardingService = require('./onboarding.service');
const authService = require('../auth/auth.service');

class OnboardingController {
  /** Early duplicate/format check on the institutional email (step 1 of onboarding). */
  async checkEmail(req, res, next) {
    try {
      const result = await onboardingService.checkEmail(req.body.email);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async verifyRollNumber(req, res, next) {
    try {
      const result = await onboardingService.verifyRollNumber(req.body.rollNumber);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async register(req, res, next) {
    try {
      const result = await onboardingService.registerStudent(req.body);

      // Strict mode holds the registration behind an emailed verification link.
      if (result.pendingVerification) {
        return res.status(202).json({ success: true, ...result });
      }

      const student = await require('../students/studentStore').getStudentById(result.id);
      const session = await authService.register(student);
      res.cookie('pf_session', session.token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 24 * 7, path: '/' });
      return res.status(201).json({
        success: true,
        message: 'Onboarding profile registered successfully.',
        data: session.student
      });
    } catch (error) {
      return res.status(error.statusCode || 400).json({
        success: false,
        message: error.message || 'Failed to complete registration.'
      });
    }
  }

  /** Consume an emailed verification token; signs the student in on success. */
  async verifyEmail(req, res, next) {
    try {
      const result = await onboardingService.verifyEmailToken(req.body.token);
      if (result.success && result.student) {
        const student = await require('../students/studentStore').getStudentById(result.student.id);
        const session = await authService.register(student);
        res.cookie('pf_session', session.token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 24 * 7, path: '/' });
      }
      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      return res.status(error.statusCode || 400).json({ success: false, message: error.message || 'Email verification failed.' });
    }
  }

  async complete(req, res, next) {
    try {
      const result = await onboardingService.completeOnboarding(req.student.id);
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
