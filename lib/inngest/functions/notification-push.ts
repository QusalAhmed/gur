import { inngest } from "@/lib/inngest/client";
import {
  dispatchPendingNotificationPushes,
  dispatchPushForNotificationId,
} from "@/lib/push/web-push";
import type { NotificationPushSendEventData } from "@/lib/inngest/events";

export const notificationPushFunction = inngest.createFunction(
  {
    id: "notification-web-push-send",
    name: "Admin PWA Web Push Notification Dispatch",
    retries: 3,
    triggers: [{ event: "notification.push.send" }],
    concurrency: {
      limit: 20,
    },
  },
  async ({ event, step }) => {
    const data = (event.data || {}) as NotificationPushSendEventData;

    return await step.run("dispatch-admin-web-push", async () => {
      if (data.notificationId) {
        return await dispatchPushForNotificationId(data.notificationId);
      }
      return await dispatchPendingNotificationPushes(data.limit || 15);
    });
  }
);
