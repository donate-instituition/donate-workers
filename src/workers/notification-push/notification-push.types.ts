export type NotificationPushPayload = {
  body: string;
  data?: Record<string, unknown>;
  notificationId?: string;
  title: string;
  userId: string;
};
