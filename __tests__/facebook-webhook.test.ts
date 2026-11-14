import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/webhooks/facebook/route";

const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockFrom = vi.fn().mockReturnValue({
  insert: mockInsert,
});

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    from: mockFrom,
  }),
}));

describe("Facebook Webhook Endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.META_WEBHOOK_VERIFY_TOKEN = "gur_fb_webhook_verify_2026";
  });

  describe("GET verification handshake", () => {
    it("returns hub.challenge when token matches", async () => {
      const url = "https://khatikhejurgur.shop/api/webhooks/facebook?hub.mode=subscribe&hub.challenge=1158201444&hub.verify_token=gur_fb_webhook_verify_2026";
      const req = new NextRequest(url);

      const res = await GET(req);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toBe("1158201444");
    });

    it("returns 403 when token does not match", async () => {
      const url = "https://khatikhejurgur.shop/api/webhooks/facebook?hub.mode=subscribe&hub.challenge=1158201444&hub.verify_token=wrong_token";
      const req = new NextRequest(url);

      const res = await GET(req);
      expect(res.status).toBe(403);
    });
  });

  describe("POST comment webhook event", () => {
    it("processes a new comment and creates an admin notification", async () => {
      const payload = {
        object: "page",
        entry: [
          {
            id: "10001234567890", // Page ID
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

      const req = new NextRequest("https://khatikhejurgur.shop/api/webhooks/facebook", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      expect(mockFrom).toHaveBeenCalledWith("notifications");
      expect(mockInsert).toHaveBeenCalledTimes(1);
      const inserted = mockInsert.mock.calls[0][0];

      expect(inserted.type).toBe("customer_inquiry");
      expect(inserted.title).toBe("💬 FB Comment from Tanvir Rahman");
      expect(inserted.message).toBe("Can I get 2kg Jhola Gur delivered to Chittagong?");
      expect(inserted.data.platform).toBe("facebook");
      expect(inserted.data.comment_id).toBe("10001234567890_99887766");
      expect(inserted.data.link).toBe("https://facebook.com/10001234567890_99887766");
    });

    it("ignores comments made by the page itself", async () => {
      const payload = {
        object: "page",
        entry: [
          {
            id: "10001234567890", // Page ID
            time: 1731600000,
            changes: [
              {
                field: "feed",
                value: {
                  item: "comment",
                  verb: "add",
                  comment_id: "reply_99",
                  from: {
                    id: "10001234567890", // Same as Page ID
                    name: "Khati Khejurgur",
                  },
                  message: "Yes sir, delivery takes 2-3 days!",
                },
              },
            ],
          },
        ],
      };

      const req = new NextRequest("https://khatikhejurgur.shop/api/webhooks/facebook", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      expect(mockInsert).not.toHaveBeenCalled();
    });
  });
});
