import { parseBdPhone } from "@/lib/phone";
import type { DbGeoDistrict, DbGeoDivision } from "@/lib/supabase/types";

export interface CustomerSavedAddressOption {
  id: string;
  division: string;
  district: string;
  postalCode: string;
  addressLine: string;
  upazila?: string | null;
  recipientName?: string | null;
  shippingPhone?: string | null;
  isGiftRecipient: boolean;
  source: "order" | "customer_default" | "saved_address";
  sourceLabel: string;
  orderNumber?: string | null;
  orderStatus?: string | null;
  placedAt?: string | null;
}

export interface CustomerOrderStatsSummary {
  totalOrders: number;
  activeOrDeliveredCount: number;
  cancelledCount: number;
  returnedCount: number;
  incompleteCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
  lastOrderNumber: string | null;
  lastOrderStatus: string | null;
}

export interface CustomerLookupResult {
  id: string;
  name: string;
  phone: string;
  alternativePhone: string | null;
  email: string | null;
  businessId?: string | null;
  businessName?: string | null;
  address?: {
    division: string;
    district: string;
    districtId: number | null;
    upazila: string | null;
    addressLine: string;
    postalCode: string | null;
  } | null;
  addresses: CustomerSavedAddressOption[];
  stats: CustomerOrderStatsSummary;
}

export interface CustomerLookupRecordInput {
  id: string;
  user_id?: string | null;
  phone?: string | null;
  full_name?: string | null;
  email?: string | null;
  default_address?: Record<string, any> | null;
  total_orders?: number | null;
  total_spent?: number | null;
  last_order_at?: string | null;
}

export interface CustomerLookupProfileInput {
  id: string;
  full_name?: string | null;
  phone?: string | null;
  business_members?: any;
}

export interface CustomerLookupProfileAddressInput {
  id: string;
  label?: string | null;
  recipient_name?: string | null;
  phone?: string | null;
  address_line?: string | null;
  district_id?: number | null;
  upazila?: string | null;
  postal_code?: string | null;
  is_default?: boolean | null;
  district_name?: string | null;
  division_name?: string | null;
}

export interface CustomerLookupOrderInput {
  id: string;
  order_number?: string | null;
  status?: string | null;
  grand_total?: number | null;
  placed_at?: string | null;
  created_at?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_alternative_phone?: string | null;
  shipping_phone?: string | null;
  customer_email?: string | null;
  shipping_address?: Record<string, any> | null;
}

const PLACEHOLDER_NAMES = new Set([
  "customer",
  "anonymous",
  "anonymous customer",
  "unknown",
  "guest",
  "n/a",
]);

const DIVISION_ALIASES: Record<string, string> = {
  chittagong: "chattogram",
  barisal: "barishal",
};

const DISTRICT_ALIASES: Record<string, string> = {
  chittagong: "chattogram",
  barisal: "barishal",
  comilla: "cumilla",
  jessore: "jashore",
  bogra: "bogura",
  "coxs bazar": "cox's bazar",
  "cox bazar": "cox's bazar",
  chapainawabganj: "chapai nawabganj",
};

const EMAIL_SIMPLE_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function cleanCustomerName(raw?: string | null): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "";
  if (PLACEHOLDER_NAMES.has(trimmed.toLowerCase())) return "";
  return trimmed;
}

export function cleanCustomerEmail(raw?: string | null): string {
  const trimmed = (raw || "").trim();
  if (!trimmed || trimmed.length > 254) return "";
  return EMAIL_SIMPLE_REGEX.test(trimmed) ? trimmed : "";
}

/**
 * Returns all Bangladeshi mobile phone format variants for exact indexed DB lookups.
 * Returns null if the phone is not a complete valid BD mobile number.
 */
