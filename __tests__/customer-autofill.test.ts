import { describe, it, expect } from "vitest";
import {
  buildCustomerLookupResult,
  getBdPhoneQueryVariants,
  resolveGeoLocationForOrderForm,
} from "@/lib/customer-autofill";
import { fallbackDistricts, fallbackDivisions } from "@/lib/supabase/api";

describe("Customer Phone Autofill Helpers", () => {
  it("generates exact Bangladeshi phone variants for valid inputs and rejects partial numbers", () => {
    const res1 = getBdPhoneQueryVariants("01712-345678");
    expect(res1).not.toBeNull();
    expect(res1?.normalized).toBe("+8801712345678");
    expect(res1?.local).toBe("01712345678");
    expect(res1?.variants).toEqual([
      "+8801712345678",
      "01712345678",
      "8801712345678",
      "1712345678",
    ]);

    const res2 = getBdPhoneQueryVariants("1812345678");
    expect(res2?.normalized).toBe("+8801812345678");

    expect(getBdPhoneQueryVariants("01712")).toBeNull();
    expect(getBdPhoneQueryVariants("01012345678")).toBeNull();
    expect(getBdPhoneQueryVariants("")).toBeNull();
  });

  it("resolves division & district names including legacy spellings and missing divisions", () => {
    // Legacy spellings + missing division
    const loc1 = resolveGeoLocationForOrderForm(
      "",
      "Comilla",
      fallbackDivisions,
      fallbackDistricts
    );
    expect(loc1).toEqual({ division: "Chattogram", district: "Cumilla" });

    // Lowercase and Chittagong alias
    const loc2 = resolveGeoLocationForOrderForm(
      "chittagong",
      "cox's bazar",
      fallbackDivisions,
      fallbackDistricts
    );
    expect(loc2).toEqual({ division: "Chattogram", district: "Cox's Bazar" });

    // Infers division from district even when division mismatches
    const loc3 = resolveGeoLocationForOrderForm(
      "Dhaka",
      "Jashore",
      fallbackDivisions,
      fallbackDistricts
    );
    expect(loc3).toEqual({ division: "Khulna", district: "Jashore" });

    // Preserves custom district names gracefully
    const loc4 = resolveGeoLocationForOrderForm(
      "Dhaka",
      "Savar Municipality",
      fallbackDivisions,
      fallbackDistricts
    );
    expect(loc4).toEqual({ division: "Dhaka", district: "Savar Municipality" });
  });

  it("prefers active/delivered orders over cancelled/incomplete ones and merges customer & profile fallbacks", () => {
    const result = buildCustomerLookupResult({
      phone: "01712345678",
      customer: {
        id: "cust-1",
        full_name: "Customer", // placeholder must be ignored
        email: "rahim@example.com",
        default_address: {
          division: "Dhaka",
          district: "Dhaka",
          postal_code: "1205",
          address_line: "House 10, Dhanmondi",
        },
      },
      profile: {
        id: "prof-1",
        full_name: "Rahim Profile",
        phone: "+8801712345678",
        business_members: [
          {
            business_id: "biz-1",
            business_accounts: { id: "biz-1", name: "Modern Bakery Ltd", status: "approved" },
          },
        ],
      },
      profileAddresses: [
        {
          id: "addr-1",
          label: "Depot",
          recipient_name: "Rahim Ahmed",
          phone: "+8801712345678",
          address_line: "Plot 22, Tejgaon Industrial Area",
          district_id: 30, // Dhaka
          postal_code: "1208",
          is_default: true,
        },
      ],
      orders: [
        // Newer incomplete draft with incomplete details
        {
          id: "ord-inc",
          order_number: "MOL-2611-01100",
          status: "incomplete_order",
          grand_total: 650,
          placed_at: "2026-11-24T10:00:00Z",
          customer_name: "Rahim Draft",
          customer_phone: "+8801712345678",
          shipping_address: {
            district: "Gazipur",
            address_line: "Draft incomplete street",
          },
        },
        // Newer cancelled order
        {
          id: "ord-can",
          order_number: "MOL-2611-01090",
          status: "cancelled",
          grand_total: 900,
          placed_at: "2026-11-22T10:00:00Z",
          customer_name: "Rahim Cancelled",
          customer_phone: "+8801712345678",
          shipping_address: {
            division: "Dhaka",
            district: "Dhaka",
            postal_code: "1212",
            address_line: "Cancelled Address Gulshan",
          },
        },
        // Delivered order (should win over newer cancelled/incomplete!)
        {
          id: "ord-deliv",
          order_number: "MOL-2611-01050",
          status: "delivered",
          grand_total: 1450,
          placed_at: "2026-11-20T10:00:00Z",
          customer_name: "Rahim Ahmed",
          customer_phone: "+8801712345678",
          customer_alternative_phone: "01811112222",
          shipping_phone: "+8801712345678",
          shipping_address: {
            division: "Dhaka",
            district: "Dhaka",
            postal_code: "1207",
            address_line: "Road 5, Mohammadpur",
            recipient_name: "Rahim Ahmed",
            phone: "+8801712345678",
          },
        },
      ],
      geoDivisions: fallbackDivisions,
      geoDistricts: fallbackDistricts,
    });

    expect(result).not.toBeNull();
    expect(result?.name).toBe("Rahim Ahmed");
    expect(result?.phone).toBe("+8801712345678");
    expect(result?.alternativePhone).toBe("+8801811112222");
    expect(result?.email).toBe("rahim@example.com");
    expect(result?.businessId).toBe("biz-1");
    expect(result?.businessName).toBe("Modern Bakery Ltd");

    // Primary address should be the delivered order's address
    expect(result?.addresses[0]).toMatchObject({
      division: "Dhaka",
      district: "Dhaka",
      postalCode: "1207",
      addressLine: "Road 5, Mohammadpur",
      isGiftRecipient: false,
      source: "order",
    });

    // Order stats summary
    expect(result?.stats).toEqual({
      totalOrders: 1,
      activeOrDeliveredCount: 1,
      cancelledCount: 1,
      returnedCount: 0,
      incompleteCount: 1,
      totalSpent: 1450,
      lastOrderAt: "2026-11-24T10:00:00Z",
      lastOrderNumber: "MOL-2611-01100",
      lastOrderStatus: "incomplete_order",
    });

    // All distinct addresses preserved in priority order
    expect(result?.addresses.map((a) => a.addressLine)).toEqual([
      "Road 5, Mohammadpur",
      "House 10, Dhanmondi",
      "Plot 22, Tejgaon Industrial Area",
      "Cancelled Address Gulshan",
      "Draft incomplete street",
    ]);
  });

  it("ignores alternative phone when it equals primary phone and labels gift recipient addresses after primary addresses", () => {
    const result = buildCustomerLookupResult({
      phone: "01712345678",
      orders: [
        // Latest order was a gift to someone else
        {
          id: "ord-gift",
          order_number: "MOL-2611-01200",
          status: "delivered",
          grand_total: 800,
          placed_at: "2026-11-24T12:00:00Z",
          customer_name: "Karim Mia",
          customer_phone: "+8801712345678",
          customer_alternative_phone: "+8801712345678", // identical -> should be ignored
          shipping_phone: "+8801999887766",
          shipping_address: {
            division: "Chattogram",
            district: "Cumilla",
            postal_code: "3500",
            address_line: "Kandirpar Gift House",
            recipient_name: "Salma Begum",
            phone: "+8801999887766",
          },
        },
        // Earlier order was for the customer himself
        {
          id: "ord-self",
          order_number: "MOL-2611-01150",
          status: "delivered",
          grand_total: 1200,
          placed_at: "2026-11-18T12:00:00Z",
          customer_name: "Karim Mia",
          customer_phone: "+8801712345678",
          shipping_phone: "+8801712345678",
          shipping_address: {
            division: "",
            district: "Dhaka",
            postal_code: "1205",
            address_line: "Own Home Mirpur 10",
            recipient_name: "Karim Mia",
            phone: "+8801712345678",
          },
        },
      ],
      geoDivisions: fallbackDivisions,
      geoDistricts: fallbackDistricts,
    });

    expect(result).not.toBeNull();
    expect(result?.alternativePhone).toBeNull();
    // Primary own address comes before gift address
    expect(result?.addresses[0]).toMatchObject({
      addressLine: "Own Home Mirpur 10",
      division: "Dhaka",
      district: "Dhaka",
      isGiftRecipient: false,
    });
    expect(result?.addresses[1]).toMatchObject({
      addressLine: "Kandirpar Gift House",
      division: "Chattogram",
      district: "Cumilla",
      isGiftRecipient: true,
      recipientName: "Salma Begum",
    });
    expect(result?.addresses[1].sourceLabel).toContain("Gift / Salma Begum");
  });

  it("deduplicates matching addresses across orders and enriches missing postal code/division", () => {
    const result = buildCustomerLookupResult({
      phone: "01712345678",
      orders: [
        {
          id: "ord-2",
          order_number: "MOL-2611-02",
          status: "delivered",
          grand_total: 500,
          placed_at: "2026-11-24T10:00:00Z",
          customer_name: "Sadia Islam",
          customer_phone: "+8801712345678",
          shipping_address: {
            district: "Dhaka",
            address_line: "House 5,   Banani Road 11",
          },
        },
        {
          id: "ord-1",
          order_number: "MOL-2611-01",
          status: "delivered",
          grand_total: 500,
          placed_at: "2026-11-10T10:00:00Z",
          customer_name: "Sadia Islam",
          customer_phone: "+8801712345678",
          shipping_address: {
            division: "Dhaka",
            district: "Dhaka",
            postal_code: "1213",
            address_line: "house 5, banani road 11",
          },
        },
      ],
      geoDivisions: fallbackDivisions,
      geoDistricts: fallbackDistricts,
    });

    expect(result?.addresses).toHaveLength(1);
    expect(result?.addresses[0]).toMatchObject({
      orderNumber: "MOL-2611-02",
      division: "Dhaka",
      district: "Dhaka",
      postalCode: "1213",
    });
  });

  it("returns null when there are no fillable customer fields", () => {
    const emptyDraftOnly = buildCustomerLookupResult({
      phone: "01712345678",
      customer: {
        id: "cust-empty",
        phone: "+8801712345678",
        full_name: "Customer",
        email: null,
        default_address: null,
      },
      orders: [
        {
          id: "ord-empty",
          order_number: "MOL-2611-00",
          status: "incomplete_order",
          grand_total: 0,
          customer_name: null,
          customer_phone: "+8801712345678",
          shipping_address: {},
        },
      ],
      geoDivisions: fallbackDivisions,
      geoDistricts: fallbackDistricts,
    });

    expect(emptyDraftOnly).toBeNull();
  });
});
