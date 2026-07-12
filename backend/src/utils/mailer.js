const nodemailer = require("nodemailer");

// Lazily built so a missing SMTP config doesn't crash the server at startup —
// it only matters the moment someone actually triggers an email.
let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true", // true for port 465, false for others
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
}

/**
 * Sends the superuser password-reset email. If SMTP isn't configured (e.g.
 * local dev), falls back to logging the link to the console so the flow can
 * still be tested end-to-end without real email credentials.
 */
async function sendPasswordResetEmail(toEmail, resetLink) {
  const t = getTransporter();

  if (!t) {
    console.warn(
      `[mailer] SMTP not configured — password reset link for ${toEmail}:\n${resetLink}`
    );
    return;
  }

  await t.sendMail({
    from: process.env.SMTP_FROM || "Mid-Term Reporting System <no-reply@example.com>",
    to: toEmail,
    subject: "Reset your super admin password",
    text: `We received a request to reset your super admin password.\n\nOpen this link to choose a new password (expires in 30 minutes):\n${resetLink}\n\nIf you didn't request this, you can safely ignore this email — your password will stay unchanged.`,
    html: buildResetEmailHtml(resetLink),
  });
}

// Table-based layout with inline styles, deliberately — this is the format
// that renders consistently across Gmail, Outlook, and mobile mail clients
// (no <div>/flexbox, no external stylesheet, no external images to break or
// get blocked).
function buildResetEmailHtml(resetLink) {
  const navy = "#2b3a67";
  const teal = "#0d9488";

  return `
<!DOCTYPE html>
<html>
  <body style="margin:0; padding:0; background-color:#f1f5f9; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px; width:100%; background-color:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 10px 30px rgba(43,58,103,0.12);">

            <!-- Header -->
            <tr>
              <td style="background:linear-gradient(135deg, ${navy}, ${teal}); padding:28px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td>
                      <table role="presentation" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="width:36px; height:36px; background-color:rgba(255,255,255,0.15); border-radius:10px; text-align:center; vertical-align:middle; font-size:18px;">
                            🛡️
                          </td>
                          <td style="padding-left:12px; color:#ffffff; font-size:15px; font-weight:600;">
                            Mid-Term Reporting System
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:36px 32px 28px 32px;">
                <p style="margin:0 0 4px 0; font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:${teal};">
                  Super admin password reset
                </p>
                <h1 style="margin:6px 0 16px 0; font-size:22px; line-height:1.3; color:#0f172a;">
                  Reset your password
                </h1>
                <p style="margin:0 0 24px 0; font-size:14px; line-height:1.6; color:#475569;">
                  We received a request to reset the password on your super admin account.
                  Click the button below to choose a new one.
                </p>

                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
                  <tr>
                    <td style="border-radius:10px; background:linear-gradient(135deg, ${navy}, ${teal});">
                      <a href="${resetLink}"
                        style="display:inline-block; padding:13px 28px; font-size:14px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:10px;">
                        Choose a New Password →
                      </a>
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; margin:0 0 24px 0;">
                  <tr>
                    <td style="padding:14px 16px; font-size:13px; color:#64748b;">
                      ⏱ This link expires in <strong style="color:#0f172a;">30 minutes</strong>. After that, you'll need to request a new one from the sign-in page.
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 8px 0; font-size:12px; line-height:1.6; color:#94a3b8;">
                  Button not working? Copy and paste this link into your browser:
                </p>
                <p style="margin:0 0 24px 0; font-size:12px; line-height:1.6; word-break:break-all;">
                  <a href="${resetLink}" style="color:${teal}; text-decoration:underline;">${resetLink}</a>
                </p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e2e8f0; padding-top:20px;">
                  <tr>
                    <td style="padding-top:20px; font-size:12px; line-height:1.6; color:#94a3b8;">
                      Didn't request this? You can safely ignore this email — your password won't be changed unless you open the link above and set a new one.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:18px 32px; background-color:#f8fafc; text-align:center;">
                <p style="margin:0; font-size:11px; color:#94a3b8;">
                  Mid-Term Reporting System · Automated message, please don't reply directly.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `;
}

module.exports = { sendPasswordResetEmail };
