"use client";

import * as React from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PhoneCall,
  Copy,
  Check,
  Send,
  MessageSquare,
  ShoppingBag,
  Clock,
  Calendar,
  ExternalLink,
  MapPin,
  Mail,
  User,
  History,
  Package,
  Truck,
  Home,
  Building,
} from "lucide-react";
import {
  CallListItemDetail,
  CallLogItem,
  CallItemStatus,
  logCallAttemptAction,
  sendCallCustomerSmsAction,
  getCustomerOrdersAction,
  CustomerOrderHistory,
  CustomerDeliverySummary,
} from "@/actions/call-lists";
import { CallStatusBadge } from "./call-status-badge";
import { CallTimeline } from "./call-timeline";
import { CustomerOrderCard } from "./customer-order-card";
import { SteadfastDeliveryRecordBadge } from "@/components/admin/steadfast-delivery-record-badge";
import { formatCustomerAddress, FormattedCustomerAddress } from "@/lib/admin-format";
import { cn } from "@/lib/utils";

interface CallDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: CallListItemDetail | null;
  logs: CallLogItem[];
  onLogSaved: () => void;
}

const OUTCOME_OPTIONS: {
  value: CallItemStatus;
  label: string;
  desc: string;
  color: string;
}[] = [
  {
    value: "no_answer",
    label: "No Answer (রিসিভ করেননি)",
    desc: "Ringing, busy, or disconnected without answer",
    color: "hover:border-amber-500/50 hover:bg-amber-500/5",
  },
  {
    value: "call_later",
    label: "Call Later (পরে কল করুন)",
    desc: "Customer requested a call at a specific later time",
    color: "hover:border-blue-500/50 hover:bg-blue-500/5",
  },
  {
    value: "reached_interested",
    label: "Interested (আগ্রহী)",
    desc: "Positive conversation, considering products",
    color: "hover:border-emerald-500/50 hover:bg-emerald-500/5",
  },
  {
    value: "reached_ordered",
    label: "Order Confirmed (অর্ডার প্রস্তুত)",
    desc: "Customer agreed and confirmed purchase",
    color: "hover:border-teal-500/50 hover:bg-teal-500/5",
  },
  {
    value: "reached_not_interested",
    label: "Not Interested (আগ্রহ নেই)",
    desc: "Customer declined offer or not needed",
    color: "hover:border-slate-500/50 hover:bg-slate-500/5",
  },
  {
    value: "wrong_number",
    label: "Wrong Number (ভুল নম্বর)",
    desc: "Invalid contact or unknown person",
    color: "hover:border-rose-500/50 hover:bg-rose-500/5",
  },
];

