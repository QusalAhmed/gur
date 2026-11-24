"use server";

import {
  testBrevoConnection,
  BrevoSendResult,
} from "@/lib/brevo";
import { assertStaffRole } from "@/lib/admin-guard";

/**
 * Server Action: Tests Brevo connectivity by dispatching a test email.
 */
export async function testBrevoConnectionAction(
  recipientEmail?: string
): Promise<BrevoSendResult> {
  try {
    await assertStaffRole(["owner", "admin"]);
    return await testBrevoConnection(recipientEmail);
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to test Brevo connection",
    };
  }
}

