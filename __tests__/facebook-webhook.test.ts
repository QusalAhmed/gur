import { createHmac } from "node:crypto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/webhooks/facebook/route";

const { mockCreateNotification, mockSelectRows, mockUpdateEq, mockUpdate } = vi.hoisted(() => ({
  mockCreateNotification: vi.fn(),
  mockSelectRows: vi.fn(),
  mockUpdateEq: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock("@/lib/notifications-service", () => ({
  createNotificationInternal: mockCreateNotification,
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => {
      if (table !== "notifications") {
        throw new Error(`Unexpected table: ${table}`);
      }
      return {
        select: () => ({
          eq: () => ({
            gte: () => ({
              order: () => ({
                limit: () => mockSelectRows(),
              }),
            }),
          }),
        }),
        update: (payload: Record<string, any>) => {
          mockUpdate(payload);
          return {
            eq: (col: string, val: string) => mockUpdateEq(col, val),
          };
        },
      };
    },
  }),
}));

function makePostReq(payload: unknown, extraHeaders: Record<string, string> = {}) {
  return new NextRequest("https://www.khatikhejurgur.shop/api/webhooks/facebook", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}

describe("Facebook Webhook Endpoint", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.META_WEBHOOK_VERIFY_TOKEN = "gur_fb_webhook_verify_2026";
    delete process.env.META_PAGE_ACCESS_TOKEN;
    delete process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
    delete process.env.META_APP_SECRET;
    delete process.env.FACEBOOK_APP_SECRET;

    mockSelectRows.mockResolvedValue({ data: [], error: null });
    mockUpdateEq.mockResolvedValue({ error: null });
    mockCreateNotification.mockImplementation(async (input: any) => ({
      success: true,
      data: {
        id: `notif-${Math.random().toString(36).slice(2, 8)}`,
        type: input.type,
        title: input.title,
        message: input.message,
        data: input.data,
        is_read: false,
        read_at: null,
        created_at: new Date().toISOString(),
      },
    }));
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("GET verification handshake", () => {
    it("returns hub.challenge when token matches", async () => {
      const url =
        "https://www.khatikhejurgur.shop/api/webhooks/facebook?hub.mode=subscribe&hub.challenge=1158201444&hub.verify_token=gur_fb_webhook_verify_2026";
      const req = new NextRequest(url);

      const res = await GET(req);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("1158201444");
    });

    it("returns 403 when token does not match", async () => {
      const url =
        "https://www.khatikhejurgur.shop/api/webhooks/facebook?hub.mode=subscribe&hub.challenge=1158201444&hub.verify_token=wrong_token";
      const req = new NextRequest(url);

      const res = await GET(req);
      expect(res.status).toBe(403);
    });
  });

  describe("Optional HMAC signature verification", () => {
    it("rejects requests with invalid signature when META_APP_SECRET is set", async () => {
      process.env.META_APP_SECRET = "super_secret_123";
      const res = await POST(makePostReq({ object: "page", entry: [] }, {
        "x-hub-signature-256": "sha256=deadbeef",
      }));
      expect(res.status).toBe(401);
    });

    it("accepts requests with valid signature when META_APP_SECRET is set", async () => {
      process.env.META_APP_SECRET = "super_secret_123";
      const bodyObj = { object: "page", entry: [] };
      const raw = JSON.stringify(bodyObj);
      const sig = `sha256=${createHmac("sha256", "super_secret_123").update(raw, "utf8").digest("hex")}`;

      const res = await POST(makePostReq(bodyObj, { "x-hub-signature-256": sig }));
      expect(res.status).toBe(200);
    });
  });

  describe("POST comment webhook event", () => {
    it("processes a new comment and creates an admin notification", async () => {
      const payload = {
        object: "page",
        entry: [
          {
            id: "10001234567890",
            time: 1731600000,
            changes: [
              {
                field: "feed",
                value: {
                  item: "comment",
                  verb: "add",
                  comment_id: "10001234567890_99887766",
                  post_id: "10001234567890_11223344",
                  message: "Can I get 2kg Jhola Gur delivered to Chittagong?",
                  from: {
                    id: "customer_456",
                    name: "Tanvir Rahman",
                  },
                },
              },
            ],
          },
        ],
      };

      const res = await POST(makePostReq(payload));
      expect(res.status).toBe(200);
      expect(mockCreateNotification).toHaveBeenCalledTimes(1);

      const inserted = mockCreateNotification.mock.calls[0][0];
      expect(inserted.type).toBe("customer_inquiry");
      expect(inserted.title).toBe("💬 FB Comment from Tanvir Rahman");
      expect(inserted.message).toBe("Can I get 2kg Jhola Gur delivered to Chittagong?");
      expect(inserted.data.platform).toBe("facebook");
      expect(inserted.data.alert_subtype).toBe("facebook_comment");
      expect(inserted.data.comment_id).toBe("10001234567890_99887766");
      expect(inserted.data.link).toBe("https://facebook.com/10001234567890_99887766");
    });

    it("ignores comments made by the page itself", async () => {
      const payload = {
        object: "page",
        entry: [
          {
            id: "10001234567890",
            time: 1731600000,
            changes: [
              {
                field: "feed",
                value: {
                  item: "comment",
                  verb: "add",
                  comment_id: "reply_99",
                  from: {
                    id: "10001234567890",
                    name: "Khati Khejurgur",
                  },
                  message: "Yes sir, delivery takes 2-3 days!",
                },
              },
            ],
          },
        ],
      };

      const res = await POST(makePostReq(payload));
      expect(res.status).toBe(200);
      expect(mockCreateNotification).not.toHaveBeenCalled();
    });
  });

  describe("POST Messenger customer message webhook events", () => {
    it("resolves customer name via Graph API and links to Meta Business Suite Inbox", async () => {
      process.env.META_PAGE_ACCESS_TOKEN = "page_token_xyz";
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ first_name: "Nusrat", last_name: "Jahan" }),
      }) as any;

      const payload = {
        object: "page",
        entry: [
          {
            id: "9988776655",
            time: 1731600000000,
            messaging: [
              {
                sender: { id: "psid_101" },
                recipient: { id: "9988776655" },
                timestamp: 1731600000000,
                message: {
                  mid: "m_abc123",
                  text: "1kg Patali Gur price koto?",
                },
              },
            ],
          },
        ],
      };

      const res = await POST(makePostReq(payload));
      expect(res.status).toBe(200);
      expect(mockCreateNotification).toHaveBeenCalledTimes(1);

      const created = mockCreateNotification.mock.calls[0][0];
      expect(created.type).toBe("customer_inquiry");
      expect(created.title).toBe("📩 FB Message from Nusrat Jahan");
      expect(created.message).toBe("1kg Patali Gur price koto?");
      expect(created.data.platform).toBe("facebook");
      expect(created.data.alert_subtype).toBe("facebook_message");
      expect(created.data.sender_id).toBe("psid_101");
      expect(created.data.message_id).toBe("m_abc123");
      expect(created.data.link).toBe(
        "https://business.facebook.com/latest/inbox/all?asset_id=9988776655&selected_item_id=psid_101"
      );
    });

    it("falls back to 'Facebook Customer' when META_PAGE_ACCESS_TOKEN is not configured", async () => {
      const payload = {
        object: "page",
        entry: [
          {
            id: "9988776655",
            time: 1731600000000,
            messaging: [
              {
                sender: { id: "psid_202" },
                recipient: { id: "9988776655" },
                timestamp: 1731600000000,
                message: {
                  mid: "m_fallback_1",
                  text: "Assalamu alaikum",
                },
              },
            ],
          },
        ],
      };

      const res = await POST(makePostReq(payload));
      expect(res.status).toBe(200);
      expect(mockCreateNotification).toHaveBeenCalledTimes(1);

      const created = mockCreateNotification.mock.calls[0][0];
      expect(created.title).toBe("📩 FB Message from Facebook Customer");
      expect(created.message).toBe("Assalamu alaikum");
    });

    it("handles attachments (images, voice notes, stickers) and ad/button postbacks", async () => {
      const payload = {
        object: "page",
        entry: [
          {
            id: "9988776655",
            time: 1731600000000,
            messaging: [
              {
                sender: { id: "psid_img" },
                recipient: { id: "9988776655" },
                timestamp: 1731600000001,
                message: {
                  mid: "m_img_1",
                  attachments: [{ type: "image", payload: { url: "https://cdn.fb.com/1.jpg" } }],
                },
              },
              {
                sender: { id: "psid_audio" },
                recipient: { id: "9988776655" },
                timestamp: 1731600000002,
                message: {
                  mid: "m_audio_1",
                  attachments: [{ type: "audio", payload: { url: "https://cdn.fb.com/voice.mp4" } }],
                },
              },
              {
                sender: { id: "psid_sticker" },
                recipient: { id: "9988776655" },
                timestamp: 1731600000003,
                message: {
                  mid: "m_sticker_1",
                  sticker_id: 369239263222822,
                  attachments: [
                    { type: "image", payload: { url: "https://cdn.fb.com/thumb.png", sticker_id: 369239263222822 } },
                  ],
                },
              },
              {
                sender: { id: "psid_pb" },
                recipient: { id: "9988776655" },
                timestamp: 1731600000004,
                postback: {
                  mid: "m_pb_1",
                  title: "Order 1kg Patali Gur",
                  payload: "ORDER_1KG",
                },
              },
            ],
          },
        ],
      };

      const res = await POST(makePostReq(payload));
      expect(res.status).toBe(200);
      expect(mockCreateNotification).toHaveBeenCalledTimes(4);

      expect(mockCreateNotification.mock.calls[0][0].message).toBe("📷 Sent an image");
      expect(mockCreateNotification.mock.calls[1][0].message).toBe("🎤 Sent a voice message");
      expect(mockCreateNotification.mock.calls[2][0].message).toBe("👍 Sent a sticker");
      expect(mockCreateNotification.mock.calls[3][0].message).toBe('Clicked: "Order 1kg Patali Gur"');
    });

    it("ignores page echoes, self-messages, delivery receipts, read receipts, and reactions", async () => {
      const payload = {
        object: "page",
        entry: [
          {
            id: "9988776655",
            time: 1731600000000,
            messaging: [
              {
                sender: { id: "9988776655" },
                recipient: { id: "psid_1" },
                message: { mid: "m_echo", text: "Hello from page", is_echo: true },
              },
              {
                sender: { id: "psid_1" },
                recipient: { id: "9988776655" },
                message: { mid: "m_echo_2", text: "Echo flag", is_echo: true },
              },
              {
                sender: { id: "psid_1" },
                recipient: { id: "9988776655" },
                delivery: { mids: ["m_1"], watermark: 1731600000000 },
              },
              {
                sender: { id: "psid_1" },
                recipient: { id: "9988776655" },
                read: { watermark: 1731600000000 },
              },
              {
                sender: { id: "psid_1" },
                recipient: { id: "9988776655" },
                reaction: { mid: "m_1", action: "react", emoji: "❤️" },
              },
            ],
          },
        ],
      };

      const res = await POST(makePostReq(payload));
      expect(res.status).toBe(200);
      expect(mockCreateNotification).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("deduplicates exact webhook retries by message ID", async () => {
      mockSelectRows.mockResolvedValue({
        data: [
          {
            id: "notif-existing-1",
            title: "📩 FB Message from Karim",
            message: "Price koto?",
            is_read: false,
            created_at: new Date().toISOString(),
            data: {
              platform: "facebook",
              alert_subtype: "facebook_message",
              sender_id: "psid_dup",
              sender_name: "Karim",
              message_id: "m_retry_001",
              message_ids: ["m_retry_001"],
            },
          },
        ],
        error: null,
      });

      const payload = {
        object: "page",
        entry: [
          {
            id: "9988776655",
            messaging: [
              {
                sender: { id: "psid_dup" },
                recipient: { id: "9988776655" },
                message: { mid: "m_retry_001", text: "Price koto?" },
              },
            ],
          },
        ],
      };

      const res = await POST(makePostReq(payload));
      expect(res.status).toBe(200);
      expect(mockCreateNotification).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("merges rapid burst messages within 60s from the same customer without creating duplicate alerts", async () => {
      const nowIso = new Date().toISOString();
      mockSelectRows.mockResolvedValue({
        data: [
          {
            id: "notif-burst-1",
            title: "📩 FB Message from Rahim",
            message: "Assalamu alaikum",
            is_read: false,
            created_at: nowIso,
            data: {
              platform: "facebook",
              alert_subtype: "facebook_message",
              page_id: "9988776655",
              sender_id: "psid_burst",
              sender_name: "Rahim",
              message_id: "m_b1",
              message_ids: ["m_b1"],
              message_count: 1,
              recent_messages: ["Assalamu alaikum"],
              full_message: "Assalamu alaikum",
              last_message_at: nowIso,
              link: "https://business.facebook.com/latest/inbox/all?asset_id=9988776655&selected_item_id=psid_burst",
            },
          },
        ],
        error: null,
      });

      const payload = {
        object: "page",
        entry: [
          {
            id: "9988776655",
            messaging: [
              {
                sender: { id: "psid_burst" },
                recipient: { id: "9988776655" },
                message: { mid: "m_b2", text: "Vai 2kg Patali gur lagbe" },
              },
              {
                sender: { id: "psid_burst" },
                recipient: { id: "9988776655" },
                message: { mid: "m_b3", text: "Dhaka delivery charge koto?" },
              },
            ],
          },
        ],
      };

      const res = await POST(makePostReq(payload));
      expect(res.status).toBe(200);
      expect(mockCreateNotification).not.toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalledTimes(2);
      expect(mockUpdateEq).toHaveBeenCalledWith("id", "notif-burst-1");

      const finalUpdate = mockUpdate.mock.calls[1][0];
      expect(finalUpdate.title).toBe("📩 FB Message from Rahim (3)");
      expect(finalUpdate.message).toBe(
        "Assalamu alaikum · Vai 2kg Patali gur lagbe · Dhaka delivery charge koto?"
      );
      expect(finalUpdate.data.message_count).toBe(3);
      expect(finalUpdate.data.message_ids).toEqual(["m_b1", "m_b2", "m_b3"]);
    });

    it("creates a fresh alert when the previous message from the same sender is >60s old or already read", async () => {
      const twoMinsAgo = new Date(Date.now() - 120_000).toISOString();
      mockSelectRows.mockResolvedValue({
        data: [
          {
            id: "notif-old-1",
            title: "📩 FB Message from Rahim",
            message: "Earlier message",
            is_read: false,
            created_at: twoMinsAgo,
            data: {
              platform: "facebook",
              alert_subtype: "facebook_message",
              sender_id: "psid_old",
              sender_name: "Rahim",
              message_id: "m_old_1",
              message_ids: ["m_old_1"],
              last_message_at: twoMinsAgo,
            },
          },
        ],
        error: null,
      });

      const payload = {
        object: "page",
        entry: [
          {
            id: "9988776655",
            messaging: [
              {
                sender: { id: "psid_old" },
                recipient: { id: "9988776655" },
                message: { mid: "m_new_2", text: "Are you there?" },
              },
            ],
          },
        ],
      };

      const res = await POST(makePostReq(payload));
      expect(res.status).toBe(200);
      expect(mockCreateNotification).toHaveBeenCalledTimes(1);
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });
});
