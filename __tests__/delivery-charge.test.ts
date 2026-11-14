import { describe, expect, it } from "vitest";
import {
  calculateAuthoritativeDeliveryCharge,
  DEFAULT_DELIVERY_CONFIG,
  type DeliveryChargeConfig,
} from "@/lib/delivery-charge";

describe("Central Delivery Charge Engine", () => {
  it("calculates default flat rates for inside and outside Dhaka", () => {
    // Inside Dhaka with items
    const insideDhaka = calculateAuthoritativeDeliveryCharge({
      zone: "inside_dhaka",
      subtotal: 1000,
      hasItems: true,
    });
    expect(insideDhaka.fee).toBe(70);
    expect(insideDhaka.isFree).toBe(false);

    // Outside Dhaka with items
    const outsideDhaka = calculateAuthoritativeDeliveryCharge({
      zone: "outside_dhaka",
      subtotal: 1000,
      hasItems: true,
    });
    expect(outsideDhaka.fee).toBe(130);
    expect(outsideDhaka.isFree).toBe(false);
  });

  it("returns zero delivery fee when cart has no items or no zone is selected", () => {
    // No items
    const noItems = calculateAuthoritativeDeliveryCharge({
      zone: "inside_dhaka",
      subtotal: 0,
      hasItems: false,
    });
    expect(noItems.fee).toBe(0);

    // No zone
    const noZone = calculateAuthoritativeDeliveryCharge({
      zone: null,
      subtotal: 1000,
      hasItems: true,
    });
    expect(noZone.fee).toBe(0);
  });

  it("respects custom delivery charge configuration from site settings", () => {
    const customConfig: DeliveryChargeConfig = {
      insideDhakaFee: 85,
      outsideDhakaFee: 150,
      freeDeliveryEnabled: false,
      freeDeliveryThreshold: 0,
    };

    const inside = calculateAuthoritativeDeliveryCharge({
      zone: "inside_dhaka",
      subtotal: 500,
      hasItems: true,
      config: customConfig,
    });
    expect(inside.fee).toBe(85);

    const outside = calculateAuthoritativeDeliveryCharge({
      zone: "outside_dhaka",
      subtotal: 500,
      hasItems: true,
      config: customConfig,
    });
    expect(outside.fee).toBe(150);
  });

  it("applies free delivery when threshold is enabled and cart meets or exceeds minimum", () => {
    const freeDeliveryConfig: DeliveryChargeConfig = {
      insideDhakaFee: 70,
      outsideDhakaFee: 130,
      freeDeliveryEnabled: true,
      freeDeliveryThreshold: 1500,
    };

    // Subtotal below threshold -> standard fee charged
    const belowThreshold = calculateAuthoritativeDeliveryCharge({
      zone: "outside_dhaka",
      subtotal: 1200,
      hasItems: true,
      config: freeDeliveryConfig,
    });
    expect(belowThreshold.fee).toBe(130);
    expect(belowThreshold.isFree).toBe(false);
    expect(belowThreshold.amountNeededForFree).toBe(300);

    // Subtotal exactly meets threshold -> Free delivery
    const exactThreshold = calculateAuthoritativeDeliveryCharge({
      zone: "outside_dhaka",
      subtotal: 1500,
      hasItems: true,
      config: freeDeliveryConfig,
    });
    expect(exactThreshold.fee).toBe(0);
    expect(exactThreshold.isFree).toBe(true);
    expect(exactThreshold.amountNeededForFree).toBe(0);

    // Subtotal exceeds threshold -> Free delivery
    const aboveThreshold = calculateAuthoritativeDeliveryCharge({
      zone: "inside_dhaka",
      subtotal: 2500,
      hasItems: true,
      config: freeDeliveryConfig,
    });
    expect(aboveThreshold.fee).toBe(0);
    expect(aboveThreshold.isFree).toBe(true);
  });

  it("does not apply free delivery when freeDeliveryEnabled is false even if threshold is set", () => {
    const disabledConfig: DeliveryChargeConfig = {
      insideDhakaFee: 70,
      outsideDhakaFee: 130,
      freeDeliveryEnabled: false,
      freeDeliveryThreshold: 1000,
    };

    const result = calculateAuthoritativeDeliveryCharge({
      zone: "outside_dhaka",
      subtotal: 3000,
      hasItems: true,
      config: disabledConfig,
    });
    expect(result.fee).toBe(130);
    expect(result.isFree).toBe(false);
    expect(result.amountNeededForFree).toBe(0);
  });
});
