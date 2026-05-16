import * as admin from "firebase-admin";

function getApp(): admin.app.App {
  if (admin.apps.length > 0) return admin.apps[0]!;
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
  if (!process.env.FIREBASE_PROJECT_ID) return;
  const app = getApp();
  await admin.messaging(app).send({
    token,
    notification: { title: payload.title, body: payload.body },
    data: payload.data ?? {},
    android: { priority: "high", notification: { sound: "default" } },
  });
}