export function getBdPhoneQueryVariants(rawPhone?: string | null): {
  normalized: string;
  local: string;
  variants: string[];
} | null {
  const parsed = parseBdPhone(rawPhone);
  if (!parsed.isValid) return null;

  const variants = Array.from(
    new Set([
      parsed.normalized, // +8801XXXXXXXXX
      parsed.local, // 01XXXXXXXXX
      parsed.normalized.slice(1), // 8801XXXXXXXXX
      parsed.local.slice(1), // 1XXXXXXXXX
    ])
  );

  return {
    normalized: parsed.normalized,
    local: parsed.local,
    variants,
  };
}

/**
 * Resolves raw division & district names (including legacy English spellings)
 * against canonical geoDivisions & geoDistricts lists.
 */
export function resolveGeoLocationForOrderForm(
  rawDivision: string | null | undefined,
  rawDistrict: string | null | undefined,
  geoDivisions: DbGeoDivision[],
  geoDistricts: DbGeoDistrict[]
): { division: string; district: string } {
  const trimmedDiv = (rawDivision || "").trim();
  const trimmedDist = (rawDistrict || "").trim();

  const normalizedDistKey = DISTRICT_ALIASES[trimmedDist.toLowerCase()] || trimmedDist.toLowerCase();
  const normalizedDivKey = DIVISION_ALIASES[trimmedDiv.toLowerCase()] || trimmedDiv.toLowerCase();

  const matchedDistrict = normalizedDistKey
    ? geoDistricts.find(
        (d) =>
          d.name.toLowerCase() === normalizedDistKey ||
          (d.name_bn && d.name_bn.trim().toLowerCase() === normalizedDistKey)
      )
    : undefined;

  let matchedDivision = normalizedDivKey
    ? geoDivisions.find(
        (d) =>
          d.name.toLowerCase() === normalizedDivKey ||
          (d.name_bn && d.name_bn.trim().toLowerCase() === normalizedDivKey)
      )
    : undefined;

  if (matchedDistrict) {
    const parentDivision = geoDivisions.find((d) => d.id === matchedDistrict.division_id);
    if (parentDivision && (!matchedDivision || matchedDivision.id !== parentDivision.id)) {
      matchedDivision = parentDivision;
    }
  }

  return {
    division: matchedDivision?.name || trimmedDiv,
    district: matchedDistrict?.name || trimmedDist,
  };
}

function getOrderStatusTier(status?: string | null): number {
  const s = (status || "").toLowerCase().trim();
  if (!s) return 0;
  if (s === "incomplete_order") return 3;
  if (s === "cancelled") return 2;
  if (s === "returned") return 1;
  return 0;
}

function getOrderTimestampMs(order: CustomerLookupOrderInput): number {
  const raw = order.placed_at || order.created_at;
  if (!raw) return 0;
  const ms = new Date(raw).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function formatShortOrderDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Dhaka",
  });
}

function parseRawAddressFields(
  rawAddr: Record<string, any> | null | undefined,
  geoDivisions: DbGeoDivision[],
  geoDistricts: DbGeoDistrict[]
): {
  division: string;
  district: string;
  postalCode: string;
  addressLine: string;
  upazila: string;
  recipientName: string;
  phone: string;
  alternativePhone: string;
} | null {
  if (!rawAddr || typeof rawAddr !== "object" || Array.isArray(rawAddr)) {
    return null;
  }

  const upazila = String(rawAddr.upazila || rawAddr.thana || rawAddr.police_station || "").trim();
  let addressLine = String(
    rawAddr.address_line ||
      rawAddr.address ||
      rawAddr.full_address ||
      rawAddr.street ||
      rawAddr.house_road ||
      ""
  ).trim();
  if (!addressLine && upazila) {
    addressLine = upazila;
  }

  const rawDivision = String(rawAddr.division || "").trim();
  const rawDistrict = String(rawAddr.district || rawAddr.district_name || "").trim();
  const postalCode = String(rawAddr.postal_code || rawAddr.postcode || rawAddr.zip || "").trim();
  const recipientName = cleanCustomerName(
    rawAddr.recipient_name || rawAddr.full_name || rawAddr.name || ""
  );
  const phone = String(rawAddr.phone || rawAddr.shipping_phone || "").trim();
  const alternativePhone = String(rawAddr.alternative_phone || "").trim();

  const resolvedGeo = resolveGeoLocationForOrderForm(
    rawDivision,
    rawDistrict,
    geoDivisions,
    geoDistricts
  );

  if (!addressLine && !resolvedGeo.district && !resolvedGeo.division && !postalCode) {
    return null;
  }

  return {
    division: resolvedGeo.division,
    district: resolvedGeo.district,
    postalCode,
    addressLine,
    upazila,
    recipientName,
    phone,
    alternativePhone,
  };
}

