import { Resend } from 'resend';

function getWorkerNotificationEmails() {
  return (process.env.WORKER_NOTIFICATION_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean);
}

function getNotificationsEnabled() {
  return Boolean(
    process.env.RESEND_API_KEY
    && process.env.RESEND_FROM_EMAIL
    && getWorkerNotificationEmails().length > 0
  );
}

export async function sendWorkerNotification(input: {
  subject: string;
  text: string;
}) {
  if (!getNotificationsEnabled()) {
    return {
      ok: false as const,
      skipped: true as const,
      reason: 'Worker notifications are not configured'
    };
  }

  const resend = new Resend(process.env.RESEND_API_KEY!);
  const to = getWorkerNotificationEmails();

  const result = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to,
    subject: input.subject,
    text: input.text
  });

  return {
    ok: true as const,
    skipped: false as const,
    result
  };
}

export function getWorkerNotificationConfig() {
  const to = getWorkerNotificationEmails();

  return {
    enabled: getNotificationsEnabled(),
    fromEmail: process.env.RESEND_FROM_EMAIL ?? null,
    recipientsCount: to.length
  };
}
