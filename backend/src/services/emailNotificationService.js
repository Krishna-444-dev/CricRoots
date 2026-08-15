const nodemailer = require('nodemailer');

// Transport selection
// --------------------
// Real production deploys MUST set all four of SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS
// (e.g. SendGrid, SES, Postmark, or a plain SMTP account) - whoever configures production needs
// to know that, because without them this silently falls back to Ethereal, nodemailer's built-in
// fake-inbox service for development: createTestAccount() spins up a throwaway inbox on
// ethereal.email that never reaches a real recipient, it only ever gives back a preview URL
// (nodemailer.getTestMessageUrl(info), logged per-send below) where the "sent" email can be
// viewed. That's exactly what makes it useful for dev/local verification without real creds, but
// it would mean silent non-delivery if SMTP_* were ever left unset in production.
// Optional: SMTP_FROM sets the From address; SMTP_SECURE ('true'/'false') overrides the
// default (port 465 = implicit TLS, everything else = STARTTLS/plain).
let cachedTransportPromise = null;
let cachedFromAddress = null;

function getSmtpConfigFromEnv() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
    return { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS };
  }
  return null;
}

// Cached across calls (module-level promise, not per-email) so a dev session reuses one Ethereal
// test account instead of minting a new throwaway inbox for every single notification sent.
async function getTransport() {
  if (cachedTransportPromise) return cachedTransportPromise;

  cachedTransportPromise = (async () => {
    const smtpConfig = getSmtpConfigFromEnv();

    if (smtpConfig) {
      cachedFromAddress = process.env.SMTP_FROM || smtpConfig.SMTP_USER;
      const port = Number(smtpConfig.SMTP_PORT);
      return nodemailer.createTransport({
        host: smtpConfig.SMTP_HOST,
        port,
        secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
        auth: { user: smtpConfig.SMTP_USER, pass: smtpConfig.SMTP_PASS }
      });
    }

    const testAccount = await nodemailer.createTestAccount();
    cachedFromAddress = testAccount.user;
    console.log(
      `[emailNotificationService] SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS not set - using a ` +
      `dev-only Ethereal test account (${testAccount.user}). Emails sent this way never reach a ` +
      `real inbox; each send logs a preview URL (getTestMessageUrl) to view it instead. Set the ` +
      `SMTP_* env vars to send real email.`
    );
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass }
    });
  })();

  return cachedTransportPromise;
}

// @desc   Best-effort email delivery for a single notification. Never throws - returns null on
//         any failure (missing recipient, transport error, ...) instead, so a call site can
//         `await` it inside a log-only try/catch same as everywhere else in this codebase without
//         needing its own nested try/catch per call.
// @param  to       recipient email address - a falsy value is treated as "nothing to send",
//                   not an error (mirrors pushNotificationService's null-pushToken handling).
// @param  subject  email subject line
// @param  text     plain-text body
// @param  html     optional HTML body; falls back to a trivial wrap of `text` if omitted
async function sendNotificationEmail({ to, subject, text, html }) {
  if (!to) return null;

  try {
    const transport = await getTransport();
    const info = await transport.sendMail({
      from: `"CricRoots" <${cachedFromAddress}>`,
      to,
      subject,
      text,
      html: html || `<p>${text}</p>`
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      // Only ever non-null for the Ethereal fallback transport - this is the dev/local
      // "live-verify without real SMTP creds" mechanism.
      console.log(`[emailNotificationService] Preview URL for email to ${to}: ${previewUrl}`);
    }

    return info;
  } catch (error) {
    console.error(`Email send failed for ${to}:`, error.message);
    return null;
  }
}

module.exports = { sendNotificationEmail };
