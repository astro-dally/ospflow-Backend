const nodemailer = require("nodemailer")
const logger = require("../config/logger")
const config = require("../config/config")

// Create email transport
const createTransport = () => {
  // For development/testing, use ethereal.email if regular SMTP fails
  if (config.nodeEnv === "development" && process.env.USE_ETHEREAL === "true") {
    console.log("Using Ethereal Email for development")
    return createTestAccount()
  }

  const transportConfig = {
    host: config.email.host,
    port: Number.parseInt(config.email.port),
    secure: Number.parseInt(config.email.port) === 465, // true for 465, false for other ports
    auth: {
      user: config.email.username,
      pass: config.email.password,
    },
    // Add debug options for troubleshooting
    debug: config.nodeEnv === "development",
    logger: config.nodeEnv === "development",
  }

  console.log("Email transport config:", {
    host: transportConfig.host,
    port: transportConfig.port,
    secure: transportConfig.secure,
    auth: { user: transportConfig.auth.user },
  })

  return nodemailer.createTransport(transportConfig)
}

// Create a test account on ethereal.email (for development only)
const createTestAccount = async () => {
  try {
    const testAccount = await nodemailer.createTestAccount()
    console.log("Created Ethereal test account:", testAccount.user)

    return nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    })
  } catch (error) {
    console.error("Failed to create test account:", error)
    throw error
  }
}

// Verify email connection
const verifyConnection = async () => {
  try {
    const transport = await createTransport()
    await transport.verify()
    logger.info("Connected to email server")
    return true
  } catch (error) {
    logger.warn("Unable to connect to email server:", error)
    console.error("Email connection error details:", error)
    return false
  }
}

// Send generic email
exports.sendEmail = async (to, subject, html) => {
  try {
    const transport = await createTransport()
    const msg = {
      from: `OpsFlow <${config.email.from || transport.options.auth.user}>`,
      to,
      subject,
      html,
    }

    console.log(`Attempting to send email to ${to} with subject: ${subject}`)
    const info = await transport.sendMail(msg)
    logger.info(`Email sent: ${info.messageId}`)
    console.log(`Email sent successfully to ${to}, messageId: ${info.messageId}`)

    // If using Ethereal, provide the preview URL
    if (info.ethereal) {
      console.log(`Ethereal Email Preview URL: ${nodemailer.getTestMessageUrl(info)}`)
    }

    return info
  } catch (error) {
    logger.error("Error sending email:", error)
    console.error("Failed to send email:", error)
    throw new Error(`Failed to send email: ${error.message}`)
  }
}

// Send welcome email
exports.sendWelcome = async (user, url) => {
  const subject = "Welcome to OpsFlow!"
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <h2 style="color: #333;">Welcome to OpsFlow!</h2>
      <p>Hello ${user.name},</p>
      <p>Thank you for joining OpsFlow. We're excited to have you on board!</p>
      <p>You can now log in to your account and start managing your projects and tasks.</p>
      <div style="margin: 30px 0;">
        <a href="${url}" style="background-color: #4CAF50; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Login to Your Account</a>
      </div>
      <p>If you have any questions, feel free to contact our support team.</p>
      <p>Best regards,<br>The OpsFlow Team</p>
    </div>
  `

  return await this.sendEmail(user.email, subject, html)
}

// Send password reset email
exports.sendPasswordReset = async (user, url) => {
  const subject = "OpsFlow - Reset your password"
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <h2 style="color: #333;">Reset Your Password</h2>
      <p>Hello ${user.name},</p>
      <p>You requested to reset your password. Click the button below to set a new password:</p>
      <div style="margin: 30px 0;">
        <a href="${url}" style="background-color: #4CAF50; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Reset Your Password</a>
      </div>
      <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
      <p>This link is valid for 10 minutes.</p>
      <p>Best regards,<br>The OpsFlow Team</p>
    </div>
  `

  return await this.sendEmail(user.email, subject, html)
}

// Send invitation email
exports.sendInvitation = async (user, url, inviterName, companyName = "OpsFlow") => {
  const subject = `${inviterName} invited you to join ${companyName} on OpsFlow`
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <h2 style="color: #333;">You've Been Invited!</h2>
      <p>Hello ${user.name || user.email},</p>
      <p><strong>${inviterName}</strong> has invited you to join <strong>${companyName}</strong> on OpsFlow.</p>
      <p>OpsFlow is a project management platform that helps teams collaborate effectively and track progress in real-time.</p>
      <div style="margin: 30px 0;">
        <a href="${url}" style="background-color: #4CAF50; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Accept Invitation</a>
      </div>
      <p>This invitation will expire in 7 days.</p>
      <p>Best regards,<br>The OpsFlow Team</p>
    </div>
  `

  return await this.sendEmail(user.email, subject, html)
}

// For development: Log invitation details instead of sending email
exports.logInvitationForDevelopment = (user, url, inviterName) => {
  console.log("\n========== INVITATION EMAIL (DEVELOPMENT MODE) ==========")
  console.log(`To: ${user.email}`)
  console.log(`From: OpsFlow Team`)
  console.log(`Subject: ${inviterName} invited you to join OpsFlow`)
  console.log(`Invitation URL: ${url}`)
  console.log("==========================================================\n")

  return {
    messageId: `dev-${Date.now()}`,
    development: true,
  }
}

// Modified controller method to handle email failures gracefully
exports.sendInvitationWithFallback = async (user, url, inviterName, companyName = "OpsFlow") => {
  try {
    return await this.sendInvitation(user, url, inviterName, companyName)
  } catch (error) {
    console.warn("Email sending failed, using development fallback:", error.message)
    return this.logInvitationForDevelopment(user, url, inviterName)
  }
}

// Initialize email service
if (process.env.NODE_ENV !== "test") {
  verifyConnection().then((success) => {
    if (!success) {
      console.warn("Email service is not properly configured. Using development fallback for emails.")
      if (config.nodeEnv === "development") {
        console.log("TIP: Set USE_ETHEREAL=true in your environment to use Ethereal for test emails")
      }
    }
  })
}
