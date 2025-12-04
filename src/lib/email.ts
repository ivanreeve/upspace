import nodemailer, { type Transporter } from 'nodemailer';

const {
  EMAIL_SMTP_HOST,
  EMAIL_SMTP_PORT,
  EMAIL_SMTP_SECURE,
  EMAIL_SMTP_USER,
  EMAIL_SMTP_PASSWORD,
  EMAIL_FROM,
  EMAIL_FROM_NAME,
} = process.env;

let transport: Transporter | null = null;

function getTransporter() {
  if (transport) return transport;

  if (!EMAIL_SMTP_HOST || !EMAIL_SMTP_PORT) {
    throw new Error('EMAIL_SMTP_HOST and EMAIL_SMTP_PORT must be set to send emails.');
  }

  if (!EMAIL_SMTP_USER || !EMAIL_SMTP_PASSWORD) {
    throw new Error('EMAIL_SMTP_USER and EMAIL_SMTP_PASSWORD must be set to send emails.');
  }

  const port = Number.parseInt(EMAIL_SMTP_PORT, 10);
  if (Number.isNaN(port)) {
    throw new Error('EMAIL_SMTP_PORT must be a number.');
  }

  const secure = EMAIL_SMTP_SECURE === 'true' || EMAIL_SMTP_SECURE === '1';

  transport = nodemailer.createTransport({
    host: EMAIL_SMTP_HOST,
    port,
    secure,
    auth: {
      user: EMAIL_SMTP_USER,
      pass: EMAIL_SMTP_PASSWORD,
    },
  });

  return transport;
}

const DEFAULT_FROM = EMAIL_FROM ?? EMAIL_SMTP_USER;

export type SendOtpEmailOptions = {
  to: string;
  otp: string;
  expiresAt: Date;
  subject?: string;
  appName?: string;
  cause?: string;
  validForMinutes?: number;
};

export type SendBookingEmailOptions = {
  to: string;
  spaceName: string;
  areaName: string;
  bookingHours: number;
  price?: number | null;
  link?: string | null;
};

export async function sendOtpEmail({
  to,
  otp,
  expiresAt,
  subject,
  appName,
  cause,
  validForMinutes,
}: SendOtpEmailOptions) {
  if (!DEFAULT_FROM) {
    throw new Error('EMAIL_FROM or EMAIL_SMTP_USER must be defined to send emails.');
  }

  const transporter = getTransporter();
  const from = EMAIL_FROM_NAME ? `${EMAIL_FROM_NAME} <${DEFAULT_FROM}>` : DEFAULT_FROM;
  const brand = appName ?? process.env.NEXT_PUBLIC_APP_NAME ?? 'Upspace';
  const formattedExpiresAt = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(expiresAt);

  const actionDescription = cause?.trim() || 'account verification';
  const normalizedValidMinutes =
    typeof validForMinutes === 'number' && Number.isFinite(validForMinutes)
      ? Math.max(1, Math.round(validForMinutes))
      : null;
  const computedMinutes = Math.max(
    1,
    Math.ceil((expiresAt.getTime() - Date.now()) / 60000)
  );
  const displayMinutes = normalizedValidMinutes ?? computedMinutes;

  const text = `Hello from ${brand}! Your OTP for ${actionDescription} is ${otp}. It expires at ${formattedExpiresAt} and remains valid for ${displayMinutes} minutes. If you did not request this code, you can ignore this email.`;
  const html = `
  <div style="margin:0;padding:0;background-color:#fff;">
    <table
      role="presentation"
      border="0"
      cellpadding="0"
      cellspacing="0"
      width="100%"
      style="width:100%;min-width:100%;background-color:transparent;"
    >
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table
            role="presentation"
            border="0"
            cellpadding="0"
            cellspacing="0"
            width="100%"
            style="max-width:600px;background-color:#FDFFEF;font-family:'Inter','Segoe UI',system-ui,sans-serif;border-radius:8px;color:#034951;overflow:hidden;"
          >
            <tr>
              <td style="background-color:#023347;text-align:center;color:#fff;padding:1.25rem 1rem;">
                <h1 style="margin:0;font-size:1.5rem;">Your OTP Code</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:2rem 2rem 1.5rem;">
                <p style="margin:0 0 0.75rem;">Hello!</p>
                <p style="margin:0 0 1.5rem;">Your One-Time Password (OTP) for ${actionDescription} is:</p>
                <div
                  style="text-align:center;font-size:3rem;padding:0.75rem 0;background-color:#F8EAD5;color:#034951;font-weight:700;border-radius:8px;margin-bottom:1.5rem;"
                >
                  <span>${otp}</span>
                </div>
                <p style="margin:0 0 1rem;">This OTP is valid for <b>${displayMinutes} minutes</b>. Please do not share this code with anyone.</p>
                <p style="margin:0;">If you did not request this code, please ignore this email.<br/>Thank you for using our service!</p>
              </td>
            </tr>
            <tr>
              <td style="padding:1rem;text-align:center;background-color:#ECDBC1;color:#6A6153;font-weight:600;">
                <p style="margin:0;">Ⓒ 2025 UpSpace. All rights reserved.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
  `;

  await transporter.sendMail({
    from,
    to,
    subject: subject ?? `${brand} verification code`,
    text,
    html,
  });
}

const BOOKING_PRICE_FORMATTER = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

export async function sendBookingNotificationEmail({
  to,
  spaceName,
  areaName,
  bookingHours,
  price,
  link,
}: SendBookingEmailOptions) {
  if (!DEFAULT_FROM) {
    throw new Error('EMAIL_FROM or EMAIL_SMTP_USER must be defined to send emails.');
  }

  const transporter = getTransporter();
  const from = EMAIL_FROM_NAME ? `${EMAIL_FROM_NAME} <${DEFAULT_FROM}>` : DEFAULT_FROM;
  const priceLabel =
    typeof price === 'number'
      ? `Total: ${BOOKING_PRICE_FORMATTER.format(price)}`
      : 'Pricing confirmed';
  const durationLabel = `Duration: ${bookingHours} hour${bookingHours === 1 ? '' : 's'}`;
  const subject = `Booking confirmed for ${spaceName}`;
  const ctaLink = link ?? `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/marketplace`;

  const text = [
    `Your booking at ${spaceName} is confirmed.`,
    `Area: ${areaName}`,
    durationLabel,
    priceLabel,
    `View booking: ${ctaLink}`
  ].join('\n');

  const html = `
    <div style="font-family:'Inter','Segoe UI',system-ui,sans-serif;background-color:#f8f9fb;padding:24px;color:#111827;">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <div style="background:#111827;color:#fff;padding:16px 20px;">
          <h2 style="margin:0;font-size:18px;font-weight:700;">Booking confirmed</h2>
        </div>
        <div style="padding:20px;">
          <p style="margin:0 0 8px;">Hi there,</p>
          <p style="margin:0 0 16px;">Your booking at <strong>${spaceName}</strong> is confirmed.</p>
          <div style="margin:0 0 12px;padding:12px 14px;border:1px solid #e5e7eb;border-radius:10px;background:#f9fafb;">
            <p style="margin:0 0 6px;"><strong>Area:</strong> ${areaName}</p>
            <p style="margin:0 0 6px;"><strong>${durationLabel}</strong></p>
            <p style="margin:0;">${priceLabel}</p>
          </div>
          <a href="${ctaLink}" style="display:inline-block;margin-top:8px;padding:12px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;">View space</a>
        </div>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });
}
