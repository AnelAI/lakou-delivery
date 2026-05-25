import * as admin from "firebase-admin";

function getPrivateKey(): string {
  // Prefer base64-encoded key (avoids all escaping issues across environments)
  const b64 = process.env.FIREBASE_PRIVATE_KEY_B64;
  if (b64) return Buffer.from(b64, "base64").toString("utf8");
  // Fallback: literal \n sequences stored in env var
  return process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n") ?? "";
}

function getApp(): admin.app.App {
  if (admin.apps.length > 0) {
    console.log("[FCM] Reusing existing Firebase Admin app");
    return admin.apps[0]!;
  }
  const privateKey = getPrivateKey();
  console.log("[FCM] Initializing Firebase Admin app", {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKeyLength: privateKey.length,
    privateKeyOk: privateKey.startsWith("-----BEGIN"),
  });
  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}

export async function sendCourierFcm(
  token: string,
  payload: { title: string; body: string; data?: Record<string, string> }
): Promise<void> {
  console.log("[FCM] sendCourierFcm called", {
    tokenPrefix: token.slice(0, 20) + "...",
    title: payload.title,
    hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
  });

  if (!process.env.FIREBASE_PROJECT_ID) {
    console.error("[FCM] FIREBASE_PROJECT_ID is missing — aborting send");
    return;
  }

  const app = getApp();
  const message = {
    token,
    // notification field = FCM shows the alert via system tray regardless of app state.
    // data field = available to onMessage / onMessageOpenedApp / getInitialMessage for app logic.
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: {
      title: payload.title,
      body: payload.body,
      ...(payload.data ?? {}),
    },
    android: {
      priority: "high" as const,
      notification: {
        channelId: "lakoud_courier_v2",
        // "notification_sound" = res/raw/notification_sound.* dans l'APK
        sound: "notification_sound",
        defaultVibrateTimings: true,
        priority: "high" as const,
      },
    },
  };

  try {
    const result = await admin.messaging(app).send(message);
    console.log("[FCM] Message sent successfully, messageId:", result);
  } catch (err) {
    console.error("[FCM] Failed to send message:", err);
    throw err;
  }
}
