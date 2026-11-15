import { Spoo } from "spoo.me";

let spooClient: Spoo | null = null;

function getSpooClient(): Spoo | null {
  const apiKey = (process.env.SPOO_API_KEY || "").trim();
  if (!apiKey) {
    return null;
  }
  if (!spooClient) {
    spooClient = new Spoo({ apiKey });
  }
  return spooClient;
}

/**
 * Shortens a URL using the official spoo.me SDK.
 * - Enforces a strict 10-second timeout.
 * - Gracefully falls back to the raw URL on any failure (timeout, network error, API key error).
 */
export async function shortenTrackingUrl(longUrl: string): Promise<string> {
  const cleanUrl = (longUrl || "").trim();
  if (!cleanUrl) return "";

  // Only shorten valid http/https URLs
  if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
    return cleanUrl;
  }

  const client = getSpooClient();
  if (!client) {
    return cleanUrl;
  }

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("spoo.me request timed out after 10000ms"));
      }, 10000);

      if (typeof timer.unref === "function") {
        timer.unref();
      }
    });

    const shortenPromise = client.links.create({
      long_url: cleanUrl,
    });

    const res = await Promise.race([shortenPromise, timeoutPromise]);
    if (res?.short_url && typeof res.short_url === "string" && res.short_url.startsWith("http")) {
      return res.short_url.trim();
    }

    return cleanUrl;
  } catch (error) {
    console.warn("[spoo.me] URL shortening failed, falling back to raw link:", error);
    return cleanUrl;
  }
}
