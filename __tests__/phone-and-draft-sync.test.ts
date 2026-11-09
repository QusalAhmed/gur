import { describe, it, expect } from "vitest";
import { parseBdPhone, isValidBdPhone } from "@/lib/phone";

describe("Phone Validation & Incomplete Order Sync Logic", () => {
  it("validates and normalizes valid Bangladeshi mobile numbers", () => {
    // 11-digit local format
    const res1 = parseBdPhone("01712345678");
    expect(res1.isValid).toBe(true);
    expect(res1.local).toBe("01712345678");
    expect(res1.normalized).toBe("+8801712345678");

    // 10-digit without leading 0
    const res2 = parseBdPhone("1812345678");
    expect(res2.isValid).toBe(true);
    expect(res2.local).toBe("01812345678");
    expect(res2.normalized).toBe("+8801812345678");

    // 13-digit with 88 prefix
    const res3 = parseBdPhone("8801912345678");
    expect(res3.isValid).toBe(true);
    expect(res3.local).toBe("01912345678");
    expect(res3.normalized).toBe("+8801912345678");

    // With spaces and dashes
    const res4 = parseBdPhone("+880 1312-345678");
    expect(res4.isValid).toBe(true);
    expect(res4.local).toBe("01312345678");
    expect(res4.normalized).toBe("+8801312345678");
  });

  it("rejects incomplete or invalid phone numbers to prevent premature auto-sync", () => {
    // Incomplete phone while typing
    expect(isValidBdPhone("017")).toBe(false);
    expect(isValidBdPhone("01712")).toBe(false);
    expect(isValidBdPhone("0171234567")).toBe(false); // 10 digits starting with 01

    // Invalid operators (010, 011, 012 are invalid in BD)
    expect(isValidBdPhone("01012345678")).toBe(false);
    expect(isValidBdPhone("01112345678")).toBe(false);
    expect(isValidBdPhone("01212345678")).toBe(false);

    // Empty and letters
    expect(isValidBdPhone("")).toBe(false);
    expect(isValidBdPhone("abcdefghijk")).toBe(false);
  });

  it("verifies hash-based form change detection ignores redundant spaces", () => {
    const computeHash = (data: {
      phone: string;
      name: string;
      address: string;
      note: string;
      zone: string;
      items: Array<{ pid: string; vid: string; q: number; pr: number }>;
    }) =>
      JSON.stringify({
        p: data.phone,
        n: data.name.trim(),
        a: data.address.trim(),
        no: data.note.trim(),
        z: data.zone,
        i: data.items,
      });

    const baseData = {
      phone: "+8801712345678",
      name: "Abdur Rahim",
      address: "Dhanmondi, Dhaka",
      note: "Urgent",
      zone: "inside_dhaka",
      items: [{ pid: "p1", vid: "v1", q: 1, pr: 500 }],
    };

    const hash1 = computeHash(baseData);
    // Same data with whitespace padding
    const hash2 = computeHash({
      ...baseData,
      name: "  Abdur Rahim  ",
      address: " Dhanmondi, Dhaka ",
      note: " Urgent ",
    });

    expect(hash1).toBe(hash2);

    // Data changed (different address)
    const hash3 = computeHash({
      ...baseData,
      address: "Gulshan, Dhaka",
    });

    expect(hash1).not.toBe(hash3);
  });
});
