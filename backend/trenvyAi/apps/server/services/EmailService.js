import nodemailer from "nodemailer";

/**
 * Sends signup verification OTP email
 * @param {string} email - Recipient's email address
 * @param {string} name - Recipient's name
 * @param {string|number} otp - One-time password for verification
 */
export async function sendSignupOTP(email, name, otp) {
    try {
        // Create SMTP transporter
        const transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 465, // 465 for SSL
            secure: true,
            auth: {
                user: process.env.SMTP_USER, // sender email
                pass: process.env.SMTP_PASS, // app password or SMTP key
            },
        });

        // Email template
        const mailOptions = {
            from: `"Trenvy Support" <${process.env.SMTP_USER}>`,
            to: email,
            subject: "Verify your email - Trenvy Signup",
            html: `
        <div style="font-family: Arial, sans-serif; background-color: #f9fafb; padding: 30px;">
          <div style="max-width: 600px; margin: 0 auto; background: white; padding: 25px; border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #333;">Hello ${name}</h2>
            <p style="font-size: 15px; color: #555;">
              Thank you for signing up with <strong>Trenvy</strong>! To complete your registration,
              please verify your email using the OTP below:
            </p>

            <div style="text-align: center; margin: 30px 0;">
              <div style="font-size: 28px; font-weight: bold; color: #007bff; letter-spacing: 3px;">
                ${otp}
              </div>
            </div>

            <p style="font-size: 14px; color: #666;">
              This OTP will expire in <strong>10 minutes</strong>. Please do not share it with anyone for security reasons.
            </p>

            <hr style="margin: 25px 0; border: none; border-top: 1px solid #eee;" />
            <p style="font-size: 12px; color: #aaa; text-align: center;">
              © ${new Date().getFullYear()} Trenvy. All rights reserved.
            </p>
          </div>
        </div>
      `,
        };

        // Send the email
        const info = await transporter.sendMail(mailOptions);
        console.log(`Signup OTP email sent to ${email}: ${info.messageId}`);
        return info;
    } catch (error) {
        console.error("Error sending signup OTP email:", error);
        throw new Error("Email sending failed");
    }
}

/**
 * Sends password reset OTP email
 * @param {string} email - Recipient's email address
 * @param {string|number} otp - One-time password for password reset
 */
