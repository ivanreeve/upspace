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
};

export async function sendOtpEmail({
  to,
  otp,
  expiresAt,
  subject,
  appName,
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

  const text = `Your ${brand} verification code is ${otp}. It expires at ${formattedExpiresAt}.`;
  const html = `
    <p>Your <strong>${brand}</strong> verification code is below. It expires at ${formattedExpiresAt}.</p>
    <p style="font-size: 1.75rem; font-weight: 600; letter-spacing: 0.25rem;">${otp}</p>
    <p>If you did not request this, you can ignore this email.</p>
  `;

  await transporter.sendMail({
    from,
    to,
    subject: subject ?? `${brand} verification code`,
    text,
    html,
  });
}
