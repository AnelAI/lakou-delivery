import * as admin from "firebase-admin";

function getApp(): admin.app.App {
  if (admin.apps.length > 0) {
    console.log("[FCM] Reusing existing Firebase Admin app");
    return admin.apps[0]!;
  }
  console.log("[FCM] Initializing Firebase Admin app", {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
  });
  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
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
    // Data-only: no notification field so _backgroundMessageHandler always fires
    data: {
      title: payload.title,
      body: payload.body,
      ...(payload.data ?? {}),
    },
    android: { priority: "high" as const },
  };

  try {
    const result = await admin.messaging(app).send(message);
    console.log("[FCM] Message sent successfully, messageId:", result);
  } catch (err) {
    console.error("[FCM] Failed to send message:", err);
    throw err;
  }
}
