-- Add fcmToken column for Firebase Cloud Messaging push notifications
ALTER TABLE "Courier" ADD COLUMN "fcmToken" TEXT;
