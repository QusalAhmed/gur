import { NextRequest, NextResponse } from "next/server";
import { getStaffSession } from "@/lib/admin-guard";
import { ROLE_CAPABILITIES } from "@/lib/admin-permissions";
import { safePublicErrorMessage } from "@/lib/security";
import {
  sendCapiPageViewInternal,
  sendCapiViewContentInternal,
  sendCapiAddToCartInternal,
  sendCapiInitiateCheckoutInternal,
  sendCapiPurchaseInternal,
  sendCapiContactInternal,
  sendCapiUserPropertiesInternal,
} from "@/lib/capi-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { success: false, error: "Invalid request payload" },
        { status: 400 }
      );
    }

    const { eventType, ...params } = body as { eventType?: string; [key: string]: any };

    let result;
    switch (eventType) {
      case "PageView":
        result = await sendCapiPageViewInternal(params as any);
        break;
      case "ViewContent":
        result = await sendCapiViewContentInternal(params as any);
        break;
      case "AddToCart":
        result = await sendCapiAddToCartInternal(params as any);
        break;
      case "InitiateCheckout":
        result = await sendCapiInitiateCheckoutInternal(params as any);
        break;
      case "Purchase": {
        const session = await getStaffSession();
        if (!session) {
          return NextResponse.json(
            { success: false, error: "Unauthorized" },
            { status: 401 }
          );
        }
        if (!ROLE_CAPABILITIES[session.role]?.canManageOrders) {
          return NextResponse.json(
            { success: false, error: "Forbidden" },
            { status: 403 }
          );
        }
        result = await sendCapiPurchaseInternal(params as any);
        break;
      }
      case "Contact":
        result = await sendCapiContactInternal(params as any);
        break;
      case "UserProperties":
        result = await sendCapiUserPropertiesInternal(params as any);
        break;
      default:
        return NextResponse.json(
          { success: false, error: "Unsupported eventType" },
          { status: 400 }
        );
    }

    return NextResponse.json(result || { success: true });
  } catch (err: any) {
    console.error("[CAPI API] Error handling CAPI event:", err);
    return NextResponse.json(
      { success: false, error: safePublicErrorMessage("CAPI error") },
      { status: 500 }
    );
  }
}
