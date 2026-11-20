import { describe, it, expect } from "vitest";
import { canRoleAccessPath, sanitizeAdminRedirect } from "@/lib/admin-permissions";
import { formatCustomerAddress } from "@/lib/admin-format";

describe("Customer Call Lists & Telecalling", () => {
  describe("Route RBAC Permissions", () => {
    it("allows owner, admin, manager, and support to access /admin/calls", () => {
      expect(canRoleAccessPath("owner", "/admin/calls")).toBe(true);
      expect(canRoleAccessPath("admin", "/admin/calls")).toBe(true);
      expect(canRoleAccessPath("manager", "/admin/calls")).toBe(true);
      expect(canRoleAccessPath("support", "/admin/calls")).toBe(true);
    });

    it("allows owner, admin, manager, and support to access creation page /admin/calls/new", () => {
      expect(canRoleAccessPath("owner", "/admin/calls/new")).toBe(true);
      expect(canRoleAccessPath("admin", "/admin/calls/new")).toBe(true);
      expect(canRoleAccessPath("manager", "/admin/calls/new")).toBe(true);
      expect(canRoleAccessPath("support", "/admin/calls/new")).toBe(true);
    });

    it("allows owner, admin, manager, and support to access specific list routes /admin/calls/:id", () => {
      const listId = "123e4567-e89b-12d3-a456-426614174000";
      expect(canRoleAccessPath("owner", `/admin/calls/${listId}`)).toBe(true);
      expect(canRoleAccessPath("admin", `/admin/calls/${listId}`)).toBe(true);
      expect(canRoleAccessPath("manager", `/admin/calls/${listId}`)).toBe(true);
      expect(canRoleAccessPath("support", `/admin/calls/${listId}`)).toBe(true);
    });

    it("blocks editor role from accessing /admin/calls (fail-closed)", () => {
      expect(canRoleAccessPath("editor", "/admin/calls")).toBe(false);
      expect(canRoleAccessPath("editor", "/admin/calls/any-id")).toBe(false);
    });
  });

  describe("Admin Redirection & Security", () => {
    it("recognizes /admin/calls as a valid safe admin redirect target", () => {
      expect(sanitizeAdminRedirect("/admin/calls")).toBe("/admin/calls");
      expect(sanitizeAdminRedirect("/admin/calls?tab=due")).toBe("/admin/calls?tab=due");
    });

    it("sanitizes malicious or external redirects", () => {
      expect(sanitizeAdminRedirect("https://malicious.com/admin/calls")).toBe("/admin");
      expect(sanitizeAdminRedirect("//malicious.com/admin/calls")).toBe("/admin");
    });
  });

  describe("Call List Metrics & Progress Logic", () => {
    it("calculates progress percentage correctly", () => {
      const calculateProgress = (total: number, completed: number) =>
        total > 0 ? Math.round((completed / total) * 100) : 0;

      expect(calculateProgress(0, 0)).toBe(0);
      expect(calculateProgress(50, 25)).toBe(50);
      expect(calculateProgress(3, 1)).toBe(33);
      expect(calculateProgress(10, 10)).toBe(100);
    });

    it("identifies callback due status accurately", () => {
      const isCallbackDue = (callbackAt: string | null, status: string) => {
        if (status !== "call_later" || !callbackAt) return false;
        return new Date(callbackAt).getTime() <= Date.now();
      };

      const past = new Date(Date.now() - 10_000).toISOString();
      const future = new Date(Date.now() + 3_600_000).toISOString();

      expect(isCallbackDue(past, "call_later")).toBe(true);
      expect(isCallbackDue(future, "call_later")).toBe(false);
      expect(isCallbackDue(past, "no_answer")).toBe(false);
      expect(isCallbackDue(null, "call_later")).toBe(false);
    });
  });

  describe("Date Range Filter Logic", () => {
    it("formats start and end dates into proper ISO boundaries", () => {
      const startDate = "2025-11-01";
      const endDate = "2026-04-01";

      const startIso = new Date(startDate + "T00:00:00Z").toISOString();
      const endIso = new Date(endDate + "T23:59:59.999Z").toISOString();

      expect(startIso).toBe("2025-11-01T00:00:00.000Z");
      expect(endIso).toBe("2026-04-01T23:59:59.999Z");
      expect(new Date(startIso).getTime()).toBeLessThan(new Date(endIso).getTime());
    });

    it("correctly identifies orders within the winter date window", () => {
      const windowStart = new Date("2025-11-01T00:00:00.000Z").getTime();
      const windowEnd = new Date("2026-04-01T23:59:59.999Z").getTime();

      const inRangeDate = new Date("2026-01-15T12:00:00.000Z").getTime();
      const beforeDate = new Date("2025-10-31T23:59:59.000Z").getTime();
      const afterDate = new Date("2026-04-02T00:00:00.000Z").getTime();

      expect(inRangeDate >= windowStart && inRangeDate <= windowEnd).toBe(true);
      expect(beforeDate >= windowStart && beforeDate <= windowEnd).toBe(false);
      expect(afterDate >= windowStart && afterDate <= windowEnd).toBe(false);
    });
  });

  describe("Customer Profile & Order History Formatters", () => {
    it("gracefully formats real-world Bangladeshi store address objects", () => {
      const realAddress = {
        address_line: "Road = 6/a house= 01 sector= 05. Uttara. \nDhaka.",
        city: "dhaka",
        division: "Dhaka",
        postal_code: "1230",
        full_name: "Md. Aminur Rashid",
        is_home_delivery: true,
      };

      const parsed = formatCustomerAddress(realAddress);
      expect(parsed).not.toBeNull();
      expect(parsed?.addressLine).toBe("Road = 6/a house= 01 sector= 05. Uttara. \nDhaka.");
      expect(parsed?.areaLine).toContain("Postal: 1230");
      expect(parsed?.recipientName).toBe("Md. Aminur Rashid");
      expect(parsed?.isHomeDelivery).toBe(true);
      expect(parsed?.fullAddress).toContain("Road = 6/a house= 01 sector= 05. Uttara.");
    });

    it("gracefully ignores empty default_address objects so caller can fallback to orders", () => {
      const emptyAddress = {
        address_line: "",
        district: "",
        division: "",
        phone: "+8801723887396",
        recipient_name: "Customer",
        zone: "inside_dhaka",
      };

      expect(formatCustomerAddress(emptyAddress)).toBeNull();
      expect(formatCustomerAddress(null)).toBeNull();
      expect(formatCustomerAddress("")).toBeNull();
      expect(formatCustomerAddress("{}")).toBeNull();
    });

    it("parses plain string address lines correctly", () => {
      const parsed = formatCustomerAddress("Tentulia, Bagha, Rajshahi");
      expect(parsed?.fullAddress).toBe("Tentulia, Bagha, Rajshahi");
      expect(parsed?.addressLine).toBe("Tentulia, Bagha, Rajshahi");
    });

    it("preserves landmark and upazila fields", () => {
      const withLandmark = {
        address_line: "Kala Bagan Lake Circus",
        upazila: "Kalabagan",
        district: "Dhaka",
        landmark: "Beside water pump",
        is_home_delivery: false,
      };

      const parsed = formatCustomerAddress(withLandmark);
      expect(parsed?.landmark).toBe("Beside water pump");
      expect(parsed?.upazila).toBe("Kalabagan");
      expect(parsed?.isHomeDelivery).toBe(false);
      expect(parsed?.fullAddress).toContain("Kala Bagan Lake Circus");
      expect(parsed?.fullAddress).toContain("Kalabagan, Dhaka");
    });

    it("calculates customer delivery history and success rate accurately", () => {
      const calculateDeliveryStats = (orders: { status: string }[]) => {
        const totalOrders = orders.length;
        const deliveredCount = orders.filter((o) => o.status === "delivered").length;
        const shippedCount = orders.filter((o) => o.status === "shipped").length;
        const cancelledCount = orders.filter((o) => o.status === "cancelled").length;
        const returnedCount = orders.filter((o) => o.status === "returned").length;
        const pendingCount = orders.filter((o) =>
          ["pending", "confirmed", "processing"].includes(o.status)
        ).length;

        const resolvedCount = deliveredCount + cancelledCount + returnedCount;
        const successRate =
          resolvedCount > 0
            ? Math.round((deliveredCount / resolvedCount) * 100)
            : deliveredCount > 0
            ? 100
            : 0;

        return {
          totalOrders,
          deliveredCount,
          shippedCount,
          cancelledCount,
          returnedCount,
          pendingCount,
          successRate,
        };
      };

      const mockOrders = [
        { status: "delivered" },
        { status: "delivered" },
        { status: "delivered" },
        { status: "shipped" },
        { status: "cancelled" },
      ];

      const stats = calculateDeliveryStats(mockOrders);
      expect(stats.totalOrders).toBe(5);
      expect(stats.deliveredCount).toBe(3);
      expect(stats.shippedCount).toBe(1);
      expect(stats.cancelledCount).toBe(1);
      expect(stats.returnedCount).toBe(0);
      // Resolved = 3 delivered + 1 cancelled = 4. 3 / 4 = 75%
      expect(stats.successRate).toBe(75);
    });

    it("calculates order items totals accurately", () => {
      const items = [
        { productName: "Patali Gur", quantity: 2, unitPrice: 650, lineTotal: 1300 },
        { productName: "Jhola Gur", quantity: 1, unitPrice: 800, lineTotal: 800 },
      ];

      const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
      const delivery = 120;
      const discount = 100;
      const grandTotal = subtotal - discount + delivery;

      expect(subtotal).toBe(2100);
      expect(grandTotal).toBe(2120);
    });
  });
});
