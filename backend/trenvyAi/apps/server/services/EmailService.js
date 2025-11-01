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
