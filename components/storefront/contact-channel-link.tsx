"use client";

import React, { useMemo, useSyncExternalStore } from "react";
import { getOrGenerateInquiryRefCode, trackContact } from "@/lib/facebook-pixel";
import { buildMessengerChatUrl, type StorefrontInquiryLang } from "@/lib/messenger";

const emptySubscribe = () => () => {};

export interface ContactChannelLinkProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  channel: "phone" | "whatsapp" | "messenger" | "imo" | "sms";
  refCode?: string;
  prefillInquiryRef?: boolean;
  lang?: StorefrontInquiryLang;
  phone?: string | null;
  customData?: Record<string, any>;
  children: React.ReactNode;
}

export function ContactChannelLink({
  channel,
  refCode,
  prefillInquiryRef = false,
  lang = "bn",
  phone,
  customData,
  children,
  href,
  onClick,
  ...props
}: ContactChannelLinkProps) {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const generatedRefCode = useMemo(() => {
    if (!mounted || !prefillInquiryRef || refCode) return undefined;
    return getOrGenerateInquiryRefCode("W");
  }, [mounted, prefillInquiryRef, refCode]);

  const effectiveRefCode = refCode || generatedRefCode;

  const resolvedHref =
    channel === "messenger" && prefillInquiryRef && href
      ? buildMessengerChatUrl(href, { lang, refCode: effectiveRefCode })
      : href;

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const clickRefCode =
      effectiveRefCode ||
      (prefillInquiryRef ? getOrGenerateInquiryRefCode("W") : undefined);

    if (channel === "messenger" && prefillInquiryRef && href && clickRefCode) {
      e.currentTarget.href = buildMessengerChatUrl(href, {
        lang,
        refCode: clickRefCode,
      });
    }

    trackContact({
      channel,
      refCode: clickRefCode,
      phone,
      customData: {
        source: "contact_page",
        ...(customData || {}),
      },
    });

    if (onClick) {
      onClick(e);
    }
  };

  return (
    <a {...props} href={resolvedHref} onClick={handleClick}>
      {children}
    </a>
  );
}

export default ContactChannelLink;
