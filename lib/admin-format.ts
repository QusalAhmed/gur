import { toZonedTime, format as formatZoned } from "date-fns-tz";

export const DHAKA_TIMEZONE = "Asia/Dhaka";

const BN_DIGITS: Record<string, string> = {
  "0": "০",
  "1": "১",
  "2": "২",
  "3": "৩",
  "4": "৪",
  "5": "৫",
  "6": "৬",
  "7": "৭",
  "8": "৮",
  "9": "৯",
};

/**
 * Converts Western digits in a string or number to Bengali digits.
 */
export function toBengaliDigits(val: number | string): string {
  return String(val).replace(/[0-9]/g, (d) => BN_DIGITS[d] || d);
}

/**
 * Formats a monetary amount in Bangladeshi Taka (BDT)
 * Example: `formatBDT(12500) => "৳ 12,500"`
 * Option to include decimals or convert to Bengali numerals.
 */
export function formatBDT(
  amount: number | string | null | undefined,
  options: {
    decimals?: number;
    useBengaliDigits?: boolean;
    showSign?: boolean;
  } = {}
): string {
  const num = Number(amount) || 0;
  const decimals = options.decimals ?? 0;

  const formattedNum = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(num));

  let result = formattedNum;
  if (options.useBengaliDigits) {
    result = toBengaliDigits(formattedNum);
  }

  const sign = options.showSign && num > 0 ? "+" : num < 0 ? "-" : "";
  return `${sign}৳ ${result}`;
}

/**
 * Formats a date in Asia/Dhaka timezone.
 * Example: "24 Oct 2026"
 */
export function formatDhakaDate(
  date: string | number | Date | null | undefined,
  pattern = "dd MMM yyyy"
): string {
  if (!date) return "—";
  try {
    const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
    if (isNaN(d.getTime())) return "—";
    const zoned = toZonedTime(d, DHAKA_TIMEZONE);
    return formatZoned(zoned, pattern, { timeZone: DHAKA_TIMEZONE });
  } catch {
    return "—";
  }
}

/**
 * Formats a date & time in Asia/Dhaka timezone.
 * Example: "24 Oct 2026, 02:45 PM"
 */
export function formatDhakaDateTime(
  date: string | number | Date | null | undefined,
  pattern = "dd MMM yyyy, hh:mm a"
): string {
  return formatDhakaDate(date, pattern);
}

/**
 * Normalizes any Bangladeshi phone number to the standard E.164 format: `+8801XXXXXXXXX`
 * Handles 01XXXXXXXXX, 8801XXXXXXXXX, +8801XXXXXXXXX, and formats with spaces/dashes.
 */
export function normalizeBDPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  // Remove all non-digits except a leading +
  let cleaned = phone.trim().replace(/[^\d+]/g, "");

  if (cleaned.startsWith("+880")) {
    cleaned = cleaned.substring(1);
  } else if (cleaned.startsWith("0")) {
    cleaned = "88" + cleaned;
  } else if (cleaned.startsWith("1")) {
    cleaned = "880" + cleaned;
  }

  // Must match 8801[3-9]XXXXXXXX (13 digits total)
  if (/^8801[3-9]\d{8}$/.test(cleaned)) {
    return "+" + cleaned;
  }

  // Fallback: if already +880 followed by 10 digits
  if (/^\+8801\d{9}$/.test(phone.trim())) {
    return phone.trim();
  }

  return null;
}

/**
 * Formats standard BD mobile number for UI display: `01712-345678`
 */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return "—";
  const normalized = normalizeBDPhone(phone);
  if (!normalized) return phone;
  // E.164: +8801712345678 -> local: 01712-345678
  const local = "0" + normalized.slice(4);
  if (local.length === 11) {
    return `${local.slice(0, 5)}-${local.slice(5)}`;
  }
  return local;
}

/**
 * Formats quantity with Unit of Measure (UOM)
 */
