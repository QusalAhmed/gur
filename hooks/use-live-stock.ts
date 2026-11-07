"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase/client";

export interface StockDayProjection {
  dayIndex: number; // 0 for today, 1 for tomorrow, 2 for day after tomorrow, etc.
  dayKey: string;
  date: Date;
  dayNameBn: string;
  dayNameEn: string;
  dateFormattedBn: string;
  dateFormattedEn: string;
  weekdayBn: string;
  weekdayEn: string;
  capacityKg: number;
  bookedKg: number;
  availableKg: number;
  isToday: boolean;
  status: "sold_out" | "fully_booked" | "available";
  percentBooked: number;
}

export interface LiveStockState {
  todayStockKg: number;
  dailyProductionKg: number;
  totalActiveOrdersKg: number;
  activeOrderCount: number;
  simulatedDemandKg: number;
  isSimulatedDemandEnabled: boolean;
  lastStockChangeTimestamp: number;
  projections: StockDayProjection[];
  nextAvailableDay: StockDayProjection | null;
  isLoading: boolean;
  isLiveConnected: boolean;
  isRefetching: boolean;
  lastUpdatedAt: Date | null;
  refresh: () => Promise<void>;
}

const BN_MONTHS = [
  "জানুয়ারি",
  "ফেব্রুয়ারি",
  "মার্চ",
  "এপ্রিল",
  "মে",
  "জুন",
  "জুলাই",
  "আগস্ট",
  "সেপ্টেম্বর",
  "অক্টোবর",
  "নভেম্বর",
  "ডিসেম্বর",
];

const EN_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const BN_WEEKDAYS = [
  "রবিবার",
  "সোমবার",
  "মঙ্গলবার",
  "বুধবার",
  "বৃহস্পতিবার",
  "শুক্রবার",
  "শনিবার",
];

const EN_WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
function toBnDigits(val: number | string): string {
  return String(val).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)] || d);
}

/**
 * Calculates weight in KG from an order item row.
 */
export function parseOrderItemWeightKg(item: {
  quantity?: number | string | null;
  net_quantity?: number | string | null;
  net_unit?: string | null;
  variant_name?: string | null;
  product_name?: string | null;
}): number {
  const qty = Number(item.quantity) || 1;

  if (item.net_quantity != null && Number(item.net_quantity) > 0) {
    const net = Number(item.net_quantity);
    const unit = (item.net_unit || "").toLowerCase();
    if (unit === "g" || unit === "gram" || unit === "grams") return (net / 1000) * qty;
    if (unit === "t" || unit === "ton" || unit === "tonne") return net * 1000 * qty;
    return net * qty;
  }

  const name = `${item.variant_name || ""} ${item.product_name || ""}`.toLowerCase();
  if (name.includes("500 g") || name.includes("500g") || name.includes("৫০০ গ্রাম")) {
    return 0.5 * qty;
  }
  if (
    name.includes("1 kg") ||
    name.includes("1kg") ||
    name.includes("১ কেজি") ||
    name.includes("standard pack")
  ) {
    return 1 * qty;
  }
  if (name.includes("2 kg") || name.includes("2kg") || name.includes("২ কেজি")) {
    return 2 * qty;
  }
  if (name.includes("5 kg") || name.includes("5kg") || name.includes("৫ কেজি")) {
    return 5 * qty;
  }
  if (name.includes("20 l") || name.includes("20l") || name.includes("২০ লিটার")) {
    return 20 * qty;
  }
  if (name.includes("200 l") || name.includes("200l") || name.includes("২০০ লিটার")) {
    return 200 * qty;
  }
  if (name.includes("ton") || name.includes("টন")) {
    return 1000 * qty;
  }

  return 1 * qty;
}

/**
 * Hook that computes live current and future available stock in real time.
 * - Current stock is ALWAYS 0.
 * - Future production per day is read from site settings (default 50 kg).
 * - Total unfulfilled active orders (pending, confirmed, processing) are deducted sequentially.
 * - If tomorrow's available stock is 0, continues projecting forward until available stock > 0.
 * - Supabase Realtime listens to live changes on the `orders` table.
 */
