import { inngest } from "@/lib/inngest/client";
import { sendBrevoEmail, getBrevoConfig } from "@/lib/brevo";
import { sendSmsBangladesh } from "@/lib/sms/smsbangladesh";
import { triggerCapiPurchaseInternal } from "@/lib/capi-service";
import type {
  NotificationEmailSendEventData,
  NotificationSmsSendEventData,
  MetaCapiPurchaseEventData,
} from "@/lib/inngest/events";

export const notificationEmailFunction = inngest.createFunction(
  {
    id: "notification-email-send",
    name: "Direct Transactional Email Dispatch",
    retries: 3,
    triggers: [{ event: "notification.email.send" }],
  },
  async ({ event, step }) => {
    const data = event.data as NotificationEmailSendEventData;

    return await step.run("dispatch-email", async () => {
      const config = await getBrevoConfig();
      return await sendBrevoEmail(data.payload, config);
    });
  }
);

export const notificationSmsFunction = inngest.createFunction(
  {
    id: "notification-sms-send",
    name: "Direct SMS Dispatch",
    retries: 3,
    triggers: [{ event: "notification.sms.send" }],
  },
  async ({ event, step }) => {
    const data = event.data as NotificationSmsSendEventData;

    return await step.run("dispatch-sms", async () => {
      return await sendSmsBangladesh({
        to: data.recipientPhone,
        message: data.messageText,
      });
    });
  }
);

export const metaCapiPurchaseFunction = inngest.createFunction(
  {
    id: "meta-capi-purchase",
    name: "Meta CAPI Purchase Event Trigger",
    retries: 3,
    triggers: [{ event: "meta.capi.purchase" }],
  },
  async ({ event, step }) => {
    const data = event.data as MetaCapiPurchaseEventData;

    return await step.run("send-capi-purchase", async () => {
      return await triggerCapiPurchaseInternal(data.orderIdOrNumber);
    });
  }
);
