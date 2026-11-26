/**
 * __tests__/imo.test.ts
 * Tests for lib/imo.ts — IMO URL normalization, sanitization, and storefront resolution.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DEFAULT_IMO_URL,
  normalizeImoUrl,
  sanitizeImoUrl,
  resolveStorefrontImoUrl,
} from "@/lib/imo";

describe("normalizeImoUrl", () => {
  it("returns valid:true with empty string for null input", () => {
    expect(normalizeImoUrl(null)).toEqual({ normalized: "", isValid: true });
    expect(normalizeImoUrl(undefined)).toEqual({ normalized: "", isValid: true });
  });

  it("returns valid:true with empty string for blank input", () => {
    expect(normalizeImoUrl("")).toEqual({ normalized: "", isValid: true });
    expect(normalizeImoUrl("   ")).toEqual({ normalized: "", isValid: true });
  });

  it("accepts full https s.imoim.net URL", () => {
    const result = normalizeImoUrl("https://s.imoim.net/H1lfS1");
    expect(result.isValid).toBe(true);
    expect(result.normalized).toBe("https://s.imoim.net/H1lfS1");
  });

  it("normalizes bare s.imoim.net/... to https", () => {
    const result = normalizeImoUrl("s.imoim.net/H1lfS1");
    expect(result.isValid).toBe(true);
    expect(result.normalized).toBe("https://s.imoim.net/H1lfS1");
  });

  it("upgrades http on known IMO domains to https", () => {
    const result = normalizeImoUrl("http://s.imoim.net/H1lfS1");
    expect(result.isValid).toBe(true);
    expect(result.normalized).toBe("https://s.imoim.net/H1lfS1");
  });

  it("strips JSON quotes from stored value", () => {
    const result = normalizeImoUrl('"https://s.imoim.net/H1lfS1"');
    expect(result.isValid).toBe(true);
    expect(result.normalized).toBe("https://s.imoim.net/H1lfS1");
  });

  it("rejects javascript: scheme", () => {
    expect(normalizeImoUrl("javascript:alert(1)")).toEqual({
      normalized: "",
      isValid: false,
    });
  });

  it("rejects data: scheme", () => {
    expect(normalizeImoUrl("data:text/html,<h1>XSS</h1>")).toEqual({
      normalized: "",
      isValid: false,
    });
  });

  it("rejects //relative URLs", () => {
    expect(normalizeImoUrl("//s.imoim.net/H1lfS1")).toEqual({
      normalized: "",
      isValid: false,
    });
  });

  it("rejects credential URLs", () => {
    expect(normalizeImoUrl("https://user:pass@s.imoim.net/H1lfS1")).toEqual({
      normalized: "",
      isValid: false,
    });
  });

  it("rejects URLs with whitespace", () => {
    expect(normalizeImoUrl("https://s.imoim.net/ H1lfS1")).toEqual({
      normalized: "",
      isValid: false,
    });
  });

  it("accepts any generic https URL (non-IMO domain)", () => {
    // IMO normalizer is permissive for https:// links in general
    const result = normalizeImoUrl("https://example.com/invite/abc");
    expect(result.isValid).toBe(true);
    expect(result.normalized).toBe("https://example.com/invite/abc");
  });
});

describe("sanitizeImoUrl", () => {
  it("returns normalized URL for valid input", () => {
    expect(sanitizeImoUrl("https://s.imoim.net/H1lfS1")).toBe(
      "https://s.imoim.net/H1lfS1"
    );
  });

  it("returns empty string for invalid input", () => {
    expect(sanitizeImoUrl("javascript:evil()")).toBe("");
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeImoUrl("")).toBe("");
    expect(sanitizeImoUrl(null)).toBe("");
  });
});

describe("resolveStorefrontImoUrl", () => {
  beforeEach(() => {
    delete (process.env as any).NEXT_PUBLIC_IMO_URL;
  });

  it("returns DEFAULT_IMO_URL when configuredUrl is undefined", () => {
    expect(resolveStorefrontImoUrl(undefined)).toBe(DEFAULT_IMO_URL);
  });

  it("returns DEFAULT_IMO_URL when configuredUrl is null", () => {
    expect(resolveStorefrontImoUrl(null)).toBe(DEFAULT_IMO_URL);
  });

  it("returns empty string when configuredUrl is explicitly empty (hide button)", () => {
    expect(resolveStorefrontImoUrl("")).toBe("");
  });

  it("returns sanitized URL when configuredUrl is a valid URL", () => {
    expect(resolveStorefrontImoUrl("https://s.imoim.net/CUSTOM")).toBe(
      "https://s.imoim.net/CUSTOM"
    );
  });

  it("returns empty string when configuredUrl is an invalid URL", () => {
    expect(resolveStorefrontImoUrl("javascript:alert(1)")).toBe("");
  });

  it("falls back to NEXT_PUBLIC_IMO_URL env var when configuredUrl is undefined", () => {
    process.env.NEXT_PUBLIC_IMO_URL = "https://s.imoim.net/ENV_URL";
    expect(resolveStorefrontImoUrl(undefined)).toBe(
      "https://s.imoim.net/ENV_URL"
    );
  });

  it("uses DEFAULT_IMO_URL as final fallback when env var is unset", () => {
    delete (process.env as any).NEXT_PUBLIC_IMO_URL;
    expect(resolveStorefrontImoUrl(undefined)).toBe(DEFAULT_IMO_URL);
    expect(DEFAULT_IMO_URL).toBe("https://s.imoim.net/H1lfS1");
  });
});
