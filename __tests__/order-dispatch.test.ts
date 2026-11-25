import { describe, it, expect } from "vitest";
import {
  formatSendingDateDisplay,
  getDhakaTodayIsoDate,
  getOrderDispatchHoldState,
  matchesPrintSendingDateFilter,
  normalizeSendingDate,
  sortOrdersForPrint,
  toDhakaDateKey,
} from "@/lib/order-dispatch";
import type { Order } from "@/types/order";

function makeOrder(
  overrides: Partial<Order> & { id: string }
): Pick<
  Order,
  "id" | "order_number" | "date" | "status" | "is_urgent" | "is_paused" | "sending_date"
> {
  return {
    order_number: overrides.order_number ?? overrides.id,
    date: overrides.date ?? "2026-11-24T10:00:00Z",
    status: overrides.status ?? "confirmed",
    is_urgent: overrides.is_urgent ?? false,
    is_paused: overrides.is_paused ?? false,
    sending_date: overrides.sending_date ?? null,
    id: overrides.id,
  };
}

describe("Order Dispatch Scheduling, Filtering & Print Sorting", () => {
  describe("Timezone and date normalization (Asia/Dhaka)", () => {
    it("maps UTC evening timestamp into next Dhaka calendar day", () => {
      // 2026-11-24 19:30 UTC == 2026-11-25 01:30 Asia/Dhaka (+06:00)
      expect(toDhakaDateKey("2026-11-24T19:30:00Z")).toBe("2026-11-25");
      expect(toDhakaDateKey("2026-11-24T17:59:59Z")).toBe("2026-11-24");
    });

    it("preserves pure YYYY-MM-DD sending date strings without timezone shift", () => {
      expect(normalizeSendingDate("2026-11-28")).toBe("2026-11-28");
      expect(normalizeSendingDate(" 2026-11-28T00:00:00Z ")).toBe("2026-11-28");
      expect(normalizeSendingDate("   ")).toBeNull();
      expect(normalizeSendingDate(null)).toBeNull();
    });

    it("formats sending dates for sticker/badge display", () => {
      expect(formatSendingDateDisplay("2026-11-28")).toBe("28 Nov 2026");
      expect(formatSendingDateDisplay(null)).toBe("");
    });

    it("returns YYYY-MM-DD for getDhakaTodayIsoDate", () => {
      const key = getDhakaTodayIsoDate(new Date("2026-11-24T20:00:00Z"));
      expect(key).toBe("2026-11-25");
    });
  });

  describe("sortOrdersForPrint", () => {
    it("places urgent parcels first (oldest first), then normal parcels (oldest first)", () => {
      const orders = [
        makeOrder({ id: "ORD-N-OLD", date: "2026-11-20T08:00:00Z", is_urgent: false }),
        makeOrder({ id: "ORD-U-NEW", date: "2026-11-24T09:00:00Z", is_urgent: true }),
        makeOrder({ id: "ORD-N-NEW", date: "2026-11-24T12:00:00Z", is_urgent: false }),
        makeOrder({ id: "ORD-U-OLD", date: "2026-11-22T06:00:00Z", is_urgent: true }),
      ];

      const sorted = sortOrdersForPrint(orders);
      expect(sorted.map((o) => o.id)).toEqual([
        "ORD-U-OLD",
        "ORD-U-NEW",
        "ORD-N-OLD",
        "ORD-N-NEW",
      ]);
    });

    it("breaks equal timestamps deterministically by order_number and does not mutate input", () => {
      const orders = [
        makeOrder({ id: "ORD-002", order_number: "ORD-002", date: "2026-11-23T10:00:00Z" }),
        makeOrder({ id: "ORD-001", order_number: "ORD-001", date: "2026-11-23T10:00:00Z" }),
      ];
      const snapshot = orders.map((o) => o.id);
      const sorted = sortOrdersForPrint(orders);

      expect(sorted.map((o) => o.id)).toEqual(["ORD-001", "ORD-002"]);
      expect(orders.map((o) => o.id)).toEqual(snapshot);
    });
  });

  describe("matchesPrintSendingDateFilter", () => {
    const targetDate = "2026-11-25";

    it("due_on_or_before includes unpaused normal orders <= targetDate and scheduled/paused orders with sending_date <= targetDate", () => {
      const olderNormal = makeOrder({ id: "1", date: "2026-11-23T10:00:00Z" });
      const todayNormal = makeOrder({ id: "2", date: "2026-11-25T02:00:00Z" });
      const tomorrowNormal = makeOrder({ id: "3", date: "2026-11-26T02:00:00Z" });
      const dueScheduled = makeOrder({
        id: "4",
        date: "2026-11-20T02:00:00Z",
        is_paused: true,
        sending_date: "2026-11-25",
      });
      const overdueScheduled = makeOrder({
        id: "5",
        date: "2026-11-20T02:00:00Z",
        is_paused: false,
        sending_date: "2026-11-24",
      });
      const futureScheduled = makeOrder({
        id: "6",
        date: "2026-11-20T02:00:00Z",
        is_paused: true,
        sending_date: "2026-11-28",
      });
      const indefinitePause = makeOrder({
        id: "7",
        date: "2026-11-20T02:00:00Z",
        is_paused: true,
        sending_date: null,
      });

      expect(matchesPrintSendingDateFilter(olderNormal, { targetDate, mode: "due_on_or_before" })).toBe(true);
      expect(matchesPrintSendingDateFilter(todayNormal, { targetDate, mode: "due_on_or_before" })).toBe(true);
      expect(matchesPrintSendingDateFilter(tomorrowNormal, { targetDate, mode: "due_on_or_before" })).toBe(false);
      expect(matchesPrintSendingDateFilter(dueScheduled, { targetDate, mode: "due_on_or_before" })).toBe(true);
      expect(matchesPrintSendingDateFilter(overdueScheduled, { targetDate, mode: "due_on_or_before" })).toBe(true);
      expect(matchesPrintSendingDateFilter(futureScheduled, { targetDate, mode: "due_on_or_before" })).toBe(false);
      expect(matchesPrintSendingDateFilter(indefinitePause, { targetDate, mode: "due_on_or_before" })).toBe(false);
    });

    it("exact_date matches only sending_date === targetDate (or placed_at === targetDate when sending_date is null)", () => {
      const olderUnscheduled = makeOrder({ id: "1", date: "2026-11-23T10:00:00Z" });
      const todayUnscheduled = makeOrder({ id: "2", date: "2026-11-25T10:00:00Z" });
      const placedEarlierSendToday = makeOrder({
        id: "3",
        date: "2026-11-20T10:00:00Z",
        is_paused: true,
        sending_date: "2026-11-25",
      });
      const placedTodaySendFuture = makeOrder({
        id: "4",
        date: "2026-11-25T10:00:00Z",
        is_paused: false,
        sending_date: "2026-11-29",
      });

      expect(matchesPrintSendingDateFilter(olderUnscheduled, { targetDate, mode: "exact_date" })).toBe(false);
      expect(matchesPrintSendingDateFilter(todayUnscheduled, { targetDate, mode: "exact_date" })).toBe(true);
      expect(matchesPrintSendingDateFilter(placedEarlierSendToday, { targetDate, mode: "exact_date" })).toBe(true);
      expect(matchesPrintSendingDateFilter(placedTodaySendFuture, { targetDate, mode: "exact_date" })).toBe(false);
    });

    it("includeHeld=true allows paused and future-scheduled orders into the printable list", () => {
      const futurePaused = makeOrder({
        id: "1",
        is_paused: true,
        sending_date: "2026-11-30",
      });
      const indefinitePause = makeOrder({
        id: "2",
        is_paused: true,
        sending_date: null,
      });

      expect(matchesPrintSendingDateFilter(futurePaused, { targetDate, mode: "all", includeHeld: false })).toBe(false);
      expect(matchesPrintSendingDateFilter(futurePaused, { targetDate, mode: "due_on_or_before", includeHeld: true })).toBe(true);
      expect(matchesPrintSendingDateFilter(indefinitePause, { targetDate, mode: "all", includeHeld: true })).toBe(true);
    });
  });

  describe("getOrderDispatchHoldState", () => {
    const refDate = "2026-11-25";

    it("flags indefinitely paused, paused-until-date, and future-scheduled orders as held", () => {
      expect(
        getOrderDispatchHoldState(
          { status: "confirmed", is_paused: true, sending_date: null },
          refDate
        )
      ).toMatchObject({ held: true, reason: "paused_indefinite" });

      expect(
        getOrderDispatchHoldState(
          { status: "confirmed", is_paused: true, sending_date: "2026-11-28" },
          refDate
        )
      ).toMatchObject({ held: true, reason: "paused_until_date", label: "Paused until 28 Nov 2026" });

      expect(
        getOrderDispatchHoldState(
          { status: "confirmed", is_paused: false, sending_date: "2026-11-28" },
          refDate
        )
      ).toMatchObject({ held: true, reason: "scheduled_future", label: "Scheduled for 28 Nov 2026" });
    });

    it("releases hold once sending_date reaches or passes referenceDate, or for shipped/completed orders", () => {
      expect(
        getOrderDispatchHoldState(
          { status: "confirmed", is_paused: true, sending_date: "2026-11-25" },
          refDate
        )
      ).toEqual({ held: false, reason: null, label: "" });

      expect(
        getOrderDispatchHoldState(
          { status: "shipped", is_paused: true, sending_date: "2026-11-30" },
          refDate
        )
      ).toEqual({ held: false, reason: null, label: "" });
    });
  });
});
