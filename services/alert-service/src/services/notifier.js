const nodemailer = require('nodemailer');

// Emoji prefix per severity level for readable console output
const SEVERITY_EMOJI = {
  CRITICAL: '🔴',
  HIGH: '🟠',
  MEDIUM: '🟡',
  LOW: '🟢',
};

/**
 * Sends an alert notification.
 *
 * Currently:
 *   1. Logs a structured summary to stdout (always)
 *   2. Sends a test email via Ethereal (fake SMTP — no real email delivered,
 *      but generates a preview URL you can open in your browser)
 *
 * To switch to real email: replace the transporter config with SendGrid or
 * Gmail SMTP credentials. The rest of the code stays identical.
 *
 * @param {object} alert  — row returned by alertService.fireAlert()
 */
async function sendAlert(alert) {
  const emoji = SEVERITY_EMOJI[alert.severity] || '⚪';

  // ── Console notification (always fires) ──────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log(`${emoji}  ALERT FIRED`);
  console.log(`   Severity : [${alert.severity}]`);
  console.log(`   Type     : ${alert.alert_type}`);
  console.log(`   Service  : ${alert.service_name}`);
  console.log(`   Message  : ${alert.message}`);
  if (alert.metric_value !== null && alert.metric_value !== undefined) {
    console.log(`   Value    : ${alert.metric_value}%`);
  }
  console.log(`   Alert ID : ${alert.id}`);
  console.log(`   Time     : ${alert.last_fired_at}`);
  console.log('='.repeat(60) + '\n');

  // ── Ethereal test email (no real sending) ────────────────────────────────
  try {
    const testAccount = await nodemailer.createTestAccount();
    const transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });

    const info = await transporter.sendMail({
      from: '"Sentinel AI" <alerts@sentinel-ai.io>',
      to: 'admin@example.com',
      subject: `${emoji} [${alert.severity}] ${alert.alert_type} — ${alert.service_name}`,
      text: [
        alert.message,
        '',
        `Alert ID  : ${alert.id}`,
        `Severity  : ${alert.severity}`,
        `Service   : ${alert.service_name}`,
        `Fired at  : ${alert.last_fired_at}`,
      ].join('\n'),
    });

    console.log(`[NOTIFIER] Email preview URL: ${nodemailer.getTestMessageUrl(info)}`);
  } catch (err) {
    // Non-fatal — console log already happened
    console.error('[NOTIFIER] Email send failed (non-critical):', err.message);
  }
}

module.exports = { sendAlert };
