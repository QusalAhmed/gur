import { describe, expect, it, vi } from "vitest";
import { parseOrderItemWeightKg } from "@/hooks/use-live-stock";
import fs from "fs";
import path from "path";

describe("Live Stock Logic & Request Behavior", () => {
  it("correctly parses order item weights in KG", () => {
    expect(parseOrderItemWeightKg({ net_quantity: 500, net_unit: "g", quantity: 2 })).toBe(1);
    expect(parseOrderItemWeightKg({ net_quantity: 1, net_unit: "kg", quantity: 5 })).toBe(5);
    expect(parseOrderItemWeightKg({ net_quantity: 2, net_unit: "ton", quantity: 1 })).toBe(2000);
    expect(parseOrderItemWeightKg({ variant_name: "1 kg jar", quantity: 3 })).toBe(3);
    expect(parseOrderItemWeightKg({ variant_name: "500 g pouch", quantity: 4 })).toBe(2);
  });

  it("does not continuously poll the server via setInterval or visibility/focus listeners in useLiveStock", () => {
    const hookFile = fs.readFileSync(
      path.resolve(__dirname, "../hooks/use-live-stock.ts"),
      "utf-8"
    );

    // Verify polling interval has been removed
    expect(hookFile).not.toContain("setInterval");
    expect(hookFile).not.toContain("visibilitychange");
    expect(hookFile).not.toContain("window.addEventListener(\"focus\"");
  });

  it("does not trigger redundant refresh on scroll into view in LiveStockSection", () => {
    const sectionFile = fs.readFileSync(
      path.resolve(__dirname, "../components/storefront/live-stock-section.tsx"),
      "utf-8"
    );

    // Verify scroll-into-view fetch trigger has been removed
    expect(sectionFile).not.toContain("hasTriggeredInitialViewSync");
  });

  it("places LiveStockSection in checkout-section below order form and removes it from contact-section", () => {
    const checkoutFile = fs.readFileSync(
      path.resolve(__dirname, "../components/storefront/checkout-section.tsx"),
      "utf-8"
    );
    const contactFile = fs.readFileSync(
      path.resolve(__dirname, "../components/storefront/contact-section.tsx"),
      "utf-8"
    );

    expect(checkoutFile).toContain("<LiveStockSection");
    expect(contactFile).not.toContain("<LiveStockSection");
  });

  it("does not continuously refetch order data on order confirmation page", () => {
    const orderConfirmedFile = fs.readFileSync(
      path.resolve(__dirname, "../app/order-confirmed/[id]/page.tsx"),
      "utf-8"
    );

    expect(orderConfirmedFile).not.toContain("return 4000");
    expect(orderConfirmedFile).toContain("refetchInterval: false");
    expect(orderConfirmedFile).toContain("refetchOnWindowFocus: false");
  });
});
