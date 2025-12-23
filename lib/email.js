/**
 * HURE Core - Email Service
 * Transactional emails via Brevo (Sendinblue) API
 * 
 * Environment Variables:
 *   BREVO_API_KEY: Your Brevo API key (get from https://app.brevo.com/settings/keys/api)
 *   FROM_EMAIL: Sender email address (must be verified in Brevo)
 *   FROM_NAME: Sender name (default: 'HURE')
 *   APP_URL: Application URL for links in emails
 */

require('dotenv').config({ path: '.env.local' });

// Helper to get config at runtime (not module load time)
function getConfig() {
  return {
    BREVO_API_KEY: process.env.BREVO_API_KEY,
    FROM_EMAIL: process.env.FROM_EMAIL || 'theboysofficialone@gmail.com',
    FROM_NAME: process.env.FROM_NAME || 'HURE',
    APP_URL: process.env.APP_URL || 'http://localhost:5173'
  };
}

// ============================================
// EMAIL TEMPLATE
// ============================================

/**
 * Base email template wrapper with professional styling
 */
function emailTemplate(content) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
          line-height: 1.6; 
          color: #333; 
          background-color: #f5f5f5;
          margin: 0;
          padding: 0;
        }
        .wrapper {
          background-color: #f5f5f5;
          padding: 40px 20px;
        }
        .container { 
          max-width: 500px; 
          margin: 0 auto; 
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          overflow: hidden;
        }
        .header { 
          background: linear-gradient(135deg, #059669 0%, #047857 100%);
          padding: 30px;
          text-align: center; 
        }
        .logo { 
          color: white; 
          font-size: 28px; 
          font-weight: bold; 
          letter-spacing: 2px;
        }
        .content {
          padding: 30px;
        }
        .btn { 
          display: inline-block; 
          background: #059669; 
          color: white !important; 
          padding: 14px 32px; 
          text-decoration: none; 
          border-radius: 8px; 
          font-weight: 600;
          font-size: 16px;
          margin: 20px 0;
        }
        .code { 
          font-size: 36px; 
          letter-spacing: 10px; 
          color: #059669; 
          text-align: center; 
          padding: 25px; 
          background: #f0fdf4; 
          border-radius: 8px; 
          margin: 20px 0;
          font-weight: bold;
          font-family: 'Courier New', monospace;
        }
        .note { 
          color: #666; 
          font-size: 13px; 
        }
        .warning {
          background: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 8px;
          padding: 15px;
          margin: 20px 0;
          color: #92400e;
        }
        .alert {
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          padding: 15px;
          margin: 20px 0;
          color: #991b1b;
        }
        .success {
          background: #f0fdf4;
          border: 1px solid #86efac;
          border-radius: 8px;
          padding: 15px;
          margin: 20px 0;
          color: #166534;
        }
        .info-box {
          background: #f8fafc;
          border-radius: 8px;
          padding: 15px;
          margin: 20px 0;
        }
        .footer { 
          text-align: center; 
          color: #999; 
          font-size: 12px; 
          padding: 20px 30px 30px;
          border-top: 1px solid #eee;
        }
        .footer a {
          color: #059669;
          text-decoration: none;
        }
        h2 {
          margin-top: 0;
          color: #111;
        }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="container">
          <div class="header">
            <div class="logo">HURE</div>
          </div>
          <div class="content">
            ${content}
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} HURE - Healthcare Unified Resource Enterprise</p>
            <p><a href="${getConfig().APP_URL}">gethure.com</a></p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

// ============================================
// EMAIL FUNCTIONS
// ============================================

/**
 * Send OTP verification email
 * @param {string} to - Recipient email
 * @param {string} code - 6-digit OTP code
 * @param {string} clinicName - Clinic name for context
 */
async function sendOtpEmail(to, code, clinicName) {
  const subject = 'Your HURE Verification Code';

  const content = `
    <h2>Email Verification</h2>
    <p>Hello,</p>
    <p>Your verification code for <strong>${clinicName}</strong> is:</p>
    <div class="code">${code}</div>
    <p>This code is valid for <strong>15 minutes</strong>.</p>
    <p class="note">If you didn't request this code, please ignore this email.</p>
  `;

  return sendEmail(to, subject, emailTemplate(content));
}

/**
 * Send account activation email with first-login link
 * @param {string} to - Recipient email
 * @param {string} clinicName - Clinic name
 * @param {string} firstLoginUrl - First login URL with token
 */
async function sendActivationEmail(to, clinicName, firstLoginUrl) {
  const subject = '🎉 Your HURE Account is Now Active!';

  const content = `
    <h2>Welcome to HURE!</h2>
    <p>Hello,</p>
    <p>Great news! Your HURE account for <strong>${clinicName}</strong> has been activated.</p>
    <p>Click the button below to set up your account:</p>
    <p style="text-align: center;">
      <a href="${firstLoginUrl}" class="btn">Set Up Your Account</a>
    </p>
    <p class="note">This link expires in <strong>24 hours</strong>.</p>
    <p class="note">If the button doesn't work, copy and paste this link into your browser:</p>
    <p class="note" style="word-break: break-all;">${firstLoginUrl}</p>
  `;

  return sendEmail(to, subject, emailTemplate(content));
}

/**
 * Send payment success email
 * @param {string} to - Recipient email
 * @param {string} clinicName - Clinic name
 * @param {string} plan - Plan name
 * @param {number} amount - Amount paid
 * @param {string} currency - Currency code (default: KES)
 */
