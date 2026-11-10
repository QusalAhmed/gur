import { NextRequest, NextResponse } from "next/server";
import {
  sendCapiPageViewAction,
  sendCapiViewContentAction,
  sendCapiAddToCartAction,
  sendCapiInitiateCheckoutAction,
  sendCapiPurchaseAction,
  sendCapiContactAction,
  sendCapiUserPropertiesAction,
} from "@/actions/facebook-capi";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { eventType, ...params } = body || {};

    let result;
    switch (eventType) {
      case "PageView":
        result = await sendCapiPageViewAction(params);
        break;
      case "ViewContent":
        result = await sendCapiViewContentAction(params);
        break;
      case "AddToCart":
        result = await sendCapiAddToCartAction(params);
        break;
      case "InitiateCheckout":
        result = await sendCapiInitiateCheckoutAction(params);
        break;
      case "Purchase":
        result = await sendCapiPurchaseAction(params);
        break;
      case "Contact":
        result = await sendCapiContactAction(params);
        break;
      case "UserProperties":
        result = await sendCapiUserPropertiesAction(params);
        break;
      default:
        return NextResponse.json(
          { error: `Unknown eventType: ${eventType}` },
          { status: 400 }
        );
    }

    return NextResponse.json(result || { success: true });
  } catch (err: any) {
    console.error("[CAPI API] Error handling CAPI event:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "CAPI error" },
      { status: 500 }
    );
  }
}