export function CallDrawer({
  open,
  onOpenChange,
  item,
  logs,
  onLogSaved,
}: CallDrawerProps) {
  const [outcome, setOutcome] = React.useState<CallItemStatus>("no_answer");
  const [callbackAt, setCallbackAt] = React.useState<string>("");
  const [notes, setNotes] = React.useState<string>("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [copiedAddress, setCopiedAddress] = React.useState(false);

  // SMS section state
  const [showSms, setShowSms] = React.useState(false);
  const [smsMessage, setSmsMessage] = React.useState("");
  const [isSendingSms, setIsSendingSms] = React.useState(false);

  // Fetch customer full order history and delivery stats
  const customerId = item?.customerId;
  const customerPhone = item?.customerPhone;
  const { data: ordersResult, isLoading: isLoadingOrders } = useQuery<{
    orders: CustomerOrderHistory[];
    deliverySummary?: CustomerDeliverySummary;
  }>({
    queryKey: ["admin", "customer-orders", customerId, customerPhone],
    queryFn: async () => {
      if (!customerId) return { orders: [], deliverySummary: undefined };
      const res = await getCustomerOrdersAction(customerId, customerPhone);
      return {
        orders: res.success ? res.data : [],
        deliverySummary: res.deliverySummary,
      };
    },
    enabled: open && !!customerId,
    staleTime: 60_000,
  });

  const customerOrders = ordersResult?.orders || [];
  const deliverySummary = ordersResult?.deliverySummary;

  // Reset or preset form when item changes
  React.useEffect(() => {
    if (item) {
      setOutcome(item.status === "pending" ? "no_answer" : item.status);
      setNotes("");
      setCallbackAt("");
      setShowSms(false);
      setSmsMessage("");
    }
  }, [item]);

  // Robust address resolution:
  // 1. Profile default address
  const profileAddress = React.useMemo(() => {
    return formatCustomerAddress(item?.customerAddress);
  }, [item?.customerAddress]);

  // 2. Extracted order delivery destinations
  const orderAddresses = React.useMemo(() => {
    const list: {
      orderNumber: string;
      date: string;
      parsed: FormattedCustomerAddress;
    }[] = [];
    const seen = new Set<string>();

    for (const ord of customerOrders) {
      const parsed = formatCustomerAddress(ord.shippingAddress);
      if (parsed && parsed.fullAddress) {
        const key = parsed.fullAddress.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          list.push({
            orderNumber: ord.orderNumber,
            date: ord.createdAt,
            parsed,
          });
        }
      }
    }
    return list;
  }, [customerOrders]);

  // Primary address to display
  const primaryAddress = React.useMemo(() => {
    if (profileAddress?.addressLine) {
      return {
        address: profileAddress,
        source: "Profile Saved Address" as const,
        badgeVariant: "secondary" as const,
      };
    }
    if (orderAddresses.length > 0) {
      return {
        address: orderAddresses[0].parsed,
        source: `From Order #${orderAddresses[0].orderNumber}` as const,
        badgeVariant: "outline" as const,
      };
    }
    if (profileAddress) {
      return {
        address: profileAddress,
        source: "Profile Address" as const,
        badgeVariant: "secondary" as const,
      };
    }
    return null;
  }, [profileAddress, orderAddresses]);

  if (!item) return null;

  const filteredLogs = logs.filter((l) => l.callListItemId === item.id);

  const handleCopyPhone = () => {
    navigator.clipboard.writeText(item.customerPhone);
    setCopied(true);
    toast.success("Phone number copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyAddress = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedAddress(true);
    toast.success("Delivery address copied to clipboard");
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const handleApplyPresetCallback = (hours: number, targetHour?: number) => {
    const target = new Date();
    if (targetHour !== undefined) {
      target.setDate(target.getDate() + 1);
      target.setHours(targetHour, 0, 0, 0);
    } else {
      target.setTime(target.getTime() + hours * 60 * 60 * 1000);
    }
    const offset = target.getTimezoneOffset();
    const local = new Date(target.getTime() - offset * 60 * 1000);
    setCallbackAt(local.toISOString().slice(0, 16));
  };

  const handleSaveCallAttempt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (outcome === "call_later" && !callbackAt) {
      toast.error("Please select a callback date and time");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await logCallAttemptAction({
        callListItemId: item.id,
        outcome,
        notes,
        callbackAt: outcome === "call_later" ? callbackAt : null,
      });

      if (res.success) {
        toast.success("Call attempt logged successfully");
        setNotes("");
        onLogSaved();
      } else {
        toast.error(res.error || "Failed to save call attempt");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save call attempt");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendSms = async () => {
    if (!smsMessage.trim()) {
      toast.error("Please enter an SMS message text");
      return;
    }

    try {
      setIsSendingSms(true);
      const res = await sendCallCustomerSmsAction({
        customerPhone: item.customerPhone,
        customerName: item.customerName,
        messageText: smsMessage.trim(),
        callListItemId: item.id,
      });

      if (res.success) {
        toast.success("SMS sent successfully to customer");
        setSmsMessage("");
        setShowSms(false);
        onLogSaved();
      } else {
        toast.error(res.error || "Failed to send SMS");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to send SMS");
    } finally {
      setIsSendingSms(false);
    }
  };

  // WhatsApp direct link
  const rawCleanPhone = item.customerPhone.replace(/\D/g, "");
  const waUrl = `https://wa.me/${
    rawCleanPhone.startsWith("88") ? rawCleanPhone : "88" + rawCleanPhone
  }`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl p-0 flex flex-col h-full bg-background overflow-hidden"
      >
        {/* Top Header Card */}
        <SheetHeader className="p-5 border-b bg-card/60 backdrop-blur-xs space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SheetTitle className="text-xl font-bold flex items-center gap-2">
                <span>{item.customerName}</span>
                <CallStatusBadge status={item.status} />
              </SheetTitle>
              <SheetDescription className="text-sm font-mono text-foreground/80 mt-1 flex items-center gap-2">
                <span className="font-semibold text-primary">{item.customerPhone}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={handleCopyPhone}
                  title="Copy Phone"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </Button>
              </SheetDescription>
            </div>
            <Badge variant="secondary" className="text-xs px-2.5 py-1">
              Attempts: {item.attemptCount}
            </Badge>
          </div>

          {/* Quick Dial Buttons */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              asChild
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-2 shadow-xs"
            >
              <a href={`tel:${item.customerPhone}`}>
                <PhoneCall className="w-4 h-4" />
                Dial Customer
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              className="gap-2 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
            >
              <a href={waUrl} target="_blank" rel="noreferrer" title="Chat on WhatsApp">
                <MessageSquare className="w-4 h-4" />
                WhatsApp
              </a>
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setShowSms(!showSms)}
            >
              <Send className="w-4 h-4" />
              SMS
            </Button>
          </div>

          {/* Collapsible SMS Composer */}
          {showSms && (
            <div className="bg-muted/40 border border-primary/20 rounded-lg p-3 space-y-2 mt-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Quick SMS Follow-up</Label>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-[11px] h-6 px-1.5"
                    onClick={() =>
                      setSmsMessage(
                        `আসসালামু আলাইকুম ${item.customerName}, আমরা আপনার সাথে ফোনে যোগাযোগ করার চেষ্টা করেছিলাম। সুবিধা অনুযায়ী আমাদের কলব্যাক করতে পারেন। ধন্যবাদ!`
                      )
                    }
                  >
                    Missed Template
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-[11px] h-6 px-1.5"
                    onClick={() =>
                      setSmsMessage(
                        `আসসালামু আলাইকুম ${item.customerName}, আপনার অনুরোধ অনুযায়ী আমরা পরে আবার যোগাযোগ করব। যেকোনো প্রয়োজনে ইনবক্স করতে পারেন।`
                      )
                    }
                  >
                    Later Template
                  </Button>
                </div>
              </div>
              <Textarea
                placeholder="Type SMS message..."
                value={smsMessage}
                onChange={(e) => setSmsMessage(e.target.value)}
                rows={2}
                className="text-xs resize-none bg-background"
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setShowSms(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1.5 bg-primary"
                  onClick={handleSendSms}
                  disabled={isSendingSms || !smsMessage.trim()}
                >
                  <Send className="w-3 h-3" />
                  {isSendingSms ? "Sending..." : "Send SMS"}
                </Button>
              </div>
            </div>
          )}
        </SheetHeader>

        {/* Drawer Body with Tabs */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <Tabs defaultValue="log" className="w-full">
            <TabsList className="grid grid-cols-3 w-full mb-4">
              <TabsTrigger value="log" className="text-xs">
                Log Call Outcome
              </TabsTrigger>
              <TabsTrigger value="timeline" className="text-xs flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" />
                History ({filteredLogs.length})
              </TabsTrigger>
              <TabsTrigger value="profile" className="text-xs flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                Profile & Deliveries
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: LOG CALL OUTCOME */}
            <TabsContent value="log" className="space-y-5 m-0">
              <form onSubmit={handleSaveCallAttempt} className="space-y-5">
                {/* Status Selection */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Select Call Outcome
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {OUTCOME_OPTIONS.map((opt) => {
                      const isSelected = outcome === opt.value;
                      return (
                        <div
                          key={opt.value}
                          onClick={() => setOutcome(opt.value)}
                          className={`cursor-pointer border rounded-lg p-2.5 transition-all text-left flex flex-col justify-between ${
                            isSelected
                              ? "border-primary bg-primary/10 ring-1 ring-primary font-medium"
                              : "border-border/80 bg-card hover:bg-muted/40 " + opt.color
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-foreground">
                              {opt.label}
                            </span>
                            {isSelected && (
                              <div className="w-2 h-2 rounded-full bg-primary" />
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground leading-tight">
                            {opt.desc}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Scheduled Callback Input */}
                {outcome === "call_later" && (
                  <div className="space-y-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        Scheduled Callback Date & Time *
                      </Label>
                    </div>

                    {/* Presets */}
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs border-blue-300 dark:border-blue-700 hover:bg-blue-500/10"
                        onClick={() => handleApplyPresetCallback(2)}
                      >
                        +2 Hours
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs border-blue-300 dark:border-blue-700 hover:bg-blue-500/10"
                        onClick={() => handleApplyPresetCallback(4)}
                      >
                        +4 Hours
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs border-blue-300 dark:border-blue-700 hover:bg-blue-500/10"
                        onClick={() => handleApplyPresetCallback(0, 10)}
                      >
                        Tomorrow 10 AM
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs border-blue-300 dark:border-blue-700 hover:bg-blue-500/10"
                        onClick={() => handleApplyPresetCallback(0, 16)}
                      >
                        Tomorrow 4 PM
                      </Button>
                    </div>

                    <Input
                      type="datetime-local"
                      value={callbackAt}
                      onChange={(e) => setCallbackAt(e.target.value)}
                      required
                      className="bg-background text-sm"
                    />
                  </div>
                )}

                {/* Notes Input */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Call Notes & Customer Remarks
                  </Label>
                  <Textarea
                    placeholder="E.g., Customer is at office right now, requested callback after 5 PM. Interested in Khejur Gur 5kg pack."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="text-sm bg-card resize-none"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <Button
                    type="submit"
                    className="flex-1 bg-primary font-semibold"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Saving Log..." : "Save Call Outcome"}
                  </Button>
                </div>
              </form>

              {/* Direct Actions Card */}
              <div className="pt-4 border-t space-y-3">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Quick Actions for this Customer
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    asChild
                    variant="outline"
                    className="w-full justify-start gap-2 h-9 text-xs"
                  >
                    <a
                      href={`/admin/orders?new=true&phone=${encodeURIComponent(item.customerPhone)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ShoppingBag className="w-3.5 h-3.5 text-primary" />
                      Create Order
                      <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
                    </a>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="w-full justify-start gap-2 h-9 text-xs"
                  >
                    <a
                      href={`/admin/orders?search=${encodeURIComponent(item.customerPhone)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <History className="w-3.5 h-3.5 text-blue-500" />
                      View Past Orders
                      <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
                    </a>
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: CALL ATTEMPT HISTORY */}
            <TabsContent value="timeline" className="m-0 space-y-4">
              <CallTimeline logs={filteredLogs} />
            </TabsContent>

            {/* TAB 3: CUSTOMER CRM PROFILE, DELIVERIES & ORDERS */}
            <TabsContent value="profile" className="m-0 space-y-4">
              {/* Card 1: Identity & Lifetime Value */}
              <div className="bg-card border rounded-lg p-4 space-y-3.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                      {item.customerName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <span className="font-bold text-sm text-foreground block">
                        {item.customerName}
                      </span>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {item.customerPhone}
                      </span>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-medium bg-muted/40">
                    Customer
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-muted/30 p-2.5 rounded border border-border/40">
                    <span className="text-[10px] text-muted-foreground block uppercase tracking-wider font-semibold">
                      Total Orders
                    </span>
                    <span className="text-base font-bold text-foreground">
                      {item.customerTotalOrders}
                    </span>
                  </div>
                  <div className="bg-muted/30 p-2.5 rounded border border-border/40">
                    <span className="text-[10px] text-muted-foreground block uppercase tracking-wider font-semibold">
                      Total Spend (LTV)
                    </span>
                    <span className="text-base font-bold text-foreground">
                      ৳ {item.customerTotalSpent.toLocaleString("en-BD")}
                    </span>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-foreground">{item.customerEmail || "No email on file"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span>
                      Last Order:{" "}
                      <strong className="text-foreground">
                        {item.customerLastOrderAt
                          ? format(new Date(item.customerLastOrderAt), "dd MMM yyyy")
                          : "Never ordered"}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 2: Delivery Track Record & Courier Performance */}
              <div className="bg-card border rounded-lg p-3.5 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    Delivery Track Record & History
                  </span>
                  {deliverySummary && deliverySummary.totalOrders > 0 && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] px-1.5 py-0 font-semibold",
                        deliverySummary.successRate >= 80
                          ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10"
                          : deliverySummary.successRate >= 50
                          ? "border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/10"
                          : "border-rose-500/40 text-rose-700 dark:text-rose-400 bg-rose-500/10"
                      )}
                    >
                      {deliverySummary.successRate}% Store Delivery Rate
                    </Badge>
                  )}
                </div>

                {/* Store Fulfillment Summary Cards */}
                {deliverySummary && deliverySummary.totalOrders > 0 && (
                  <div className="grid grid-cols-4 gap-1.5 text-center">
                    <div className="bg-muted/30 p-2 rounded border border-border/40">
                      <span className="text-[9px] text-muted-foreground block uppercase font-medium">
                        Orders
                      </span>
                      <span className="text-sm font-bold text-foreground">
                        {deliverySummary.totalOrders}
                      </span>
                    </div>
                    <div className="bg-emerald-500/10 p-2 rounded border border-emerald-500/20">
                      <span className="text-[9px] text-emerald-700 dark:text-emerald-400 block uppercase font-medium">
                        Delivered
                      </span>
                      <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                        {deliverySummary.deliveredCount}
                      </span>
                    </div>
                    <div className="bg-blue-500/10 p-2 rounded border border-blue-500/20">
                      <span className="text-[9px] text-blue-700 dark:text-blue-400 block uppercase font-medium">
                        Active
                      </span>
                      <span className="text-sm font-bold text-blue-700 dark:text-blue-400">
                        {deliverySummary.shippedCount + deliverySummary.pendingCount}
                      </span>
                    </div>
                    <div className="bg-rose-500/10 p-2 rounded border border-rose-500/20">
                      <span className="text-[9px] text-rose-700 dark:text-rose-400 block uppercase font-medium">
                        Returned
                      </span>
                      <span className="text-sm font-bold text-rose-700 dark:text-rose-400">
                        {deliverySummary.cancelledCount + deliverySummary.returnedCount}
                      </span>
                    </div>
                  </div>
                )}

                {/* Steadfast Courier Nationwide Track Record Badge */}
                <div className="pt-1">
                  <SteadfastDeliveryRecordBadge
                    phone={item.customerPhone}
                    variant="expanded"
                    autoFetch={true}
                  />
                </div>
              </div>

              {/* Card 3: Saved Delivery Address */}
              <div className="bg-card border rounded-lg p-3.5 space-y-2.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-primary" />
                    Delivery Address
                  </span>
                  {primaryAddress && (
                    <div className="flex items-center gap-1.5">
                      {primaryAddress.address.isHomeDelivery !== undefined && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                          {primaryAddress.address.isHomeDelivery ? (
                            <span className="flex items-center gap-1">
                              <Home className="w-2.5 h-2.5" />
                              Home Delivery
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <Building className="w-2.5 h-2.5" />
                              Point Delivery
                            </span>
                          )}
                        </Badge>
                      )}
                      <Badge variant={primaryAddress.badgeVariant} className="text-[10px] px-1.5 py-0">
                        {primaryAddress.source}
                      </Badge>
                    </div>
                  )}
                </div>

                {primaryAddress ? (
                  <div className="p-3 rounded-md bg-muted/30 border border-border/40 text-xs space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5 min-w-0">
                        {(primaryAddress.address.recipientName || primaryAddress.address.phone) && (
                          <p className="font-semibold text-foreground text-xs">
                            {primaryAddress.address.recipientName || item.customerName}
                            {primaryAddress.address.phone ? ` · ${primaryAddress.address.phone}` : ""}
                          </p>
                        )}
                        {primaryAddress.address.addressLine && (
                          <p className="text-foreground/90 font-medium leading-relaxed">
                            {primaryAddress.address.addressLine}
                          </p>
                        )}
                        {primaryAddress.address.areaLine && (
                          <p className="text-muted-foreground text-[11px]">
                            {primaryAddress.address.areaLine}
                          </p>
                        )}
                        {primaryAddress.address.landmark && (
                          <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                            Landmark: {primaryAddress.address.landmark}
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0"
                        onClick={() => handleCopyAddress(primaryAddress.address.fullAddress)}
                        title="Copy formatted address"
                      >
                        {copiedAddress ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-md bg-muted/20 border border-dashed border-border text-xs text-muted-foreground italic text-center">
                    No delivery address on record. Customer has not placed an order with shipping details.
                  </div>
                )}

                {/* Other distinct delivery addresses from past orders */}
                {orderAddresses.length > 1 && (
                  <div className="pt-2 border-t border-border/40 text-xs">
                    <details className="cursor-pointer group">
                      <summary className="text-[11px] text-muted-foreground hover:text-foreground font-medium flex items-center justify-between list-none">
                        <span>Alternate past delivery addresses ({orderAddresses.length - 1})</span>
                        <span className="text-[10px] text-primary group-open:rotate-180 transition-transform">
                          ▼
                        </span>
                      </summary>
                      <div className="mt-2 space-y-1.5 pl-2 border-l-2 border-border/60">
                        {orderAddresses.slice(1).map((oa, idx) => (
                          <div key={idx} className="p-2 rounded bg-muted/20 text-[11px] space-y-0.5">
                            <div className="flex justify-between text-muted-foreground">
                              <span className="font-mono text-[10px]">Order #{oa.orderNumber}</span>
                              <span>{format(new Date(oa.date), "dd MMM yyyy")}</span>
                            </div>
                            <p className="text-foreground/90">{oa.parsed.fullAddress}</p>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                )}
              </div>

              {/* Card 4: Customer CRM Notes (if available) */}
              {item.customerNotes && (
                <div className="bg-card border rounded-lg p-3.5 space-y-1.5 shadow-2xs">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Customer Profile Notes
                  </span>
                  <p className="text-xs text-foreground/80 bg-muted/30 p-2.5 rounded border border-border/40 whitespace-pre-wrap">
                    {item.customerNotes}
                  </p>
                </div>
              )}

              {/* Card 5: Detailed Order History */}
              <div className="space-y-2.5 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5 text-primary" />
                    Past Orders ({customerOrders.length})
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Click order to view items & tracking
                  </span>
                </div>

                {isLoadingOrders ? (
                  <div className="space-y-2 pt-1">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="border rounded-lg p-3 space-y-2 bg-card">
                        <div className="flex justify-between">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-4 w-16" />
                        </div>
                        <Skeleton className="h-3 w-40" />
                      </div>
                    ))}
                  </div>
                ) : customerOrders.length === 0 ? (
                  <div className="p-6 text-center border border-dashed rounded-lg bg-muted/10">
                    <Package className="w-6 h-6 mx-auto text-muted-foreground mb-1.5 opacity-50" />
                    <p className="text-xs font-medium text-muted-foreground">No past orders found</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {customerOrders.map((order, idx) => (
                      <CustomerOrderCard
                        key={order.id}
                        order={order}
                        defaultOpen={idx === 0}
                      />
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
