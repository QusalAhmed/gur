import { describe, it, expect } from "vitest";
import {
  computePurchaseSettlement,
  computePurchaseTotals,
  buildSupplierKhata,
  getBalanceStatus,
} from "@/lib/supplier-ledger";

describe("Supplier Purchase & Cash Ledger Math", () => {
  it("computes multi-line purchase totals with extra charges and discount", () => {
    const res = computePurchaseTotals(
      [
        { quantity: 42.5, unitPrice: 310 }, // 13,175.00
        { quantity: 10, unitPrice: 280.25 }, // 2,802.50
      ],
      450,
      200
    );

    expect(res.subtotal).toBe(15977.5);
    expect(res.extraCharges).toBe(450);
    expect(res.discountAmount).toBe(200);
    expect(res.totalAmount).toBe(16227.5);
    expect(res.isDiscountValid).toBe(true);
  });

  it("flags invalid discounts exceeding subtotal + extra charges without going negative", () => {
    const res = computePurchaseTotals([{ quantity: 5, unitPrice: 100 }], 50, 700);
    expect(res.isDiscountValid).toBe(false);
    expect(res.totalAmount).toBe(0);
  });

  it("builds chronological khata running balances with opening balance, advances, and voided entries", () => {
    const khata = buildSupplierKhata(
      1500, // existing opening due
      [
        {
          id: "p1",
          number: "PUR-2611-01001",
          date: "2026-11-10",
          createdAt: "2026-11-10T08:00:00Z",
          totalAmount: 10000,
          summary: "Patali Gur 30 kg",
          status: "active",
        },
        {
          id: "p-void",
          number: "PUR-2611-01002",
          date: "2026-11-11",
          createdAt: "2026-11-11T08:00:00Z",
          totalAmount: 5000,
          summary: "Duplicate entry",
          status: "voided",
        },
      ],
      [
        {
          id: "pay1",
          number: "PAY-2611-01001",
          date: "2026-11-10",
          createdAt: "2026-11-10T08:00:00Z",
          amount: 6000,
          method: "cash",
          paidBy: "Rahim",
          status: "active",
        },
        {
          id: "pay2",
          number: "PAY-2611-01002",
          date: "2026-11-12",
          createdAt: "2026-11-12T09:00:00Z",
          amount: 8000,
          method: "cash",
          status: "active",
        },
      ]
    );

    expect(khata.totalPurchased).toBe(10000);
    expect(khata.totalPaid).toBe(14000);
    // 1500 + 10000 - 14000 = -2500 (advance credit with supplier)
    expect(khata.netBalance).toBe(-2500);
    expect(getBalanceStatus(khata.netBalance)).toBe("advance");

    // Chronological order: opening (1500) -> p1 (11500) -> pay1 (5500) -> p-void (still 5500) -> pay2 (-2500)
    expect(khata.entries.map((e) => e.runningBalance)).toEqual([
      1500,
      11500,
      5500,
      5500,
      -2500,
    ]);
  });

  it("classifies balance status around zero accurately", () => {
    expect(getBalanceStatus(0.001)).toBe("settled");
    expect(getBalanceStatus(-0.001)).toBe("settled");
    expect(getBalanceStatus(120)).toBe("due");
    expect(getBalanceStatus(-50)).toBe("advance");
  });

  it("computes purchase settlement status for unpaid, partial, full, overpaid, and voided purchases", () => {
    expect(computePurchaseSettlement(10000, 0, "active")).toEqual({
      paidAmount: 0,
      remainingDue: 10000,
      settlementStatus: "active",
      isPartiallyPaid: false,
    });

    expect(computePurchaseSettlement(10000, 4000, "active")).toEqual({
      paidAmount: 4000,
      remainingDue: 6000,
      settlementStatus: "active",
      isPartiallyPaid: true,
    });

    expect(computePurchaseSettlement(10000, 10000, "active")).toEqual({
      paidAmount: 10000,
      remainingDue: 0,
      settlementStatus: "paid",
      isPartiallyPaid: false,
    });

    expect(computePurchaseSettlement(10000, 10500, "active")).toEqual({
      paidAmount: 10500,
      remainingDue: 0,
      settlementStatus: "paid",
      isPartiallyPaid: false,
    });

    expect(computePurchaseSettlement(10000, 5000, "voided")).toEqual({
      paidAmount: 0,
      remainingDue: 0,
      settlementStatus: "voided",
      isPartiallyPaid: false,
    });
  });
});
