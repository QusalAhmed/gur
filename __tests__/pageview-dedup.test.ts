import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";

const { mockInngestSend, mockSendCapiEvents } = vi.hoisted(() => ({
  mockInngestSend: vi.fn().mockResolvedValue({ ids: ["evt-pageview-mock"] }),
  mockSendCapiEvents: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: () => undefined,
  }),
  headers: vi.fn().mockResolvedValue({
    get: (name: string) => {
      if (name === "user-agent") return "Vitest-UA";
      if (name === "x-forwarded-for") return "203.0.113.10";
      return null;
    },
  }),
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    send: mockInngestSend,
  },
}));

vi.mock("@/lib/facebook-capi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/facebook-capi")>();
  return {
    ...actual,
    sendCapiEvents: mockSendCapiEvents,
  };
});

import {
  trackPageView,
  sendCapiClientEvent,
  getClientFbpAndFbc,
  waitForClientFbpAndFbc,
  isPixelAdminHostOrPath,
  fbq,
} from "@/lib/facebook-pixel";
import { sendCapiPageViewInternal } from "@/lib/capi-service";
import { POST as capiPostHandler } from "@/app/api/facebook-capi/route";

describe("PageView Browser & Server Event ID Deduplication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not fire an untagged PageView in app/layout.tsx and disables automatic pushState tracking", () => {
    const layoutSource = fs.readFileSync(
      path.resolve(process.cwd(), "app/layout.tsx"),
      "utf-8"
    );

    expect(layoutSource).toContain('strategy="afterInteractive"');
    expect(layoutSource).toContain("fbq.disablePushState = true;");
    expect(layoutSource).toContain("fbq.allowDuplicatePageViews = true;");
    expect(layoutSource).not.toMatch(/fbq\(\s*['"]track['"]\s*,\s*['"]PageView['"]\s*\)/);
  });

  it("derives _fbc from fbclid query parameter when _fbc cookie is not yet set", () => {
    vi.stubGlobal("document", { cookie: "_fbp=fb.1.1700000000000.1234567890" });
    vi.stubGlobal("window", {
      location: { search: "?fbclid=IwAR_TestCase123" },
    });

    const { fbp, fbc } = getClientFbpAndFbc();
    expect(fbp).toBe("fb.1.1700000000000.1234567890");
    expect(fbc).toMatch(/^fb\.1\.\d+\.IwAR_TestCase123$/);
  });

  it("waits briefly for _fbp on cold visit and resolves as soon as _fbp cookie appears", async () => {
    vi.useFakeTimers();
    try {
      const doc = { cookie: "" };
      vi.stubGlobal("document", doc);
      vi.stubGlobal("window", {
        location: { search: "" },
        setInterval: globalThis.setInterval,
        clearInterval: globalThis.clearInterval,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      });

      const pending = waitForClientFbpAndFbc(1500);

      // Simulate fbevents.js setting _fbp after 200ms
      setTimeout(() => {
        doc.cookie = "_fbp=fb.1.1700000000000.9988776655";
      }, 200);

      await vi.advanceTimersByTimeAsync(250);
      const res = await pending;
      expect(res.fbp).toBe("fb.1.1700000000000.9988776655");
    } finally {
      vi.useRealTimers();
    }
  });

  it("sends the exact same eventId to browser fbq and server CAPI for PageView", async () => {
    const fbqSpy = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    vi.stubGlobal("window", {
      fbq: fbqSpy,
      location: {
        pathname: "/products",
        href: "https://gur-phi.vercel.app/products",
      },
    });
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("fetch", fetchMock);

    const eventId = trackPageView();
    expect(eventId).toBeTruthy();
    expect(fbqSpy).toHaveBeenCalledTimes(1);
    expect(fbqSpy).toHaveBeenCalledWith("track", "PageView", {}, { eventID: eventId });

    await sendCapiClientEvent("PageView", {
      eventId,
      url: window.location.href,
      fbp: "fb.1.1700000000000.1234567890",
      fbc: null,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, requestInit] = fetchMock.mock.calls[0];
    const clientPayload = JSON.parse(requestInit.body);
    expect(clientPayload.eventType).toBe("PageView");
    expect(clientPayload.eventId).toBe(eventId);

    const req = new NextRequest("https://gur-phi.vercel.app/api/facebook-capi", {
      method: "POST",
      body: JSON.stringify(clientPayload),
      headers: { "Content-Type": "application/json" },
    });
    const res = await capiPostHandler(req);
    expect(res.status).toBe(200);

    expect(mockInngestSend).toHaveBeenCalledTimes(1);
    const queuedEvent = mockInngestSend.mock.calls[0][0];
    expect(queuedEvent.name).toBe("meta.capi.event");
    expect(queuedEvent.data.event.eventName).toBe("PageView");
    expect(queuedEvent.data.event.eventId).toBe(eventId);
  });

  it("falls back to direct sendCapiEvents with the matching eventId if Inngest fails", async () => {
    mockInngestSend.mockRejectedValueOnce(new Error("Inngest offline"));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const eventId = "pv-dedup-test-1234";
    await sendCapiPageViewInternal({
      eventId,
      url: "https://gur-phi.vercel.app/",
      fbp: "fb.1.1700000000000.1234567890",
      fbc: null,
    });

    warnSpy.mockRestore();

    expect(mockSendCapiEvents).toHaveBeenCalledTimes(1);
    expect(mockSendCapiEvents.mock.calls[0][0]).toEqual([
      expect.objectContaining({
        eventName: "PageView",
        eventId,
      }),
    ]);
  });

  it("skips PageView tracking on /admin routes", () => {
    const fbqSpy = vi.fn();
    vi.stubGlobal("window", {
      fbq: fbqSpy,
      location: {
        hostname: "khatikhejurgur.shop",
        pathname: "/admin/orders",
        href: "https://khatikhejurgur.shop/admin/orders",
      },
    });

    const eventId = trackPageView();
    expect(eventId).toBeNull();
    expect(fbqSpy).not.toHaveBeenCalled();
  });

  it("skips PageView tracking on admin.* subdomains", () => {
    const fbqSpy = vi.fn();
    vi.stubGlobal("window", {
      fbq: fbqSpy,
      location: {
        hostname: "admin.khatikhejurgur.shop",
        pathname: "/orders",
        href: "https://admin.khatikhejurgur.shop/orders",
      },
    });

    const eventId = trackPageView();
    expect(eventId).toBeNull();
    expect(fbqSpy).not.toHaveBeenCalled();
  });

  it("identifies admin subdomains and paths correctly via isPixelAdminHostOrPath", () => {
    expect(isPixelAdminHostOrPath("admin.khatikhejurgur.shop", "/")).toBe(true);
    expect(isPixelAdminHostOrPath("admin.localhost", "/orders")).toBe(true);
    expect(isPixelAdminHostOrPath("admin", "/products")).toBe(true);
    expect(isPixelAdminHostOrPath("khatikhejurgur.shop", "/admin")).toBe(true);
    expect(isPixelAdminHostOrPath("khatikhejurgur.shop", "/admin/settings")).toBe(true);
    expect(isPixelAdminHostOrPath("localhost", "/admin")).toBe(true);
    expect(isPixelAdminHostOrPath("khatikhejurgur.shop", "/")).toBe(false);
    expect(isPixelAdminHostOrPath("khatikhejurgur.shop", "/products")).toBe(false);
    expect(isPixelAdminHostOrPath("localhost", "/")).toBe(false);
  });

  it("does not execute fbq or queue on admin routes or hosts", () => {
    const fbqSpy = vi.fn();
    const win = {
      fbq: fbqSpy,
      _fbqQueue: [] as any[],
      location: {
        hostname: "admin.khatikhejurgur.shop",
        pathname: "/orders",
      },
    };
    vi.stubGlobal("window", win);

    fbq("track", "PageView");
    expect(fbqSpy).not.toHaveBeenCalled();
    expect(win._fbqQueue.length).toBe(0);
  });

  it("skips sendCapiPageViewInternal for admin URLs", async () => {
    const res = await sendCapiPageViewInternal({
      eventId: "admin-pv-1",
      url: "https://admin.khatikhejurgur.shop/orders",
    });
    expect(res).toEqual({ success: true, skipped: true });
    expect(mockSendCapiEvents).not.toHaveBeenCalled();
    expect(mockInngestSend).not.toHaveBeenCalled();
  });

  it("verifies layout source guards fb-pixel script against admin panel execution", () => {
    const layoutSource = fs.readFileSync(
      path.resolve(process.cwd(), "app/layout.tsx"),
      "utf-8"
    );

    expect(layoutSource).toContain('h==="admin"||h.indexOf("admin.")===0||p==="/admin"||p.indexOf("/admin/")===0');
  });

  it("ensures FacebookPixelTracker does not delay PageView with requestIdleCallback", () => {
    const trackerSource = fs.readFileSync(
      path.resolve(process.cwd(), "components/providers/facebook-pixel-tracker.tsx"),
      "utf-8"
    );

    expect(trackerSource).not.toContain("requestIdleCallback");
    expect(trackerSource).toContain("const eventId = trackPageView();");
    expect(trackerSource).toContain('sendCapiClientEvent("PageView"');
  });
});
