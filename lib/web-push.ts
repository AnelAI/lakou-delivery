import webpush from "web-push";
import { prisma, withRetry } from "./db";

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:admin@lakoud.tn",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
  requireInteraction?: boolean;
}

export async function notifyAdmin(payload: PushPayload): Promise<void> {
  if (!process.env.VAPID_PUBLIC_KEY) return;

  const subscriptions = await withRetry(() =>
    prisma.adminPushSubscription.findMany()
  );
  if (subscriptions.length === 0) return;

  await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush
        .sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        )
        .catch(async (err: { statusCode?: number }) => {
          // Subscription expired or invalid — clean it up
          if (err.statusCode === 410 || err.statusCode === 404) {
            await prisma.adminPushSubscription
              .delete({ where: { id: sub.id } })
              .catch(() => {});
          }
        })
    )
  );
}
