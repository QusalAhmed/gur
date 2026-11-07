import { inngest } from "@/lib/inngest/client";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Helper to inspect the current date, hour, and minute in Asia/Dhaka.
 */
function getDhakaTimeParts(date: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(date);

  const map: Record<string, string> = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }

  const hour = parseInt(map.hour || "0", 10);
  const minute = parseInt(map.minute || "0", 10);
  const dateStr = `${map.year}-${map.month}-${map.day}`;

  return { hour, minute, dateStr };
}

/**
 * Inngest scheduled function to automatically decrement live stock
 * by adding simulated pre-order demand during active shopping hours.
 */
export const simulatedStockDecrementorFunction = inngest.createFunction(
  {
    id: "simulated-stock-decrementor",
    name: "Simulated Stock Pre-Order Decrementor",
    retries: 2,
    triggers: [
      { cron: "* * * * *" }, // Evaluates every minute against the configured interval setting
      { event: "simulated/stock.tick" }, // Supports manual / on-demand trigger
    ],
  },
  async ({ step }) => {
    return await step.run("evaluate-and-adjust-simulated-stock", async () => {
      const now = new Date();
      const { hour: dhakaHour, minute: dhakaMinute, dateStr: dhakaDateStr } =
        getDhakaTimeParts(now);

      // 1. Fetch current simulated demand settings from site_settings
      const { data: settingsRows, error: fetchErr } = await supabaseAdmin
        .from("site_settings")
        .select("key, value, updated_at")
        .in("key", [
          "inventory.simulated_demand_enabled",
          "inventory.simulated_demand_kg",
          "inventory.simulated_demand_min_kg",
          "inventory.simulated_demand_max_kg",
          "inventory.simulated_demand_max_cap_kg",
          "inventory.simulated_demand_interval_mins",
          "inventory.simulated_demand_last_reset_date",
        ]);

      if (fetchErr || !settingsRows) {
        throw new Error(
          `Failed to load simulated stock settings: ${fetchErr?.message || "No data"}`
        );
      }

      const settingsMap: Record<string, any> = {};
      const updatedMap: Record<string, string> = {};
      for (const row of settingsRows) {
        settingsMap[row.key] = row.value;
        updatedMap[row.key] = row.updated_at;
      }

      const rawEnabled = settingsMap["inventory.simulated_demand_enabled"];
      const isEnabled =
        rawEnabled === true ||
        rawEnabled === "true" ||
        rawEnabled === 1 ||
        rawEnabled === "1";
      const currentKg = Math.round(Number(settingsMap["inventory.simulated_demand_kg"]) || 0);
      const minKg = Math.max(1, Math.round(Number(settingsMap["inventory.simulated_demand_min_kg"]) || 1));
      const maxKg = Math.max(minKg, Math.round(Number(settingsMap["inventory.simulated_demand_max_kg"]) || 3));
      const maxCapKg = Math.max(10, Math.round(Number(settingsMap["inventory.simulated_demand_max_cap_kg"]) || 80));
      const intervalMins =
        Number(settingsMap["inventory.simulated_demand_interval_mins"]) || 10;
      const lastResetDate = String(
        settingsMap["inventory.simulated_demand_last_reset_date"] || ""
      ).replace(/^"|"$/g, "");

      // 2. Midnight Reset Check (Dhaka Time)
      // If we crossed into a new day in Dhaka, reset the simulated backlog to 0
      if (lastResetDate !== dhakaDateStr) {
        await supabaseAdmin
          .from("site_settings")
          .upsert([
            {
              key: "inventory.simulated_demand_kg",
              value: 0,
              updated_at: now.toISOString(),
              is_public: true,
            },
            {
              key: "inventory.simulated_demand_last_reset_date",
              value: dhakaDateStr,
              updated_at: now.toISOString(),
              is_public: false,
            },
          ]);

        return {
          action: "midnight_reset",
          previousKg: currentKg,
          newKg: 0,
          date: dhakaDateStr,
          message: `Simulated stock demand reset to 0 KG for new day: ${dhakaDateStr}`,
        };
      }

      // 3. Automation Enabled Check
      if (!isEnabled) {
        return {
          skipped: true,
          reason: "Simulated demand is currently disabled in site settings",
        };
      }

      // 4. Active Shopping Hours Check (08:00 AM – 11:30 PM Dhaka Time)
      const isBeforeOpening = dhakaHour < 8;
      const isAfterClosing =
        dhakaHour > 23 || (dhakaHour === 23 && dhakaMinute > 30);

      if (isBeforeOpening || isAfterClosing) {
        return {
          skipped: true,
          reason: `Outside active shopping hours (08:00-23:30 Dhaka). Current Dhaka time: ${String(
            dhakaHour
          ).padStart(2, "0")}:${String(dhakaMinute).padStart(2, "0")}`,
        };
      }

      // 5. Configured Cadence / Interval Check
      const lastUpdateIso = updatedMap["inventory.simulated_demand_kg"];
      if (lastUpdateIso) {
        const lastUpdateMs = new Date(lastUpdateIso).getTime();
        const diffMinutes = (now.getTime() - lastUpdateMs) / (60 * 1000);
        // Allow a small grace margin (e.g. 0.5 min) to account for cron jitter
        if (diffMinutes < intervalMins - 0.5) {
          return {
            skipped: true,
            reason: `Interval not reached yet (${diffMinutes.toFixed(1)}m < ${intervalMins}m)`,
          };
        }
      }

      // 6. Max Backlog Cap Check
      if (currentKg >= maxCapKg) {
        return {
          skipped: true,
          reason: `Current simulated demand (${currentKg} KG) has reached maximum cap (${maxCapKg} KG)`,
        };
      }

      // 7. Calculate Random Integer Decrement (whole KG only)
      const delta = Math.floor(Math.random() * (maxKg - minKg + 1)) + minKg;
      const nextKg = Math.min(maxCapKg, currentKg + delta);

      // 8. Commit updated simulated demand to site_settings (triggers Realtime broadcast)
      const { error: updateErr } = await supabaseAdmin
        .from("site_settings")
        .update({
          value: nextKg,
          updated_at: now.toISOString(),
        })
        .eq("key", "inventory.simulated_demand_kg");

      if (updateErr) {
        throw new Error(`Failed to update simulated demand: ${updateErr.message}`);
      }

      return {
        action: "decremented",
        previousKg: currentKg,
        addedKg: delta,
        newKg: nextKg,
        maxCapKg,
        timestamp: now.toISOString(),
      };
    });
  }
);
