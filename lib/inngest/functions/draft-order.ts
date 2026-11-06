import { inngest } from "@/lib/inngest/client";
import { placeStorefrontOrderAction } from "@/actions/storefront-order";
import type { OrderDraftAutoSaveEventData } from "@/lib/inngest/events";

export const draftOrderDebouncedAutoSaveFunction = inngest.createFunction(
  {
    id: "draft-order-debounced-autosave",
    name: "Draft Order: Debounced Auto-Save",
    retries: 2,
    triggers: [{ event: "order.draft.autosave" }],
    debounce: {
      key: "event.data.customerPhone",
      period: "2s",
    },
  },
  async ({ event, step }) => {
    const data = event.data as OrderDraftAutoSaveEventData;

    return await step.run("persist-debounced-draft", async () => {
      // Execute the single final draft update to Supabase
      const result = await placeStorefrontOrderAction({
        orderId: data.orderId,
        customerPhone: data.customerPhone,
        customerName: data.customerName,
        addressLine: data.addressLine,
        deliveryZone: data.deliveryZone,
        customerNote: data.customerNote,
        items: data.items,
        status: "incomplete_order",
      });

      return {
        success: result.success,
        orderId: result.orderId,
        orderNumber: result.orderNumber,
        status: result.status,
      };
    });
  }
);