export async function resetPasswordOTP(email, otp) {
    try {
        // Create SMTP transporter
        const transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 465, // 465 for SSL
            secure: true,
            auth: {
                user: process.env.SMTP_USER, // sender email
                pass: process.env.SMTP_PASS, // app password or SMTP key
            },
        });

        // Email template
        const mailOptions = {
            from: `"Trenvy Support" <${process.env.SMTP_USER}>`,
            to: email,
            subject: "Reset Your Password - Trenvy",
            html: `
        <div style="font-family: Arial, sans-serif; background-color: #f9fafb; padding: 30px;">
          <div style="max-width: 600px; margin: 0 auto; background: white; padding: 25px; border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #333;">Password Reset Request</h2>
            <p style="font-size: 15px; color: #555;">
              We received a request to reset your password for your <strong>Trenvy</strong> account.
              Use the OTP below to proceed with resetting your password:
            </p>

            <div style="text-align: center; margin: 30px 0;">
              <div style="font-size: 28px; font-weight: bold; color: #dc3545; letter-spacing: 3px;">
                ${otp}
              </div>
            </div>

            <p style="font-size: 14px; color: #666;">
              This OTP will expire in <strong>10 minutes</strong>. Please do not share it with anyone for security reasons.
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

        // Send the email
        const info = await transporter.sendMail(mailOptions);
        console.log(`Password reset OTP email sent to ${email}: ${info.messageId}`);
        return info;
    } catch (error) {
        console.error("Error sending password reset OTP email:", error);
        throw new Error("Email sending failed");
    }
}

/**
 * Sends email change verification email with secure token link
 * @param {string} email - New email address to verify
 * @param {string} name - User's name
 * @param {string} token - Secure verification token
 * @param {string} changeId - Email change request ID
 */
export async function sendEmailChangeVerification(email, name, token, changeId) {
    try {
        // Create SMTP transporter
        const transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 465,
            secure: true,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        // Build verification link
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const verificationLink = `${frontendUrl}/confirm-email?token=${token}&id=${changeId}`;

        // Email template
        const mailOptions = {
            from: `"Trenvy Support" <${process.env.SMTP_USER}>`,
            to: email,
            subject: "Verify Your New Email Address - Trenvy",
            html: `
        <div style="font-family: Arial, sans-serif; background-color: #f9fafb; padding: 30px;">
          <div style="max-width: 600px; margin: 0 auto; background: white; padding: 25px; border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #333;">Verify Your New Email Address</h2>
            <p style="font-size: 15px; color: #555;">
              Hello <strong>${name || 'there'}</strong>,
            </p>
            <p style="font-size: 15px; color: #555;">
              We received a request to change your email address for your <strong>Trenvy</strong> account.
              To complete this change, please verify your new email address by clicking the button below:
            </p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationLink}" 
                 style="background-color: #007bff; color: white; padding: 14px 28px; text-decoration: none; 
                        border-radius: 5px; font-size: 16px; font-weight: bold; display: inline-block;">
                Verify New Email
              </a>
            </div>

            <p style="font-size: 14px; color: #666;">
              Or copy and paste this link into your browser:
            </p>
            <p style="font-size: 13px; color: #007bff; word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 5px;">
              ${verificationLink}
            </p>

            <p style="font-size: 14px; color: #666; margin-top: 25px;">
              This verification link will expire in <strong>1 hour</strong>. For security reasons, please do not share this link with anyone.
            </p>

            <p style="font-size: 14px; color: #666; margin-top: 20px;">
              If you did not request this email change, please ignore this email or contact our support team immediately.
            </p>

            <hr style="margin: 25px 0; border: none; border-top: 1px solid #eee;" />
            <p style="font-size: 12px; color: #aaa; text-align: center;">
              © ${new Date().getFullYear()} Trenvy. All rights reserved.
            </p>
          </div>
        </div>
      `,
        };

        // Send the email
        const info = await transporter.sendMail(mailOptions);
        console.log(`Email change verification sent to ${email}: ${info.messageId}`);
        return info;
    } catch (error) {
        console.error("Error sending email change verification:", error);
        throw new Error("Email verification sending failed");
    }
}

/**
 * Sends notification to old email when email is successfully changed
 * @param {string} oldEmail - Previous email address
 * @param {string} newEmail - New email address (masked)
 * @param {string} name - User's name
 */
export async function sendEmailChangeNotification(oldEmail, newEmail, name) {
    try {
        // Create SMTP transporter
        const transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 465,
            secure: true,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        // Mask new email for security (show first 2 chars and domain)
        const maskedEmail = newEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3');

        // Email template
        const mailOptions = {
            from: `"Trenvy Support" <${process.env.SMTP_USER}>`,
            to: oldEmail,
            subject: "Your Email Address Has Been Changed - Trenvy",
            html: `
        <div style="font-family: Arial, sans-serif; background-color: #f9fafb; padding: 30px;">
          <div style="max-width: 600px; margin: 0 auto; background: white; padding: 25px; border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #333;">Email Address Changed</h2>
            <p style="font-size: 15px; color: #555;">
              Hello <strong>${name || 'there'}</strong>,
            </p>
            <p style="font-size: 15px; color: #555;">
              This is a confirmation that the email address for your <strong>Trenvy</strong> account has been successfully changed.
            </p>

            <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 5px 0; font-size: 14px; color: #555;">
                <strong>Previous Email:</strong> ${oldEmail}
              </p>
              <p style="margin: 5px 0; font-size: 14px; color: #555;">
                <strong>New Email:</strong> ${maskedEmail}
              </p>
              <p style="margin: 5px 0; font-size: 14px; color: #555;">
                <strong>Changed On:</strong> ${new Date().toLocaleString()}
              </p>
            </div>

            <p style="font-size: 14px; color: #dc3545; margin-top: 25px;">
              <strong>⚠️ If you did not make this change:</strong>
            </p>
            <p style="font-size: 14px; color: #666;">
              Please contact our support team immediately at <a href="mailto:${process.env.SMTP_USER}" style="color: #007bff;">${process.env.SMTP_USER}</a>. 
              Your account security may be compromised.
            </p>

            <hr style="margin: 25px 0; border: none; border-top: 1px solid #eee;" />
            <p style="font-size: 12px; color: #aaa; text-align: center;">
              © ${new Date().getFullYear()} Trenvy. All rights reserved.
            </p>
          </div>
        </div>
      `,
        };

        // Send the email
        const info = await transporter.sendMail(mailOptions);
        console.log(`Email change notification sent to ${oldEmail}: ${info.messageId}`);
        return info;
    } catch (error) {
        console.error("Error sending email change notification:", error);
        // Don't throw error - notification failure shouldn't block the process
        console.warn("Failed to send notification to old email, but email change completed");
    }
}

