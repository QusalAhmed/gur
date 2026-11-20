import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockInngestSend, mockSendCapiEvents } = vi.hoisted(() => ({
  mockInngestSend: vi.fn().mockResolvedValue({ ids: ["evt-contact-mock"] }),
  mockSendCapiEvents: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: () => undefined,
  }),
  headers: vi.fn().mockResolvedValue({
    get: (name: string) => {
      if (name === "user-agent") return "Vitest-Contact-UA";
      if (name === "x-forwarded-for") return "203.0.113.50";
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
  trackContact,
  sendCapiClientEvent,
} from "@/lib/facebook-pixel";
import { sendCapiContactInternal } from "@/lib/capi-service";
import { sendCapiEvents } from "@/lib/facebook-capi";
import { POST as capiPostHandler } from "@/app/api/facebook-capi/route";

describe("Contact Browser & Server Deduplication Key (event_id)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the exact same eventId to browser fbq and server CAPI when trackContact is triggered", async () => {
    const fbqSpy = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    vi.stubGlobal("window", {
      fbq: fbqSpy,
      location: {
        pathname: "/contact",
        href: "https://khatikhejurgur.shop/contact",
      },
    });
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("fetch", fetchMock);

    const eventId = trackContact({
      channel: "whatsapp",
      refCode: "#W-TEST123",
      phone: "+8801700000000",
      customData: { source: "contact_page_test" },
    });

    expect(eventId).toBeTruthy();
    expect(fbqSpy).toHaveBeenCalledTimes(1);
    expect(fbqSpy).toHaveBeenCalledWith(
      "track",
      "Contact",
      expect.objectContaining({
        channel: "whatsapp",
        event_id: eventId,
        eventID: eventId,
        ref_code: "#W-TEST123",
      }),
      { eventID: eventId }
    );

    // Verify fetch received matching eventId and event_id
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, requestInit] = fetchMock.mock.calls[0];
    const clientPayload = JSON.parse(requestInit.body);
    expect(clientPayload.eventType).toBe("Contact");
    expect(clientPayload.eventId).toBe(eventId);
    expect(clientPayload.event_id).toBe(eventId);

    // Unstub window so the API route runs in a pure server context
    vi.unstubAllGlobals();

    // Pass the payload through the server API route POST /api/facebook-capi
    const req = new NextRequest("https://khatikhejurgur.shop/api/facebook-capi", {
      method: "POST",
      body: JSON.stringify(clientPayload),
      headers: { "Content-Type": "application/json" },
    });
    const res = await capiPostHandler(req);
    expect(res.status).toBe(200);

    // Verify Inngest received the event with the identical eventId
    expect(mockInngestSend).toHaveBeenCalledTimes(1);
    const queuedEvent = mockInngestSend.mock.calls[0][0];
    expect(queuedEvent.name).toBe("meta.capi.event");
    expect(queuedEvent.data.event.eventName).toBe("Contact");
    expect(queuedEvent.data.event.eventId).toBe(eventId);
    expect(queuedEvent.id).toBe(`capi-contact-${eventId}`);
  });

  it("handles snake_case event_id from server CAPI requests and preserves deduplication key", async () => {
    const customId = "evt_custom_contact_987654";
    const req = new NextRequest("https://khatikhejurgur.shop/api/facebook-capi", {
      method: "POST",
      body: JSON.stringify({
        eventType: "Contact",
        event_id: customId,
        channel: "phone",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await capiPostHandler(req);
    expect(res.status).toBe(200);

    expect(mockInngestSend).toHaveBeenCalledTimes(1);
    const queuedEvent = mockInngestSend.mock.calls[0][0];
    expect(queuedEvent.data.event.eventId).toBe(customId);
    expect(queuedEvent.id).toBe(`capi-contact-${customId}`);
  });

  it("automatically generates a valid deduplication key if eventId was omitted in server call", async () => {
    const result = await sendCapiContactInternal({
      channel: "phone",
      phone: "+8801711111111",
    });

    expect(result.success).toBe(true);
    expect(mockInngestSend).toHaveBeenCalledTimes(1);
    const queuedEvent = mockInngestSend.mock.calls[0][0];
    expect(queuedEvent.data.event.eventId).toMatch(/^evt_contact_/);
    expect(queuedEvent.data.event.customData?.event_id).toBe(queuedEvent.data.event.eventId);
  });

  it("guarantees top-level event_id in Meta Graph API payload in sendCapiEvents", async () => {
    // Test the unmocked sendCapiEvents implementation directly
    const actualCapi = await vi.importActual<typeof import("@/lib/facebook-capi")>(
      "@/lib/facebook-capi"
    );

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ events_received: 1 }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    process.env.FACEBOOK_CAPI_ACCESS_TOKEN = "TEST_TOKEN";
    process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID = "123456789";

    const testEventId = "evt_meta_test_contact_112233";

    await actualCapi.sendCapiEvents([
      {
        eventName: "Contact",
        eventId: testEventId,
        userData: {
          ph: "01712345678",
          client_ip_address: "1.2.3.4",
        },
        customData: {
          channel: "whatsapp",
        },
      },
    ]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, fetchOptions] = fetchSpy.mock.calls[0];
    const payload = JSON.parse(fetchOptions.body);

    expect(Array.isArray(payload.data)).toBe(true);
    expect(payload.data.length).toBe(1);

    const eventPayload = payload.data[0];
    // Meta requires event_id at top level of event for deduplication
    expect(eventPayload.event_name).toBe("Contact");
    expect(eventPayload.event_id).toBe(testEventId);
    expect(eventPayload.action_source).toBe("website");
  });
});