export function formatUOM(
  quantity: number | string | null | undefined,
  uom: string = "kg",
  lang: "en" | "bn" = "en"
): string {
  const num = Number(quantity) || 0;
  const numStr = lang === "bn" ? toBengaliDigits(num) : num.toLocaleString();

  const UOM_LABELS: Record<string, { en: string; bn: string }> = {
    kg: { en: "kg", bn: "কেজি" },
    g: { en: "g", bn: "গ্রাম" },
    l: { en: "L", bn: "লিটার" },
    ml: { en: "ml", bn: "মিলি" },
    t: { en: "tons", bn: "টন" },
    pcs: { en: "pcs", bn: "টি" },
    jar: { en: "jars", bn: "জার" },
    bottle: { en: "bottles", bn: "বোতল" },
    drum: { en: "drums", bn: "ড্রাম" },
  };

  const key = uom.toLowerCase();
  const label = UOM_LABELS[key]?.[lang] || uom;
  return `${numStr} ${label}`;
}

/**
 * Formats percentage delta with sign
 * Example: `+14.2%` or `-5.1%`
 */
export function formatDelta(percent: number | null | undefined): string {
  if (percent === null || percent === undefined || isNaN(percent)) return "0%";
  const sign = percent > 0 ? "+" : "";
  return `${sign}${percent.toFixed(1)}%`;
}

export interface FormattedCustomerAddress {
  recipientName?: string;
  phone?: string;
  addressLine?: string;
  areaLine?: string;
  fullAddress: string;
  district?: string;
  division?: string;
  upazila?: string;
  postalCode?: string;
  landmark?: string;
  isHomeDelivery?: boolean;
}

/**
 * Robust address parser for Bangladeshi e-commerce addresses.
 * Gracefully parses and formats address_line, address, full_address, street, thana, upazila, district, city, division, postal_code, landmark, etc.
 */
export function formatCustomerAddress(raw: any): FormattedCustomerAddress | null {
  if (!raw) return null;

  let addr = raw;
  if (typeof addr === "string") {
    const trimmed = addr.trim();
    if (!trimmed || trimmed === "null" || trimmed === "{}" || trimmed === "undefined") return null;
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        addr = JSON.parse(trimmed);
      } catch {
        return { fullAddress: trimmed, addressLine: trimmed };
      }
    } else {
      return { fullAddress: trimmed, addressLine: trimmed };
    }
  }

  if (typeof addr !== "object" || addr === null) return null;

  const recipientName = (addr.recipient_name || addr.full_name || addr.name || "").trim();
  const phone = (addr.phone || addr.alternative_phone || addr.shipping_phone || "").trim();

  // Address line (street / house / road / village / market)
  const rawStreet = (
    addr.address_line ||
    addr.address ||
    addr.full_address ||
    addr.street ||
    addr.house_road ||
    ""
  ).trim();

  // Thana / Upazila
  const upazila = (addr.upazila || addr.thana || addr.police_station || "").trim();

  // District / City
  const district = (addr.district || addr.district_name || "").trim();
  const rawCity = (addr.city || "").trim();
  const city = rawCity && rawCity.toLowerCase() !== district.toLowerCase() ? rawCity : "";

  // Division
  const rawDivision = (addr.division || "").trim();
  const division =
    rawDivision &&
    rawDivision.toLowerCase() !== district.toLowerCase() &&
    rawDivision.toLowerCase() !== city.toLowerCase()
      ? rawDivision
      : "";

  // Postal code
  const postalCode = (addr.postal_code || addr.postcode || addr.zip || "").trim();

  // Landmark
  const landmark = (addr.landmark || "").trim();

  // Home delivery flag
  const isHomeDelivery =
    typeof addr.is_home_delivery === "boolean"
      ? addr.is_home_delivery
      : typeof addr.home_delivery === "boolean"
      ? addr.home_delivery
      : undefined;

  // Build area line: [upazila, city, district, division].filter(Boolean)
  const areaParts = [upazila, city, district, division].filter(Boolean);
  if (postalCode) {
    areaParts.push(postalCode.startsWith("Postal") ? postalCode : `Postal: ${postalCode}`);
  }
  const areaLine = areaParts.join(", ");

  // Full address
  const fullParts = [rawStreet, areaLine].filter(Boolean);
  const fullAddress = fullParts.join(", ").trim();

  // If there's no actual address information
  if (!fullAddress) {
    return null;
  }

  return {
    recipientName: recipientName || undefined,
    phone: phone || undefined,
    addressLine: rawStreet || undefined,
    areaLine: areaLine || undefined,
    fullAddress,
    district: district || undefined,
    division: division || rawDivision || undefined,
    upazila: upazila || undefined,
    postalCode: postalCode || undefined,
    landmark: landmark || undefined,
    isHomeDelivery,
  };
}