async function sendPaymentSuccessEmail(to, clinicName, plan, amount, currency = 'KES') {
  const subject = '✅ Payment Received - HURE';

  const content = `
    <h2>Payment Successful!</h2>
    <p>Hello,</p>
    <div class="success">
      <p>We've received your payment for <strong>${clinicName}</strong>.</p>
    </div>
    <div class="info-box">
      <p><strong>Plan:</strong> ${plan}</p>
      <p><strong>Amount:</strong> ${currency} ${amount.toLocaleString()}</p>
    </div>
    <p>Your account is now <strong>pending activation</strong>. We'll notify you once it's ready.</p>
  `;

  return sendEmail(to, subject, emailTemplate(content));
}

/**
 * Send suspension notification email
 * @param {string} to - Recipient email
 * @param {string} clinicName - Clinic name
 * @param {string} reason - Suspension reason
 */
async function sendSuspensionEmail(to, clinicName, reason) {
  const subject = '⚠️ Your HURE Account Has Been Suspended';

  const content = `
    <h2>Account Suspended</h2>
    <p>Hello,</p>
    <div class="alert">
      <p>Your HURE account for <strong>${clinicName}</strong> has been suspended.</p>
      ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
    </div>
    <p>If you believe this is an error, please contact our support team.</p>
    <p>Email: <a href="mailto:support@gethure.com">support@gethure.com</a></p>
  `;

  return sendEmail(to, subject, emailTemplate(content));
}

/**
 * Send trial ending reminder
 * @param {string} to - Recipient email
 * @param {string} clinicName - Clinic name
 * @param {number} daysLeft - Days remaining
 */
async function sendTrialEndingEmail(to, clinicName, daysLeft) {
  const subject = `⏰ Your HURE Trial Ends in ${daysLeft} Day${daysLeft > 1 ? 's' : ''}`;

  const content = `
    <h2>Trial Ending Soon</h2>
    <p>Hello,</p>
    <div class="warning">
      Your HURE trial for <strong>${clinicName}</strong> ends in <strong>${daysLeft} day${daysLeft > 1 ? 's' : ''}</strong>.
    </div>
    <p>To keep using HURE without interruption, please complete your subscription payment.</p>
    <p style="text-align: center;">
      <a href="${getConfig().APP_URL}/employer/settings" class="btn">Subscribe Now</a>
    </p>
  `;

  return sendEmail(to, subject, emailTemplate(content));
}

/**
 * Send staff invitation email
 * @param {string} to - Staff email
 * @param {string} staffName - Staff member name
 * @param {string} clinicName - Clinic name
 * @param {string} inviteUrl - Invitation link
 */
async function sendStaffInviteEmail(to, staffName, clinicName, inviteUrl) {
  const subject = `You're Invited to Join ${clinicName} on HURE`;

  const content = `
    <h2>You're Invited!</h2>
    <p>Hello ${staffName},</p>
    <p>You've been invited to join <strong>${clinicName}</strong> on HURE.</p>
    <p style="text-align: center;">
      <a href="${inviteUrl}" class="btn">Accept Invitation</a>
    </p>
    <p class="note">This invitation link expires in 7 days.</p>
  `;

  return sendEmail(to, subject, emailTemplate(content));
}

/**
 * Send password reset email
 * @param {string} to - Recipient email
 * @param {string} resetUrl - Password reset URL
 */
async function sendPasswordResetEmail(to, resetUrl) {
  const subject = 'Reset Your HURE Password';

  const content = `
    <h2>Password Reset</h2>
    <p>Hello,</p>
    <p>We received a request to reset your password. Click the button below to choose a new password:</p>
    <p style="text-align: center;">
      <a href="${resetUrl}" class="btn">Reset Password</a>
    </p>
    <p class="note">This link expires in <strong>1 hour</strong>.</p>
    <p class="note">If you didn't request a password reset, you can safely ignore this email.</p>
  `;

  return sendEmail(to, subject, emailTemplate(content));
}

// ============================================
// BREVO API - CORE EMAIL SENDING
// ============================================

/**
 * Send email via Brevo API
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - HTML content
 */
async function sendEmail(to, subject, html) {
  const config = getConfig();

  // Development mode - log if no API key
  if (!config.BREVO_API_KEY) {
    console.log('');
    console.log('📧 ═══════════════════════════════════════════════════════');
    console.log('   [DEV MODE - No BREVO_API_KEY Configured]');
    console.log('   ─────────────────────────────────────────────────────');
    console.log(`   To: ${to}`);
    console.log(`   Subject: ${subject}`);
    console.log('   ─────────────────────────────────────────────────────');
    console.log('   To enable email sending:');
    console.log('   1. Sign up at https://www.brevo.com');
    console.log('   2. Get API key from Settings > SMTP & API > API Keys');
    console.log('   3. Add BREVO_API_KEY to .env.local');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    return { success: true, dev: true };
  }

  try {
    console.log(`📧 Sending email via Brevo to ${to}: ${subject}`);
    console.log(`   From: ${config.FROM_NAME} <${config.FROM_EMAIL}>`);

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': config.BREVO_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        sender: {
          name: config.FROM_NAME,
          email: config.FROM_EMAIL
        },
        to: [{ email: to }],
        subject: subject,
        htmlContent: html
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Brevo API error:', data);
      return { success: false, error: data.message || 'Failed to send email' };
    }

    console.log(`✅ Email sent! Message ID: ${data.messageId}`);
    return { success: true, messageId: data.messageId };

  } catch (err) {
    console.error('❌ Email send error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Generate a 6-digit OTP code
 */
function generateOtpCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Email functions
  sendOtpEmail,
  sendActivationEmail,
  sendPaymentSuccessEmail,
  sendSuspensionEmail,
  sendTrialEndingEmail,
  sendStaffInviteEmail,
  sendPasswordResetEmail,
  sendEmail,

  // Utilities
  generateOtpCode,
  emailTemplate
};
