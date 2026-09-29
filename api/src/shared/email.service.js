/**
 * Transactional email delivery via SMTP (nodemailer).
 *
 * Credentials come exclusively from environment variables — they are never
 * hardcoded and never sent to the frontend. When SMTP is not configured the
 * service reports `configured: false` so callers can degrade gracefully
 * (strict verification refuses to issue tokens instead of silently skipping).
 */
let transporter = null;

function getTransporter(config) {
  if (!transporter) {
    const nodemailer = require('nodemailer');
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: { user: config.smtp.user, pass: config.smtp.password }
    });
  }
  return transporter;
}

class EmailService {
  isConfigured(config) { return Boolean(config?.smtp?.configured); }

  async sendVerificationEmail(config, { to, rollNumber, token }) {
    if (!this.isConfigured(config)) {
      const error = new Error('Email delivery is not configured on the server.');
      error.statusCode = 503;
      throw error;
    }
    const from = config.smtp.from || config.smtp.user;
    const minutes = config.emailVerificationTokenTtlMinutes;
    const url = `${(config.clientOrigin || '').replace(/\/$/, '')}/verify-email?token=${encodeURIComponent(token)}`;
    await getTransporter(config).sendMail({
      from,
      to,
      subject: 'Verify your PathfolioApp account',
      text: [
        'Welcome to PathfolioApp.',
        '',
        `Confirm this email address belongs to roll number ${rollNumber} by opening the link below.`,
        `The link expires in ${minutes} minute(s).`,
        '',
        url,
        '',
        'If you did not start this registration you can ignore this email.'
      ].join('\n'),
      html: [
        '<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;padding:24px">',
        '<h2 style="color:#264e36">Verify your PathfolioApp account</h2>',
        `<p>Confirm this email address belongs to roll number <b>${rollNumber}</b> by opening the link below.</p>`,
        `<p style="margin:24px 0"><a href="${url}" style="background:#264e36;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none">Verify my email</a></p>`,
        `<p style="color:#687">The link expires in ${minutes} minute(s). If you did not start this registration you can ignore this email.</p>`,
        '</div>'
      ].join('\n')
    });
    return { sent: true, url };
  }
}

module.exports = new EmailService();
