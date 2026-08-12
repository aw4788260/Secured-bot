// lib/mailer.js
//
// Central SMTP transporter, built from the exact relay that you confirmed
// works in your Python test (relay.hostup.se:587 + STARTTLS).
//
// Required env vars (add to .env.local / your hosting provider's env panel):
//   SMTP_HOST=relay.hostup.se
//   SMTP_PORT=587
//   SMTP_FROM=no-reply@medaad.online
//   SMTP_USER=            (optional — leave empty if the relay is IP-whitelisted,
//                           exactly like your working python3 script which never called login())
//   SMTP_PASS=            (optional, only needed if SMTP_USER is set)

import nodemailer from 'nodemailer';

let cachedTransporter = null;

function buildTransporter() {
  const host = process.env.SMTP_HOST || 'relay.hostup.se';
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  const options = {
    host,
    port,
    secure: false, // false + STARTTLS on port 587, same as smtp.starttls() in the python script
    requireTLS: true,
  };

  // Only attach `auth` if credentials are actually configured — this mirrors
  // the python test script, which never calls smtp.login() at all.
  if (user && pass) {
    options.auth = { user, pass };
  }

  return nodemailer.createTransport(options);
}

export function getMailer() {
  if (!cachedTransporter) {
    cachedTransporter = buildTransporter();
  }
  return cachedTransporter;
}

/**
 * Sends a plain-text email through the Hostup relay.
 * Throws on failure — callers should catch and translate into an API error.
 */
export async function sendMail({ to, subject, text, html }) {
  const from = process.env.SMTP_FROM || 'no-reply@medaad.online';
  const transporter = getMailer();

  return transporter.sendMail({
    from: `Medaad <${from}>`,
    to,
    subject,
    text,
    html,
  });
}
