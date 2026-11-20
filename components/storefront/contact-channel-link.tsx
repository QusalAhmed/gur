"use client";

import React from "react";
import { trackContact } from "@/lib/facebook-pixel";

export interface ContactChannelLinkProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  channel: "phone" | "whatsapp" | "messenger" | "imo" | "sms";
  refCode?: string;
  phone?: string | null;
  customData?: Record<string, any>;
  children: React.ReactNode;
}

export function ContactChannelLink({
  channel,
  refCode,
  phone,
  customData,
  children,
  onClick,
  ...props
}: ContactChannelLinkProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    trackContact({
      channel,
      refCode,
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
    <a {...props} onClick={handleClick}>
      {children}
    </a>
  );
}

export default ContactChannelLink;