export function useLiveStock(initialDailyCapacity: number = 50): LiveStockState {
  const [dailyProductionKg, setDailyProductionKg] = useState<number>(initialDailyCapacity);
  const [totalActiveOrdersKg, setTotalActiveOrdersKg] = useState<number>(0);
  const [activeOrderCount, setActiveOrderCount] = useState<number>(0);
  const [simulatedDemandKg, setSimulatedDemandKg] = useState<number>(0);
  const [isSimulatedDemandEnabled, setIsSimulatedDemandEnabled] = useState<boolean>(true);
  const [lastStockChangeTimestamp, setLastStockChangeTimestamp] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefetching, setIsRefetching] = useState<boolean>(false);
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [currentDate, setCurrentDate] = useState<Date | null>(null);

  const isMountedRef = useRef<boolean>(true);

  // Set client-side date safely after mount to avoid prerender/SSR non-determinism
  useEffect(() => {
    setCurrentDate(new Date());
  }, []);

  // Fetch production setting and active orders
  const fetchData = useCallback(async (isBackground: boolean = false) => {
    if (!isMountedRef.current) return;
    if (isBackground) {
      setIsRefetching(true);
    } else {
      setIsLoading(true);
    }

    try {
      // 1. Fetch live production quota and simulated demand settings
      const { data: settingsData } = await supabase
        .from("site_settings")
        .select("key, value")
        .in("key", [
          "inventory.daily_production_kg",
          "inventory.simulated_demand_enabled",
          "inventory.simulated_demand_kg",
        ]);

      if (settingsData && isMountedRef.current) {
        for (const row of settingsData) {
          if (row.key === "inventory.daily_production_kg") {
            const prod = Number(row.value);
            if (prod > 0) setDailyProductionKg(prod);
          } else if (row.key === "inventory.simulated_demand_enabled") {
            setIsSimulatedDemandEnabled(
              row.value === true ||
              row.value === "true" ||
              row.value === 1 ||
              row.value === "1"
            );
          } else if (row.key === "inventory.simulated_demand_kg") {
            const kg = Math.round(Number(row.value) || 0);
            setSimulatedDemandKg((prev) => {
              if (prev !== kg) {
                setLastStockChangeTimestamp(Date.now());
              }
              return kg;
            });
          }
        }
      }

      // 2. Fetch active unfulfilled orders and items
      const { data: ordersData, error: ordersErr } = await supabase
        .from("orders")
        .select(`
          id,
          status,
          order_items (
            id,
            quantity,
            net_quantity,
            net_unit,
            variant_name,
            product_name
          )
        `)
        .in("status", ["pending", "confirmed", "processing"]);

      if (!ordersErr && ordersData && isMountedRef.current) {
        let totalWeight = 0;
        let count = 0;

        for (const order of ordersData) {
          count++;
          const items = (order as any).order_items || [];
          for (const item of items) {
            totalWeight += parseOrderItemWeightKg(item);
          }
        }

        setTotalActiveOrdersKg(Math.round(totalWeight * 10) / 10);
        setActiveOrderCount(count);
        setLastUpdatedAt(new Date());
      }
    } catch (err) {
      console.warn("Failed to fetch live stock data:", err);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
        setIsRefetching(false);
      }
    }
  }, []);

  // Initial fetch and Realtime subscription
  useEffect(() => {
    isMountedRef.current = true;
    fetchData(false);

    // Subscribe to real-time changes on both orders and site_settings tables
    const channel = supabase
      .channel("storefront-live-stock")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        () => {
          // Re-calculate instantaneously when real orders are inserted/updated/deleted
          fetchData(true);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "site_settings",
        },
        (payload) => {
          // Re-calculate instantaneously when production quota or simulated stock changes
          const key = (payload.new as any)?.key || (payload.old as any)?.key;
          if (!key || String(key).startsWith("inventory.")) {
            fetchData(true);
          }
        }
      )
      .subscribe((status) => {
        if (isMountedRef.current) {
          setIsLiveConnected(status === "SUBSCRIBED");
        }
      });

    return () => {
      isMountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  // Frontend calculation: project availability day-by-day
  const { projections, nextAvailableDay } = useMemo(() => {
    if (!currentDate) {
      return { projections: [], nextAvailableDay: null };
    }

    const list: StockDayProjection[] = [];
    const capacity = Math.max(1, dailyProductionKg);
    const effectiveSimulatedDemand = isSimulatedDemandEnabled ? simulatedDemandKg : 0;
    let remainingBacklog = Math.round((totalActiveOrdersKg + effectiveSimulatedDemand) * 10) / 10;

    const now = currentDate;

    // Day 0: Today (Current stock is ALWAYS 0)
    const today = new Date(now);
    list.push({
      dayIndex: 0,
      dayKey: "today",
      date: today,
      dayNameBn: "আজ",
      dayNameEn: "Today",
      dateFormattedBn: `${toBnDigits(today.getDate())} ${BN_MONTHS[today.getMonth()]}`,
      dateFormattedEn: `${EN_MONTHS[today.getMonth()]} ${today.getDate()}`,
      weekdayBn: BN_WEEKDAYS[today.getDay()],
      weekdayEn: EN_WEEKDAYS[today.getDay()],
      capacityKg: 0,
      bookedKg: 0,
      availableKg: 0,
      isToday: true,
      status: "sold_out",
      percentBooked: 100,
    });

    // Day 1: Tomorrow
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);

    const tomorrowBooked = Math.min(capacity, remainingBacklog);
    const tomorrowAvailable = Math.max(0, capacity - tomorrowBooked);
    remainingBacklog = Math.max(0, remainingBacklog - tomorrowBooked);

    list.push({
      dayIndex: 1,
      dayKey: "tomorrow",
      date: tomorrow,
      dayNameBn: "আগামীকাল",
      dayNameEn: "Tomorrow",
      dateFormattedBn: `${toBnDigits(tomorrow.getDate())} ${BN_MONTHS[tomorrow.getMonth()]}`,
      dateFormattedEn: `${EN_MONTHS[tomorrow.getMonth()]} ${tomorrow.getDate()}`,
      weekdayBn: BN_WEEKDAYS[tomorrow.getDay()],
      weekdayEn: EN_WEEKDAYS[tomorrow.getDay()],
      capacityKg: capacity,
      bookedKg: Math.round(tomorrowBooked * 10) / 10,
      availableKg: Math.round(tomorrowAvailable * 10) / 10,
      isToday: false,
      status: tomorrowAvailable > 0 ? "available" : "fully_booked",
      percentBooked: Math.min(100, Math.round((tomorrowBooked / capacity) * 100)),
    });

    // "if tomorrow's stock is 0, show stock till the date when future order is not fully booked"
    // We continue projecting forward until we reach the date when future order is NOT fully booked (availableKg > 0).
    let dayOffset = 2;
    const maxDays = 120; // Support projecting ahead until an unbooked batch is found

    while (
      (list[list.length - 1].availableKg === 0 || list.length < 2) &&
      dayOffset <= maxDays
    ) {
      const projDate = new Date(now);
      projDate.setDate(now.getDate() + dayOffset);

      const dayBooked = Math.min(capacity, remainingBacklog);
      const dayAvailable = Math.max(0, capacity - dayBooked);
      remainingBacklog = Math.max(0, remainingBacklog - dayBooked);

      const isDayAfter = dayOffset === 2;
      const dayNameBn = isDayAfter
        ? "পরশু"
        : `${toBnDigits(projDate.getDate())} ${BN_MONTHS[projDate.getMonth()]}`;
      const dayNameEn = isDayAfter
        ? "Day After Tomorrow"
        : `${EN_MONTHS[projDate.getMonth()]} ${projDate.getDate()}`;

      list.push({
        dayIndex: dayOffset,
        dayKey: `day-${dayOffset}`,
        date: projDate,
        dayNameBn,
        dayNameEn,
        dateFormattedBn: `${toBnDigits(projDate.getDate())} ${BN_MONTHS[projDate.getMonth()]}`,
        dateFormattedEn: `${EN_MONTHS[projDate.getMonth()]} ${projDate.getDate()}`,
        weekdayBn: BN_WEEKDAYS[projDate.getDay()],
        weekdayEn: EN_WEEKDAYS[projDate.getDay()],
        capacityKg: capacity,
        bookedKg: Math.round(dayBooked * 10) / 10,
        availableKg: Math.round(dayAvailable * 10) / 10,
        isToday: false,
        status: dayAvailable > 0 ? "available" : "fully_booked",
        percentBooked: Math.min(100, Math.round((dayBooked / capacity) * 100)),
      });

      if (dayAvailable > 0) {
        break; // Reached the first day with available stock!
      }

      dayOffset++;
    }

    const nextAvailable = list.find((d) => !d.isToday && d.availableKg > 0) || null;

    return { projections: list, nextAvailableDay: nextAvailable };
  }, [dailyProductionKg, totalActiveOrdersKg, simulatedDemandKg, isSimulatedDemandEnabled, currentDate]);

  return {
    todayStockKg: 0, // Current stock is ALWAYS 0
    dailyProductionKg,
    totalActiveOrdersKg,
    activeOrderCount,
    simulatedDemandKg,
    isSimulatedDemandEnabled,
    lastStockChangeTimestamp,
    projections,
    nextAvailableDay,
    isLoading,
    isLiveConnected,
    isRefetching,
    lastUpdatedAt,
    refresh: () => fetchData(true),
  };
}

