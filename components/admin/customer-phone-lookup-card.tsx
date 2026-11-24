"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building,
  Check,
  History,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  UserCheck,
  X,
} from "lucide-react";
import {
  searchCustomerByPhoneAction,
  type CustomerLookupResult,
} from "@/actions/new-order-ops";
import type { CustomerSavedAddressOption } from "@/lib/customer-autofill";
import { resolveGeoLocationForOrderForm } from "@/lib/customer-autofill";
import { formatBDT, formatDhakaDate, formatPhoneDisplay } from "@/lib/admin-format";
import { parseBdPhone } from "@/lib/phone";
import type { DbGeoDistrict, DbGeoDivision } from "@/lib/supabase";
import { getOtherOrderInsight } from "@/types/order";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface CustomerPhoneLookupCardProps {
  phone?: string | null;
  initialPhone?: string | null;
  geoDivisions: DbGeoDivision[];
  geoDistricts: DbGeoDistrict[];
  onAutofill: (
    customer: CustomerLookupResult,
    selectedAddress: CustomerSavedAddressOption | null
  ) => void;
}

const PHONE_LOOKUP_DEBOUNCE_MS = 350;

export function CustomerPhoneLookupCard({
  phone,
  initialPhone,
  geoDivisions,
  geoDistricts,
  onAutofill,
}: CustomerPhoneLookupCardProps) {
  const queryClient = useQueryClient();

  const parsedPhone = React.useMemo(() => parseBdPhone(phone), [phone]);
  const normalizedPhone = parsedPhone.isValid ? parsedPhone.normalized : "";
  const initialNormalized = React.useMemo(() => {
    const parsed = parseBdPhone(initialPhone);
    return parsed.isValid ? parsed.normalized : "";
  }, [initialPhone]);

  const [debouncedPhone, setDebouncedPhone] = React.useState<string>("");

  const isImmediatePhone = Boolean(
    normalizedPhone &&
      (normalizedPhone === initialNormalized ||
        queryClient.getQueryData(["admin", "customer-phone-lookup", normalizedPhone]) !==
          undefined)
  );

  React.useEffect(() => {
    if (!normalizedPhone || isImmediatePhone) {
      return;
    }

    const timer = setTimeout(() => {
      setDebouncedPhone(normalizedPhone);
    }, PHONE_LOOKUP_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [normalizedPhone, isImmediatePhone]);

  const activeLookupPhone = !normalizedPhone
    ? ""
    : isImmediatePhone
    ? normalizedPhone
    : debouncedPhone === normalizedPhone
    ? normalizedPhone
    : "";

  const {
    data: customerData,
    dataUpdatedAt,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<CustomerLookupResult | null>({
    queryKey: ["admin", "customer-phone-lookup", activeLookupPhone],
    queryFn: async () => {
      if (!activeLookupPhone) return null;
      const res = await searchCustomerByPhoneAction(activeLookupPhone);
      if (!res.ok) {
        throw new Error(res.message || "Could not check previous customer records");
      }
      return res.data ?? null;
    },
    enabled: Boolean(activeLookupPhone),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const [dismissedPhone, setDismissedPhone] = React.useState<string | null>(null);
  const [selectedAddressOverride, setSelectedAddressOverride] = React.useState<{
    phone: string;
    addressId: string;
  } | null>(null);
  const [appliedSignature, setAppliedSignature] = React.useState<string | null>(null);

  if (!normalizedPhone || dismissedPhone === normalizedPhone) {
    return null;
  }

  const isWaitingDebounce = normalizedPhone !== activeLookupPhone;
  if ((isWaitingDebounce || isLoading || isFetching) && customerData === undefined) {
    return (
      <div
        id="customer-phone-lookup-loading"
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-amber-500/30 bg-amber-500/5 text-xs text-muted-foreground"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600 shrink-0" />
        <span>
          Checking previous orders &amp; saved profile for{" "}
          <span className="font-mono font-medium text-foreground">
            {formatPhoneDisplay(normalizedPhone)}
          </span>
          ...
        </span>
      </div>
    );
  }

  if (isError && !customerData) {
    return (
      <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-rose-200 dark:border-rose-900/40 bg-rose-50/60 dark:bg-rose-950/20 text-xs text-rose-800 dark:text-rose-200">
        <span className="flex items-center gap-1.5 min-w-0 truncate">
          <AlertTriangle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
          <span className="truncate">
            {error instanceof Error ? error.message : "Could not check customer history"}
          </span>
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          className="h-6 px-2 text-[11px] text-rose-700 hover:text-rose-900 dark:text-rose-300 shrink-0 cursor-pointer"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Retry
        </Button>
      </div>
    );
  }

  if (!customerData) {
    return null;
  }

  const addresses = customerData.addresses || [];
  const selectedAddress =
    (selectedAddressOverride?.phone === customerData.phone
      ? addresses.find((a) => a.id === selectedAddressOverride.addressId)
      : undefined) ||
    addresses[0] ||
    null;

  const resolvedPreviewGeo = selectedAddress
    ? resolveGeoLocationForOrderForm(
        selectedAddress.division,
        selectedAddress.district,
        geoDivisions,
        geoDistricts
      )
    : null;
  const addressPreviewParts = selectedAddress
    ? [
        selectedAddress.addressLine,
        resolvedPreviewGeo?.district || selectedAddress.district,
        resolvedPreviewGeo?.division || selectedAddress.division,
        selectedAddress.postalCode ? `ZIP ${selectedAddress.postalCode}` : "",
      ].filter(Boolean)
    : [];

  const currentSignature = `${customerData.phone}|${selectedAddress?.id || "no-address"}|${dataUpdatedAt}`;
  const isApplied = appliedSignature === currentSignature;
  const { stats } = customerData;
  const hasActiveOrDelivered = stats.activeOrDeliveredCount > 0;
  const lastInsight = stats.lastOrderStatus
    ? getOtherOrderInsight(stats.lastOrderStatus)
    : null;

  const handleApplyClick = () => {
    onAutofill(customerData, selectedAddress);
    setAppliedSignature(currentSignature);
  };

  return (
    <div
      id="customer-phone-lookup-card"
      className="rounded-xl border border-amber-500/35 bg-amber-500/[0.06] dark:bg-amber-950/20 p-3.5 space-y-2.5 shadow-2xs animate-in fade-in-50 duration-200"
    >
      {/* Header: Match status, Customer Name, Stats & Primary CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge
              variant="outline"
              className={
                hasActiveOrDelivered
                  ? "text-[10px] px-1.5 py-0 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold"
                  : stats.cancelledCount > 0
                  ? "text-[10px] px-1.5 py-0 border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300 font-semibold"
                  : "text-[10px] px-1.5 py-0 border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300 font-semibold"
              }
            >
              <UserCheck className="h-2.5 w-2.5 mr-1" />
              {hasActiveOrDelivered
                ? "Customer Found"
                : stats.cancelledCount > 0
                ? "Prior Cancelled Order"
                : stats.incompleteCount > 0
                ? "Incomplete Checkout Found"
                : "Saved Profile Found"}
            </Badge>

            <span className="font-semibold text-sm text-foreground truncate">
              {customerData.name || formatPhoneDisplay(customerData.phone)}
            </span>

            {customerData.businessName && (
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 gap-1 font-medium"
              >
                <Building className="h-2.5 w-2.5 text-amber-600" />
                {customerData.businessName}
              </Badge>
            )}

            {isApplied && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-medium"
              >
                <Check className="h-2.5 w-2.5 mr-0.5" />
                Autofilled
              </Badge>
            )}
          </div>

          {/* Order History & Stats Row */}
          <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
            {stats.totalOrders > 0 && (
              <span className="inline-flex items-center gap-1 font-medium text-foreground/85">
                <History className="h-3 w-3 text-amber-600 shrink-0" />
                {stats.totalOrders} {stats.totalOrders === 1 ? "order" : "orders"}
                {stats.totalSpent > 0 && ` · ${formatBDT(stats.totalSpent)}`}
              </span>
            )}
            {stats.returnedCount > 0 && (
              <span className="px-1.5 py-0 rounded bg-orange-500/10 text-orange-700 dark:text-orange-300 text-[10px] font-medium">
                {stats.returnedCount} returned
              </span>
            )}
            {stats.cancelledCount > 0 && (
              <span className="px-1.5 py-0 rounded bg-rose-500/10 text-rose-700 dark:text-rose-300 text-[10px] font-medium">
                {stats.cancelledCount} cancelled
              </span>
            )}
            {stats.incompleteCount > 0 && (
              <span className="px-1.5 py-0 rounded bg-slate-500/10 text-slate-700 dark:text-slate-300 text-[10px] font-medium">
                {stats.incompleteCount} incomplete
              </span>
            )}
            {stats.lastOrderNumber && (
              <span className="inline-flex items-center gap-1">
                <span>Last:</span>
                <span className="font-mono text-foreground/80">#{stats.lastOrderNumber}</span>
                {lastInsight && (
                  <span
                    className={`px-1.5 py-0 rounded border text-[9px] font-medium ${lastInsight.badgeStyle}`}
                  >
                    {lastInsight.statusText}
                  </span>
                )}
                {stats.lastOrderAt && <span>({formatDhakaDate(stats.lastOrderAt)})</span>}
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            id="btn-autofill-customer"
            type="button"
            size="sm"
            onClick={handleApplyClick}
            className="h-8 px-3 text-xs bg-amber-600 hover:bg-amber-700 text-white shadow-xs cursor-pointer gap-1.5"
          >
            {isApplied ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Re-apply Info
              </>
            ) : (
              <>
                <UserCheck className="h-3.5 w-3.5" />
                Autofill Details
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => setDismissedPhone(normalizedPhone)}
            className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
            title="Dismiss suggestion"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Contact & Address Details Preview + Address Switcher */}
      <div className="pt-2 border-t border-amber-500/20 space-y-2 text-xs">
        {(customerData.alternativePhone || customerData.email) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            {customerData.alternativePhone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3 text-amber-600 shrink-0" />
                <span>Alt:</span>
                <span className="font-mono text-foreground">
                  {formatPhoneDisplay(customerData.alternativePhone)}
                </span>
              </span>
            )}
            {customerData.email && (
              <span className="inline-flex items-center gap-1">
                <Mail className="h-3 w-3 text-amber-600 shrink-0" />
                <span className="text-foreground">{customerData.email}</span>
              </span>
            )}
          </div>
        )}

        {addresses.length > 0 && selectedAddress && (
          <div className="space-y-1.5">
            {addresses.length > 1 && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
                <span className="text-[11px] font-medium text-muted-foreground shrink-0">
                  Saved Addresses ({addresses.length}):
                </span>
                <Select
                  value={selectedAddress.id}
                  onValueChange={(val) => {
                    if (val) {
                      setSelectedAddressOverride({
                        phone: customerData.phone,
                        addressId: val,
                      });
                    }
                  }}
                >
                  <SelectTrigger
                    id="select-autofill-address"
                    className="h-7 text-[11px] bg-background flex-1 min-w-0"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[70] max-w-[90vw]">
                    {addresses.map((addr) => {
                      const summary = [
                        addr.addressLine,
                        addr.district,
                        addr.postalCode,
                      ]
                        .filter(Boolean)
                        .join(", ");
                      return (
                        <SelectItem key={addr.id} value={addr.id} className="text-xs">
                          <span className="font-medium">{addr.sourceLabel}</span>
                          {summary ? ` — ${summary}` : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-start gap-1.5 text-[11px] text-foreground/90 bg-background/70 rounded-lg px-2.5 py-1.5 border border-border/70">
              <MapPin className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="leading-snug">
                    {addressPreviewParts.join(", ") || "Saved address"}
                  </span>
                  {selectedAddress.isGiftRecipient && (
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1.5 py-0 border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-300"
                    >
                      Different Recipient
                      {selectedAddress.recipientName
                        ? `: ${selectedAddress.recipientName}`
                        : ""}
                    </Badge>
                  )}
                </div>
                {addresses.length === 1 && (
                  <p className="text-[10px] text-muted-foreground">
                    Source: {selectedAddress.sourceLabel}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
