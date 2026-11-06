import { inngest } from "@/lib/inngest/client";

export const demoPackagingFunction = inngest.createFunction(
  {
    id: "demo-packaging-summary",
    name: "Demo: Order Packaging & Preparation",
    retries: 2,
    triggers: [{ event: "demo/order.prepare" }],
  },
  async ({ event, step }) => {
    const {
      orderNumber = "ORD-DEMO-01",
      items = [
        { name: "খাঁটি দানাদার খেজুরের গুড় (১ কেজি)", quantity: 2, weightKg: 1 },
      ],
    } = (event.data as Record<string, any>) || {};

    // Durable Step: compute packaging manifest
    const packagingDetails = await step.run(
      "calculate-packaging-specifications",
      async () => {
        const totalWeightKg = items.reduce(
          (acc: number, item: { quantity: number; weightKg?: number }) =>
            acc + item.quantity * (item.weightKg || 1),
          0
        );
        const boxType =
          totalWeightKg > 3 ? "Heavy-Duty Corrugated Box" : "Standard Eco Box";
        const protectiveCushioning = "Foil bubble insulation";

        return {
          orderNumber,
          itemCount: items.length,
          totalWeightKg,
          boxType,
          protectiveCushioning,
          preparedAt: new Date().toISOString(),
          packingStatus: "Ready for Steadfast Courier dispatch",
        };
      }
    );

    return {
      success: true,
      orderNumber,
      summary: `Packaging manifest generated for order ${orderNumber}: ${packagingDetails.totalWeightKg}kg packed in ${packagingDetails.boxType}.`,
      packaging: packagingDetails,
    };
  }
);