function detectIsGiftRecipient(params: {
  primaryNormalizedPhone: string;
  shippingPhone?: string | null;
  recipientName?: string | null;
  buyerName?: string | null;
}): boolean {
  const shipParsed = parseBdPhone(params.shippingPhone);
  if (shipParsed.isValid && shipParsed.normalized !== params.primaryNormalizedPhone) {
    return true;
  }

  const cleanRecipient = cleanCustomerName(params.recipientName).toLowerCase();
  const cleanBuyer = cleanCustomerName(params.buyerName).toLowerCase();
  if (cleanRecipient && cleanBuyer && cleanRecipient !== cleanBuyer) {
    return true;
  }

  return false;
}

function normalizeWhitespace(val: string): string {
  return val.trim().replace(/\s+/g, " ").toLowerCase();
}

function buildAddressDedupKey(addr: CustomerSavedAddressOption): string {
  const lineKey = normalizeWhitespace(addr.addressLine);
  const distKey = normalizeWhitespace(addr.district);
  const divKey = normalizeWhitespace(addr.division);
  const recipientKey = addr.isGiftRecipient
    ? normalizeWhitespace(addr.recipientName || addr.shippingPhone || "gift")
    : "";

  if (lineKey) {
    return `${lineKey}|${distKey || divKey}|${addr.isGiftRecipient ? `gift:${recipientKey}` : "primary"}`;
  }
  return `geo:${divKey}|${distKey}|${normalizeWhitespace(addr.postalCode)}|${
    addr.isGiftRecipient ? `gift:${recipientKey}` : "primary"
  }`;
}

/**
 * Pure resolver merging orders, customers, profiles, and saved addresses into
 * a unified CustomerLookupResult for admin panel phone autofill.
 */
