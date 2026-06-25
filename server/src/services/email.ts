import nodemailer from 'nodemailer';

interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  // If no SMTP config, email is disabled — log a warning once
  if (!host || !user || !pass) {
    if (!process.env._EMAIL_WARNED) {
      console.warn(
        'WARNING: SMTP not configured (SMTP_HOST/SMTP_USER/SMTP_PASS). ' +
        'Email notifications are disabled. Set these env vars to enable email delivery.'
      );
      process.env._EMAIL_WARNED = '1';
    }
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return transporter;
}

/**
 * Send an email notification. Silently no-ops if SMTP is not configured.
 */
export async function sendEmail(payload: EmailPayload): Promise<void> {
  const t = getTransporter();
  if (!t) return;

  try {
    const fromName = process.env.SMTP_FROM_NAME || 'SafeEscrow Marketplace';
    const fromAddr = process.env.SMTP_FROM_ADDRESS || process.env.SMTP_USER || 'noreply@safeescrow.com';

    await t.sendMail({
      from: `"${fromName}" <${fromAddr}>`,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html || payload.text.replace(/\n/g, '<br/>'),
    });
  } catch (err) {
    console.error('Failed to send email notification:', err);
  }
}

/**
 * Send a notification email about an escrow case status change.
 */
export async function sendEscrowNotification(
  email: string,
  username: string,
  caseId: string,
  eventType: string,
  details: string
): Promise<void> {
  const subjectMap: Record<string, string> = {
    new_escrow_case: 'New Escrow Case Opened',
    payment_received: 'Payment Received — Escrow Case Update',
    payment_verified: 'Payment Verified — Funds Secured',
    payment_rejected: 'Payment Rejected — Action Required',
    evidence_approved: 'Packaging Evidence Approved',
    item_shipped: 'Item Shipped — Tracking Available',
    item_delivered: 'Item Delivered — Confirm Receipt',
    dispute_opened: 'Dispute Opened — Under Review',
    dispute_resolved: 'Dispute Resolved',
    funds_released: 'Funds Released — Transaction Complete',
  };

  const subject = subjectMap[eventType] || `Escrow Case Update: ${caseId}`;

  await sendEmail({
    to: email,
    subject: `[SafeEscrow] ${subject}`,
    text: `Hi ${username},\n\n${details}\n\nCase ID: ${caseId}\n\nView your dashboard: ${process.env.APP_URL || 'http://localhost:3000'}/dashboard\n\n— SafeEscrow Team`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
        <div style="background: #FFFDF5; border: 1px solid rgba(240,184,0,0.24); border-radius: 16px; padding: 32px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(240,184,0,0.12); padding: 6px 14px; border-radius: 20px; border: 1px solid rgba(240,184,0,0.30);">
              <span style="color: #B87000; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em;">SafeEscrow</span>
            </div>
          </div>
          <h2 style="color: #1A1000; font-size: 20px; font-weight: 700; margin-bottom: 8px;">${subject}</h2>
          <p style="color: #5C4000; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">Hi ${username},</p>
          <p style="color: #5C4000; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">${details}</p>
          <div style="background: rgba(240,184,0,0.08); border: 1px solid rgba(240,184,0,0.18); border-radius: 10px; padding: 12px 16px; margin-bottom: 20px;">
            <p style="color: #8B6000; font-size: 12px; margin: 0;">Case ID: <strong style="color: #1A1000;">${caseId}</strong></p>
          </div>
          <a href="${process.env.APP_URL || 'http://localhost:3000'}/dashboard"
             style="display: inline-block; background: linear-gradient(135deg, #E8A800 0%, #F0B800 100%); color: #FFFFFF; font-weight: 600; font-size: 14px; padding: 12px 28px; border-radius: 12px; text-decoration: none;">
            View Dashboard
          </a>
          <p style="color: #9A7C40; font-size: 11px; margin-top: 24px; border-top: 1px solid rgba(240,184,0,0.14); padding-top: 16px;">
            This is an automated message from SafeEscrow. Please do not reply directly.
          </p>
        </div>
      </div>
    `,
  });
}