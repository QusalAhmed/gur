/**
 * Bangladeshi mobile phone number regex and normalization utility.
 * Accepts all four standard formats:
 * 1. +8801XXXXXXXXX (International with plus prefix)
 * 2. 8801XXXXXXXXX  (International without plus prefix)
 * 3. 01XXXXXXXXX    (Standard local 11-digit format)
 * 4. 1XXXXXXXXX     (10-digit format omitting the leading zero)
 */
export const BD_PHONE_REGEX = /^(?:\+?880?|0)?1[3-9]\d{8}$/;

export interface ParsedBdPhone {
  isValid: boolean;
  local: string; // 11-digit format: "01XXXXXXXXX"
  normalized: string; // E.164 format: "+8801XXXXXXXXX"
  rawDigits: string;
}

/**
 * Parses and validates a Bangladeshi mobile number in any supported format:
 * +8801XXXXXXXXX, 8801XXXXXXXXX, 01XXXXXXXXX, 1XXXXXXXXX
 */
export function parseBdPhone(raw?: string | null): ParsedBdPhone {
  if (!raw) {
    return { isValid: false, local: "", normalized: "", rawDigits: "" };
  }

  const cleaned = String(raw).replace(/[\s\-\(\)]/g, "");
  const digits = cleaned.replace(/\D/g, "");

  let local = "";
  if (/^1[3-9]\d{8}$/.test(digits)) {
    local = "0" + digits;
  } else if (/^01[3-9]\d{8}$/.test(digits)) {
    local = digits;
  } else if (/^8801[3-9]\d{8}$/.test(digits)) {
    local = digits.slice(2);
  } else {
    return { isValid: false, local: "", normalized: "", rawDigits: digits };
  }

  return {
    isValid: true,
    local,
    normalized: "+88" + local,
    rawDigits: digits,
  };
}

/**
 * Checks whether a phone number is valid in any of the four formats.
 */
export function isValidBdPhone(raw?: string | null): boolean {
  return parseBdPhone(raw).isValid;
}

/**
 * Normalizes any valid Bangladeshi phone number to E.164 format (+8801XXXXXXXXX).
 * Returns empty string if invalid.
 */
export function normalizeBdPhone(phone?: string | null): string {
  const parsed = parseBdPhone(phone);
  return parsed.isValid ? parsed.normalized : "";
}

/**
 * Converts any valid Bangladeshi phone number to standard local 11-digit format (01XXXXXXXXX).
 * Returns empty string if invalid.
 */
export function toLocalBdPhone(phone?: string | null): string {
  const parsed = parseBdPhone(phone);
  return parsed.isValid ? parsed.local : "";
}

