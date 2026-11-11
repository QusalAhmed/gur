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

import { trackPageView, sendCapiClientEvent } from "@/lib/facebook-pixel";
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

    expect(layoutSource).toContain("fbq.disablePushState = true;");
    expect(layoutSource).toContain("fbq.allowDuplicatePageViews = true;");
    expect(layoutSource).not.toMatch(/fbq\(\s*['"]track['"]\s*,\s*['"]PageView['"]\s*\)/);
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
        pathname: "/admin/orders",
        href: "https://gur-phi.vercel.app/admin/orders",
      },
    });

    const eventId = trackPageView();
    expect(eventId).toBeNull();
    expect(fbqSpy).not.toHaveBeenCalled();
  });
});
