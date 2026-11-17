import { beforeEach, describe, expect, it, vi } from "vitest";
import { NonRetriableError } from "inngest";

const { mockSendCapiEvents } = vi.hoisted(() => ({
  mockSendCapiEvents: vi.fn(),
}));

vi.mock("@/lib/facebook-capi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/facebook-capi")>();
  return {
    ...actual,
    sendCapiEvents: mockSendCapiEvents,
  };
});

import { dispatchMetaCapiBatch } from "@/lib/inngest/functions/meta-capi-batch";

const sampleEvent = (id: string) => ({
  eventName: "PageView" as const,
  eventId: id,
  eventSourceUrl: "https://khatikhejurgur.shop/",
  userData: { client_ip_address: "103.10.20.1" },
});

describe("dispatchMetaCapiBatch retry & error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dispatches a valid batch and returns processed count and Meta response", async () => {
    mockSendCapiEvents.mockResolvedValueOnce({
      success: true,
      data: { events_received: 2 },
    });

    const result = await dispatchMetaCapiBatch([
      { data: { event: sampleEvent("evt-1") } },
      { data: { event: sampleEvent("evt-2") } },
    ]);

    expect(mockSendCapiEvents).toHaveBeenCalledTimes(1);
    expect(mockSendCapiEvents).toHaveBeenCalledWith(
      [sampleEvent("evt-1"), sampleEvent("evt-2")],
      undefined
    );
    expect(result).toEqual({
      success: true,
      processedCount: 2,
      metaResponse: { events_received: 2 },
    });
  });

  it("returns processedCount 0 without calling Meta when batch has no valid events", async () => {
    const result = await dispatchMetaCapiBatch([{ data: {} }, {}]);
    expect(result).toEqual({ success: true, processedCount: 0 });
    expect(mockSendCapiEvents).not.toHaveBeenCalled();
  });

  it("throws a retriable Error on Meta 5xx, 429, network, or is_transient failures", async () => {
    const transientCases = [
      { success: false, status: 500, error: "Internal error" },
      { success: false, status: 429, error: "Too many requests" },
      { success: false, error: "Network timeout" },
      {
        success: false,
        status: 400,
        error: "Temporary issue",
        data: { error: { is_transient: true } },
      },
    ];

    for (const failure of transientCases) {
      mockSendCapiEvents.mockResolvedValueOnce(failure);
      let caught: unknown;
      try {
        await dispatchMetaCapiBatch([{ data: { event: sampleEvent("evt-retry") } }]);
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(Error);
      expect(caught).not.toBeInstanceOf(NonRetriableError);
      expect((caught as Error).message).toBe(failure.error);
    }
  });

  it("throws NonRetriableError on missing token or permanent 4xx Meta error", async () => {
    const permanentCases = [
      { success: false, error: "FACEBOOK_CAPI_ACCESS_TOKEN is not configured" },
      { success: false, status: 400, error: "Invalid parameter" },
      { success: false, status: 401, error: "Invalid OAuth access token" },
    ];

    for (const failure of permanentCases) {
      mockSendCapiEvents.mockResolvedValueOnce(failure);
      await expect(
        dispatchMetaCapiBatch([{ data: { event: sampleEvent("evt-perm") } }])
      ).rejects.toThrow(NonRetriableError);
    }
  });

  it("groups events by explicit testEventCode when present", async () => {
    mockSendCapiEvents
      .mockResolvedValueOnce({ success: true, data: { events_received: 1 } })
      .mockResolvedValueOnce({ success: true, data: { events_received: 1 } });

    const result = await dispatchMetaCapiBatch([
      { data: { event: sampleEvent("evt-prod") } },
      { data: { event: sampleEvent("evt-test"), testEventCode: "TEST999" } },
    ]);

    expect(mockSendCapiEvents).toHaveBeenCalledTimes(2);
    expect(mockSendCapiEvents).toHaveBeenNthCalledWith(1, [sampleEvent("evt-prod")], undefined);
    expect(mockSendCapiEvents).toHaveBeenNthCalledWith(2, [sampleEvent("evt-test")], {
      testEventCode: "TEST999",
    });
    expect(result.processedCount).toBe(2);
  });
});
