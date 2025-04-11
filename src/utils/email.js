const nodemailer = require('nodemailer');
const config = require('../config/config');

class Email {
  constructor(user, url) {
    this.to = user.email;
    this.firstName = user.name.split(' ')[0];
    this.url = url;
    this.from = config.email.from;
  }

  newTransport() {
    return nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      auth: {
        user: config.email.username,
        pass: config.email.password,
      },
    });
  }

  // Send the actual email
  async send(subject, html) {
    // Define email options
    const mailOptions = {
      from: this.from,
      to: this.to,
      subject,
      html,
    };

    // Create a transport and send email
    await this.newTransport().sendMail(mailOptions);
  }

  // Send welcome email
  async sendWelcome() {
    const subject = 'Welcome to OpsFlow!';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to OpsFlow, ${this.firstName}!</h2>
        <p>We're excited to have you on board. OpsFlow is a powerful project management and productivity tool designed to help you and your team work more efficiently.</p>
        <p>To get started, please click the button below to log in to your account:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${this.url}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Log In to OpsFlow</a>
        </div>
        <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
        <p>Best regards,<br>The OpsFlow Team</p>
      </div>
    `;

    await this.send(subject, html);
  }

  // Send password reset email
  async sendPasswordReset() {
    const subject = 'Your password reset token (valid for 10 minutes)';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Reset Your Password</h2>
        <p>Hello ${this.firstName},</p>
        <p>We received a request to reset your password. Click the button below to create a new password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${this.url}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Reset Password</a>
        </div>
        <p>If you didn't request a password reset, please ignore this email or contact our support team if you have concerns.</p>
        <p>This password reset link is only valid for 10 minutes.</p>
        <p>Best regards,<br>The OpsFlow Team</p>
      </div>
    `;

    await this.send(subject, html);
  }
}

module.exports = Email;