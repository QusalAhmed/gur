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
 * Inngest dynamic self-scheduling function to decrement live stock
 * by adding simulated pre-order demand during active shopping hours (08:00 - 23:30 Dhaka).
 *
 * Efficiency Design:
 * - Replaces the naive 1-minute cron with dynamic self-scheduling (step.sleep + step.sendEvent).
 * - Runs only when a decrement is actually scheduled (e.g. once every 30 minutes).
 * - Stops completely overnight (23:30 - 08:00 Dhaka).
 * - Woken up automatically at 08:00 AM Dhaka (02:00 UTC) to kick off the daily cycle.
 * - Handles midnight reset at 00:00 Dhaka (18:00 UTC).
 * - Periodic daytime safety nets (every 4 hours) ensure resilience against dropped executions.
 * - singleton mode: "cancel" ensures zero duplicates and immediate responsiveness to Admin UI changes.
 */
export const simulatedStockDecrementorFunction = inngest.createFunction(
  {
    id: "simulated-stock-decrementor",
    name: "Simulated Stock Pre-Order Decrementor",
    retries: 2,
    singleton: {
      mode: "cancel",
    },
    triggers: [
      // 1. Morning store opening at 08:00 AM Dhaka (02:00 UTC) - launches daytime dynamic loop
      { cron: "0 2 * * *" },
      // 2. Midnight reset at 12:00 AM Dhaka (18:00 UTC) - clears daily backlog to 0 KG
      { cron: "0 18 * * *" },
      // 3. Daytime resilience check every 4 hours (12pm, 4pm, 8pm Dhaka = 06:00, 10:00, 14:00 UTC)
      { cron: "0 6,10,14 * * *" },
      // 4. Dynamic self-scheduled tick or on-demand trigger (from admin settings change / reset)
      { event: "simulated/stock.tick" },
    ],
  },
  async ({ step }) => {
    const evalResult = await step.run("evaluate-and-adjust-simulated-stock", async () => {
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
      const intervalMins = Math.max(
        1,
        Math.round(Number(settingsMap["inventory.simulated_demand_interval_mins"]) || 10)
      );
      const lastResetDate = String(
        settingsMap["inventory.simulated_demand_last_reset_date"] || ""
      ).replace(/^"|"$/g, "");

      // 2. Midnight Reset Check (Dhaka Time)
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

        const isOutsideHours = dhakaHour < 8 || dhakaHour > 23 || (dhakaHour === 23 && dhakaMinute > 30);
        return {
          action: "midnight_reset",
          previousKg: currentKg,
          newKg: 0,
          date: dhakaDateStr,
          message: `Simulated stock demand reset to 0 KG for new day: ${dhakaDateStr}`,
          shouldContinue: !isOutsideHours && isEnabled,
          intervalMins,
        };
      }

      // 3. Automation Enabled Check
      if (!isEnabled) {
        return {
          skipped: true,
          shouldContinue: false,
          reason: "Simulated demand is currently disabled in site settings",
          intervalMins,
        };
      }

      // 4. Active Shopping Hours Check (08:00 AM – 11:30 PM Dhaka Time)
      const isBeforeOpening = dhakaHour < 8;
      const isAfterClosing =
        dhakaHour > 23 || (dhakaHour === 23 && dhakaMinute > 30);

      if (isBeforeOpening || isAfterClosing) {
        return {
          skipped: true,
          shouldContinue: false,
          reason: `Outside active shopping hours (08:00-23:30 Dhaka). Current Dhaka time: ${String(
            dhakaHour
          ).padStart(2, "0")}:${String(dhakaMinute).padStart(2, "0")}`,
          intervalMins,
        };
      }

      // 5. Configured Cadence / Interval Check (safeguard against premature manual/external triggers)
      const lastUpdateIso = updatedMap["inventory.simulated_demand_kg"];
      if (lastUpdateIso) {
        const lastUpdateMs = new Date(lastUpdateIso).getTime();
        const diffMinutes = (now.getTime() - lastUpdateMs) / (60 * 1000);
        // Allow a small grace margin (e.g. 0.5 min) to account for sleep/dispatch jitter
        if (diffMinutes < intervalMins - 0.5) {
          const remainingMins = Math.max(1, Math.round(intervalMins - diffMinutes));
          return {
            skipped: true,
            shouldContinue: true,
            intervalMins: remainingMins,
            reason: `Interval not reached yet (${diffMinutes.toFixed(1)}m < ${intervalMins}m). Next tick in ${remainingMins}m`,
          };
        }
      }

      // 6. Max Backlog Cap Check
      if (currentKg >= maxCapKg) {
        return {
          skipped: true,
          shouldContinue: false,
          reason: `Current simulated demand (${currentKg} KG) has reached maximum cap (${maxCapKg} KG)`,
          intervalMins,
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

      // Determine if next cycle will still fall within active shopping hours
      const nextTotalDhakaMinutes = dhakaHour * 60 + dhakaMinute + intervalMins;
      const closingDhakaMinutes = 23 * 60 + 30; // 23:30
      const nextIsPastClosing = nextTotalDhakaMinutes > closingDhakaMinutes;
      const reachedCap = nextKg >= maxCapKg;

      return {
        action: "decremented",
        previousKg: currentKg,
        addedKg: delta,
        newKg: nextKg,
        maxCapKg,
        intervalMins,
        shouldContinue: !reachedCap && !nextIsPastClosing,
        timestamp: now.toISOString(),
      };
    });

    // Dynamic Self-Scheduling: Sleep for configured interval then trigger next cycle
    if (evalResult.shouldContinue && evalResult.intervalMins && evalResult.intervalMins > 0) {
      await step.sleep("wait-for-configured-interval", `${evalResult.intervalMins}m`);
      const actionType = "action" in evalResult ? String(evalResult.action) : "tick";
      await step.sendEvent("trigger-next-stock-decrement", {
        name: "simulated/stock.tick",
        data: {
          scheduledAt: new Date().toISOString(),
          previousAction: actionType,
        },
      });
    }

    return evalResult;
  }
);
