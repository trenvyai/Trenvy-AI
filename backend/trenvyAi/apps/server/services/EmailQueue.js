import nodemailer from 'nodemailer';

/**
 * Email Queue Service
 * In production, this should use BullMQ for async processing
 * For now, we'll implement a simple async wrapper
 */

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Enqueue password reset email
 */
export async function enqueuePasswordResetEmail({ email, name, tokenId, rawToken }) {
  // In production, add this to BullMQ queue
  // For now, send async without blocking
  setImmediate(async () => {
    try {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const resetLink = `${frontendUrl}/reset-password?tokenId=${tokenId}&token=${rawToken}`;

      const mailOptions = {
        from: `"Trenvy Support" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'Reset Your Password - Trenvy',
        html: `
          <div style="font-family: Arial, sans-serif; background-color: #f9fafb; padding: 30px;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 25px; border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
              <h2 style="color: #333;">Password Reset Request</h2>
              <p style="font-size: 15px; color: #555;">
                Hello ${name || 'there'},
              </p>
              <p style="font-size: 15px; color: #555;">
                We received a request to reset your password for your <strong>Trenvy</strong> account.
                Click the button below to reset your password:
              </p>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" 
                   style="background-color: #dc3545; color: white; padding: 14px 28px; text-decoration: none; 
                          border-radius: 5px; font-size: 16px; font-weight: bold; display: inline-block;">
                  Reset Password
                </a>
              </div>

              <p style="font-size: 14px; color: #666;">
                Or copy and paste this link into your browser:
              </p>
              <p style="font-size: 13px; color: #007bff; word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 5px;">
                ${resetLink}
              </p>

              <p style="font-size: 14px; color: #666; margin-top: 25px;">
                This link will expire in <strong>15 minutes</strong>. For security reasons, please do not share this link with anyone.
              </p>

              <p style="font-size: 14px; color: #666; margin-top: 20px;">
                If you did not request a password reset, please ignore this email or contact support if you have concerns.
              </p>

              <hr style="margin: 25px 0; border: none; border-top: 1px solid #eee;" />
              <p style="font-size: 12px; color: #aaa; text-align: center;">
                © ${new Date().getFullYear()} Trenvy. All rights reserved.
              </p>
            </div>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log(`Password reset email sent to ${email}`);
    } catch (error) {
      console.error('Error sending password reset email:', error);
      // In production, this would retry via BullMQ
    }
  });
}

/**
 * Enqueue password changed notification email
 */
export async function enqueuePasswordChangedEmail({ email, ip, timestamp }) {
  setImmediate(async () => {
    try {
      const mailOptions = {
        from: `"Trenvy Support" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'Your Password Has Been Changed - Trenvy',
        html: `
          <div style="font-family: Arial, sans-serif; background-color: #f9fafb; padding: 30px;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 25px; border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
              <h2 style="color: #333;">Password Changed Successfully</h2>
              <p style="font-size: 15px; color: #555;">
                This is a confirmation that your <strong>Trenvy</strong> account password has been changed.
              </p>

              <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p style="margin: 5px 0; font-size: 14px; color: #555;">
                  <strong>Changed At:</strong> ${new Date(timestamp).toLocaleString()}
                </p>
                <p style="margin: 5px 0; font-size: 14px; color: #555;">
                  <strong>IP Address:</strong> ${ip}
                </p>
              </div>

              <p style="font-size: 14px; color: #dc3545; margin-top: 25px;">
                <strong>⚠️ If you did not make this change:</strong>
              </p>
              <p style="font-size: 14px; color: #666;">
                Please contact our support team immediately. Your account security may be compromised.
              </p>

              <hr style="margin: 25px 0; border: none; border-top: 1px solid #eee;" />
              <p style="font-size: 12px; color: #aaa; text-align: center;">
                © ${new Date().getFullYear()} Trenvy. All rights reserved.
              </p>
            </div>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log(`Password changed notification sent to ${email}`);
    } catch (error) {
      console.error('Error sending password changed email:', error);
    }
  });
}
