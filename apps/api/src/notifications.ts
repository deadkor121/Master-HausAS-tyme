import { Resend } from 'resend';
import { prisma } from './db.js';

async function getWorkerNotificationRecipients() {
  const users = await prisma.user.findMany({
    where: {
      role: 'worker',
      emailNotificationsEnabled: true
    }
  });

  return users
    .map((user) => user.email?.trim())
    .filter((email): email is string => Boolean(email));
}

async function getNotificationsEnabled() {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    return false;
  }

  const recipients = await getWorkerNotificationRecipients();
  return recipients.length > 0;
}

export async function sendWorkerNotification(input: {
  subject: string;
  text: string;
}) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    return {
      ok: false as const,
      skipped: true as const,
      reason: 'Resend is not configured'
    };
  }

  const to = await getWorkerNotificationRecipients();

  if (to.length === 0) {
    return {
      ok: false as const,
      skipped: true as const,
      reason: 'No registered workers with enabled email notifications'
    };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const result = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to,
    subject: input.subject,
    text: input.text
  });

  return {
    ok: true as const,
    skipped: false as const,
    recipients: to,
    result
  };
}

export async function getWorkerNotificationConfig() {
  const recipients = await getWorkerNotificationRecipients();

  return {
    enabled: await getNotificationsEnabled(),
    fromEmail: process.env.RESEND_FROM_EMAIL ?? null,
    recipientsCount: recipients.length,
    recipients
  };
}
