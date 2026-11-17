import { describe, it, expect } from "vitest";
import {
  redactPhoneNumbers,
  resolveNotificationPermissionPath,
  canRoleReceiveNotification,
  buildPushPayload,
  isValidPushEndpoint,
} from "@/lib/push/web-push";

describe("Admin PWA Web Push helpers", () => {
  describe("redactPhoneNumbers", () => {
    it("redacts Bangladeshi mobile numbers in various formats", () => {
      expect(
        redactPhoneNumbers("ORD-20261117-001 · Draft lead from 01712345678 (৳850.00)")
      ).toBe("ORD-20261117-001 · Draft lead from Customer (৳850.00)");

      expect(
        redactPhoneNumbers("Customer +8801812345678 requested phone assistance (Draft: ORD-1024)")
      ).toBe("A customer requested phone assistance (Draft: ORD-1024)");

      expect(
        redactPhoneNumbers("গ্রাহক 01912-345678 চেকআউট শুরু করেছিলেন (মোট ৳1250)।")
      ).toBe("একজন গ্রাহক চেকআউট শুরু করেছিলেন (মোট ৳1250)।");
    });

    it("preserves order numbers, currency amounts, and customer names", () => {
      const msg = "ORD-20261117-042 · ৳2,450.00 from Rahim Uddin";
      expect(redactPhoneNumbers(msg)).toBe(msg);
    });
  });

  describe("RBAC notification filtering (canRoleReceiveNotification)", () => {
    const orderNotif = {
      type: "order_created" as const,
      data: { order_number: "ORD-1001", link: "/admin/orders?search=ORD-1001" },
    };
    const incompleteNotif = {
      type: "system_alert" as const,
      data: {
        alert_subtype: "incomplete_order_lead",
        status: "incomplete_order",
        order_number: "ORD-1002",
        link: "/admin/orders?search=ORD-1002&status=incomplete_order",
      },
    };
    const inquiryNotif = {
      type: "customer_inquiry" as const,
      data: { platform: "facebook", link: "https://facebook.com/123" },
    };
    const lowStockNotif = {
      type: "low_stock" as const,
      data: { sku: "GUR-1KG", link: "/admin/inventory" },
    };
    const generalSystemNotif = {
      type: "system_alert" as const,
      data: {},
    };

    it("allows owner, admin, manager, and support to receive all notification types", () => {
      for (const role of ["owner", "admin", "manager", "support"] as const) {
        expect(canRoleReceiveNotification(role, orderNotif)).toBe(true);
        expect(canRoleReceiveNotification(role, incompleteNotif)).toBe(true);
        expect(canRoleReceiveNotification(role, inquiryNotif)).toBe(true);
        expect(canRoleReceiveNotification(role, lowStockNotif)).toBe(true);
        expect(canRoleReceiveNotification(role, generalSystemNotif)).toBe(true);
      }
    });

    it("restricts editors to inventory low-stock and non-order system alerts", () => {
      expect(canRoleReceiveNotification("editor", orderNotif)).toBe(false);
      expect(canRoleReceiveNotification("editor", incompleteNotif)).toBe(false);
      expect(canRoleReceiveNotification("editor", inquiryNotif)).toBe(false);
      expect(canRoleReceiveNotification("editor", lowStockNotif)).toBe(true);
      expect(canRoleReceiveNotification("editor", generalSystemNotif)).toBe(true);
    });

    it("resolves canonical permission paths accurately", () => {
      expect(resolveNotificationPermissionPath(orderNotif)).toBe("/admin/orders");
      expect(resolveNotificationPermissionPath(incompleteNotif)).toBe("/admin/incomplete");
      expect(resolveNotificationPermissionPath(inquiryNotif)).toBe("/admin/messages");
      expect(resolveNotificationPermissionPath(lowStockNotif)).toBe("/admin/inventory");
      expect(resolveNotificationPermissionPath(generalSystemNotif)).toBe("/admin");
    });
  });

  describe("buildPushPayload", () => {
    it("redacts phone numbers and attaches icons, badge, url, and unread count", () => {
      const payload = buildPushPayload(
        {
          id: "11111111-1111-1111-1111-111111111111",
          type: "order_created",
          title: "New order placed",
          message: "ORD-505 · ৳1,800.00 from 01799887766",
          data: {
            order_id: "22222222-2222-2222-2222-222222222222",
            order_number: "ORD-505",
            link: "/admin/orders?search=ORD-505",
          },
        },
        7
      );

      expect(payload.title).toBe("New order placed");
      expect(payload.body).toBe("ORD-505 · ৳1,800.00 from Customer");
      expect(payload.body).not.toContain("01799887766");
      expect(payload.icon).toBe("/admin-icon/icon-192.png");
      expect(payload.badge).toBe("/icons/admin-badge-96.png");
      expect(payload.url).toBe("/admin/orders?search=ORD-505");
      expect(payload.unreadCount).toBe(7);
      expect(payload.orderNumber).toBe("ORD-505");
    });
  });

  describe("isValidPushEndpoint", () => {
    it("accepts valid HTTPS push service endpoints", () => {
      expect(
        isValidPushEndpoint("https://fcm.googleapis.com/fcm/send/abc123")
      ).toBe(true);
      expect(
        isValidPushEndpoint("https://web.push.apple.com/QAbc123")
      ).toBe(true);
    });

    it("rejects non-HTTPS, localhost, and malformed endpoints", () => {
      expect(isValidPushEndpoint("http://fcm.googleapis.com/send/abc")).toBe(false);
      expect(isValidPushEndpoint("https://localhost/push")).toBe(false);
      expect(isValidPushEndpoint("javascript:alert(1)")).toBe(false);
      expect(isValidPushEndpoint("")).toBe(false);
    });
  });
});