export function buildCustomerLookupResult(params: {
  phone: string;
  customer?: CustomerLookupRecordInput | null;
  profile?: CustomerLookupProfileInput | null;
  profileAddresses?: CustomerLookupProfileAddressInput[];
  orders?: CustomerLookupOrderInput[];
  geoDivisions?: DbGeoDivision[];
  geoDistricts?: DbGeoDistrict[];
}): CustomerLookupResult | null {
  const phoneVariants = getBdPhoneQueryVariants(params.phone);
  if (!phoneVariants) return null;

  const primaryNormalized = phoneVariants.normalized;
  const geoDivisions = params.geoDivisions || [];
  const geoDistricts = params.geoDistricts || [];
  const customer = params.customer || null;
  const profile = params.profile || null;
  const profileAddresses = params.profileAddresses || [];
  const rawOrders = params.orders || [];

  // 1. Sort orders chronologically (latest first) for stats & last-order metadata
  const chronologicalOrders = [...rawOrders].sort(
    (a, b) => getOrderTimestampMs(b) - getOrderTimestampMs(a)
  );

  // 2. Sort orders by status tier (active/delivered first), then newest first
  const prioritizedOrders = [...rawOrders].sort((a, b) => {
    const tierDiff = getOrderStatusTier(a.status) - getOrderStatusTier(b.status);
    if (tierDiff !== 0) return tierDiff;
    return getOrderTimestampMs(b) - getOrderTimestampMs(a);
  });

  // 3. Order stats summary
  let activeOrDeliveredCount = 0;
  let cancelledCount = 0;
  let returnedCount = 0;
  let incompleteCount = 0;
  let totalSpent = 0;

  for (const ord of chronologicalOrders) {
    const status = (ord.status || "").toLowerCase().trim();
    if (status === "cancelled") {
      cancelledCount += 1;
    } else if (status === "incomplete_order") {
      incompleteCount += 1;
    } else if (status === "returned") {
      returnedCount += 1;
      activeOrDeliveredCount += 1;
      totalSpent += Number(ord.grand_total) || 0;
    } else {
      activeOrDeliveredCount += 1;
      totalSpent += Number(ord.grand_total) || 0;
    }
  }

  const latestOrder = chronologicalOrders[0] || null;
  const useCustomerFallbackStats =
    chronologicalOrders.length === 0 && Number(customer?.total_orders || 0) > 0;

  const stats: CustomerOrderStatsSummary = {
    totalOrders: useCustomerFallbackStats
      ? Number(customer?.total_orders || 0)
      : activeOrDeliveredCount,
    activeOrDeliveredCount,
    cancelledCount,
    returnedCount,
    incompleteCount,
    totalSpent: useCustomerFallbackStats ? Number(customer?.total_spent || 0) : totalSpent,
    lastOrderAt:
      latestOrder?.placed_at || latestOrder?.created_at || customer?.last_order_at || null,
    lastOrderNumber: latestOrder?.order_number || null,
    lastOrderStatus: latestOrder?.status || null,
  };

  // 4. Resolve primary customer name (prefer Tier 0 order -> customers -> profiles -> lower tier orders)
  let resolvedName = "";
  for (const ord of prioritizedOrders) {
    if (getOrderStatusTier(ord.status) > 0) break;
    const candidate = cleanCustomerName(ord.customer_name);
    if (candidate) {
      resolvedName = candidate;
      break;
    }
  }
  if (!resolvedName) {
    resolvedName = cleanCustomerName(customer?.full_name) || cleanCustomerName(profile?.full_name);
  }
  if (!resolvedName) {
    for (const ord of prioritizedOrders) {
      const candidate = cleanCustomerName(ord.customer_name);
      if (candidate) {
        resolvedName = candidate;
        break;
      }
    }
  }

  // 5. Resolve alternative phone (never identical to primary phone)
  const pickValidAltPhone = (raw?: string | null): string | null => {
    const parsed = parseBdPhone(raw);
    if (!parsed.isValid || parsed.normalized === primaryNormalized) return null;
    return parsed.normalized;
  };

  let resolvedAltPhone: string | null = null;
  for (const ord of prioritizedOrders) {
    if (getOrderStatusTier(ord.status) > 0) break;
    resolvedAltPhone =
      pickValidAltPhone(ord.customer_alternative_phone) ||
      pickValidAltPhone(ord.shipping_address?.alternative_phone);
    if (resolvedAltPhone) break;
  }
  if (!resolvedAltPhone && customer?.default_address) {
    resolvedAltPhone = pickValidAltPhone(customer.default_address.alternative_phone);
  }
  if (!resolvedAltPhone) {
    for (const ord of prioritizedOrders) {
      resolvedAltPhone =
        pickValidAltPhone(ord.customer_alternative_phone) ||
        pickValidAltPhone(ord.shipping_address?.alternative_phone);
      if (resolvedAltPhone) break;
    }
  }

  // 6. Resolve email
  let resolvedEmail = "";
  for (const ord of prioritizedOrders) {
    if (getOrderStatusTier(ord.status) > 0) break;
    const candidate = cleanCustomerEmail(ord.customer_email);
    if (candidate) {
      resolvedEmail = candidate;
      break;
    }
  }
  if (!resolvedEmail) {
    resolvedEmail = cleanCustomerEmail(customer?.email);
  }
  if (!resolvedEmail) {
    for (const ord of prioritizedOrders) {
      const candidate = cleanCustomerEmail(ord.customer_email);
      if (candidate) {
        resolvedEmail = candidate;
        break;
      }
    }
  }

  // 7. Extract business account details if linked
  const bizMembers = Array.isArray(profile?.business_members)
    ? profile?.business_members[0]
    : profile?.business_members;
  const bizAccount = Array.isArray(bizMembers?.business_accounts)
    ? bizMembers?.business_accounts[0]
    : bizMembers?.business_accounts;
  const businessId = bizAccount?.id || null;
  const businessName = bizAccount?.name || bizAccount?.company_name || null;

  // 8. Build prioritized, deduplicated address options
  type RankedAddress = {
    priority: number;
    timestamp: number;
    option: CustomerSavedAddressOption;
  };
  const rankedCandidates: RankedAddress[] = [];

  for (const ord of prioritizedOrders) {
    const parsedAddr = parseRawAddressFields(ord.shipping_address, geoDivisions, geoDistricts);
    if (!parsedAddr) continue;

    const orderBuyerName = cleanCustomerName(ord.customer_name) || resolvedName;
    const effectiveShipPhone = ord.shipping_phone || parsedAddr.phone || "";
    const isGift = detectIsGiftRecipient({
      primaryNormalizedPhone: primaryNormalized,
      shippingPhone: effectiveShipPhone,
      recipientName: parsedAddr.recipientName,
      buyerName: orderBuyerName,
    });

    const tier = getOrderStatusTier(ord.status);
    const priority = isGift ? 10 + tier : tier === 0 ? 0 : 4 + tier;
    const dateLabel = formatShortOrderDate(ord.placed_at || ord.created_at);
    const orderTag = ord.order_number ? `#${ord.order_number}` : "Previous Order";
    const statusSuffix =
      ord.status === "cancelled"
        ? " · Cancelled"
        : ord.status === "returned"
        ? " · Returned"
        : ord.status === "incomplete_order"
        ? " · Incomplete"
        : "";
    const giftPrefix = isGift
      ? `Gift / ${parsedAddr.recipientName || effectiveShipPhone || "Other Recipient"} · `
      : "";

    rankedCandidates.push({
      priority,
      timestamp: getOrderTimestampMs(ord),
      option: {
        id: `order:${ord.id}`,
        division: parsedAddr.division,
        district: parsedAddr.district,
        postalCode: parsedAddr.postalCode,
        addressLine: parsedAddr.addressLine,
        upazila: parsedAddr.upazila || null,
        recipientName: parsedAddr.recipientName || null,
        shippingPhone: effectiveShipPhone || null,
        isGiftRecipient: isGift,
        source: "order",
        sourceLabel: `${giftPrefix}Order ${orderTag}${dateLabel ? ` (${dateLabel})` : ""}${statusSuffix}`,
        orderNumber: ord.order_number || null,
        orderStatus: ord.status || null,
        placedAt: ord.placed_at || ord.created_at || null,
      },
    });
  }

  if (customer?.default_address) {
    const parsedDefault = parseRawAddressFields(
      customer.default_address,
      geoDivisions,
      geoDistricts
    );
    if (parsedDefault) {
      const isGift = detectIsGiftRecipient({
        primaryNormalizedPhone: primaryNormalized,
        shippingPhone: parsedDefault.phone,
        recipientName: parsedDefault.recipientName,
        buyerName: resolvedName || cleanCustomerName(customer.full_name),
      });
      rankedCandidates.push({
        priority: isGift ? 15 : 1,
        timestamp: 0,
        option: {
          id: `customer:${customer.id}`,
          division: parsedDefault.division,
          district: parsedDefault.district,
          postalCode: parsedDefault.postalCode,
          addressLine: parsedDefault.addressLine,
          upazila: parsedDefault.upazila || null,
          recipientName: parsedDefault.recipientName || null,
          shippingPhone: parsedDefault.phone || null,
          isGiftRecipient: isGift,
          source: "customer_default",
          sourceLabel: isGift
            ? `Gift / ${parsedDefault.recipientName || "Saved Default"}`
            : "Customer Default Address",
        },
      });
    }
  }

  for (const pAddr of profileAddresses) {
    const matchedDistrictFromId = pAddr.district_id
      ? geoDistricts.find((d) => d.id === pAddr.district_id)
      : undefined;
    const parsedProf = parseRawAddressFields(
      {
        division: pAddr.division_name || "",
        district: pAddr.district_name || matchedDistrictFromId?.name || "",
        postal_code: pAddr.postal_code || "",
        address_line: pAddr.address_line || "",
        upazila: pAddr.upazila || "",
        recipient_name: pAddr.recipient_name || "",
        phone: pAddr.phone || "",
      },
      geoDivisions,
      geoDistricts
    );
    if (!parsedProf) continue;

    const isGift = detectIsGiftRecipient({
      primaryNormalizedPhone: primaryNormalized,
      shippingPhone: parsedProf.phone,
      recipientName: parsedProf.recipientName,
      buyerName: resolvedName || cleanCustomerName(profile?.full_name),
    });
    const basePrio = pAddr.is_default ? 2 : 3;
    const labelText = pAddr.label?.trim()
      ? `${pAddr.label.trim()} Address`
      : pAddr.is_default
      ? "Account Default Address"
      : "Account Saved Address";

    rankedCandidates.push({
      priority: isGift ? 16 : basePrio,
      timestamp: 0,
      option: {
        id: `address:${pAddr.id}`,
        division: parsedProf.division,
        district: parsedProf.district,
        postalCode: parsedProf.postalCode,
        addressLine: parsedProf.addressLine,
        upazila: parsedProf.upazila || null,
        recipientName: parsedProf.recipientName || null,
        shippingPhone: parsedProf.phone || null,
        isGiftRecipient: isGift,
        source: "saved_address",
        sourceLabel: isGift
          ? `Gift / ${parsedProf.recipientName || labelText}`
          : labelText,
      },
    });
  }

  rankedCandidates.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return b.timestamp - a.timestamp;
  });

  const deduplicatedAddresses: CustomerSavedAddressOption[] = [];
  const keyToIdx = new Map<string, number>();

  for (const item of rankedCandidates) {
    const key = buildAddressDedupKey(item.option);
    const existingIdx = keyToIdx.get(key);
    if (existingIdx === undefined) {
      keyToIdx.set(key, deduplicatedAddresses.length);
      deduplicatedAddresses.push(item.option);
    } else {
      // Enrich winning entry with missing division / district / postalCode from duplicate
      const existing = deduplicatedAddresses[existingIdx];
      if (!existing.division && item.option.division) {
        existing.division = item.option.division;
      }
      if (!existing.district && item.option.district) {
        existing.district = item.option.district;
      }
      if (!existing.postalCode && item.option.postalCode) {
        existing.postalCode = item.option.postalCode;
      }
      if (!existing.upazila && item.option.upazila) {
        existing.upazila = item.option.upazila;
      }
    }
  }

  const hasAnyFillableData = Boolean(
    resolvedName ||
      resolvedEmail ||
      resolvedAltPhone ||
      deduplicatedAddresses.length > 0
  );

  if (!hasAnyFillableData) {
    return null;
  }

  const primaryAddr = deduplicatedAddresses[0] || null;
  const primaryMatchedDistrict = primaryAddr?.district
    ? geoDistricts.find((d) => d.name.toLowerCase() === primaryAddr.district.toLowerCase())
    : undefined;

  return {
    id: customer?.id || profile?.id || latestOrder?.id || primaryNormalized,
    name: resolvedName,
    phone: primaryNormalized,
    alternativePhone: resolvedAltPhone,
    email: resolvedEmail || null,
    businessId,
    businessName,
    address: primaryAddr
      ? {
          division: primaryAddr.division,
          district: primaryAddr.district,
          districtId: primaryMatchedDistrict?.id ?? null,
          upazila: primaryAddr.upazila || null,
          addressLine: primaryAddr.addressLine,
          postalCode: primaryAddr.postalCode || null,
        }
      : null,
    addresses: deduplicatedAddresses,
    stats,
  };
}
