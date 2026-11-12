"use client";

import * as React from "react";
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogFooter as DialogFooter,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  MessageSquare,
  Send,
  History,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Phone,
  RefreshCw,
} from "lucide-react";
import { Order } from "@/types/order";
import {
  getSmsConfigAction,
  getOrderSmsHistoryAction,
  sendManualOrderSmsAction,
  SmsLogItem,
} from "@/actions/sms";
import { renderSmsTemplate, normalizeBdPhoneNumber } from "@/lib/sms/smsbangladesh";

interface OrderSmsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order | null;
  onSmsSentSuccess?: () => void;
}

export function OrderSmsDialog({
  open,
  onOpenChange,
  order,
  onSmsSentSuccess,
}: OrderSmsDialogProps) {
  const [selectedEvent, setSelectedEvent] = React.useState<
    "placed" | "confirmed" | "shipped" | "delivered" | "manual"
  >("confirmed");
  const [recipientPhone, setRecipientPhone] = React.useState("");
  const [messageText, setMessageText] = React.useState("");
  const [sending, setSending] = React.useState(false);

  // Templates from database / server
  const [templates, setTemplates] = React.useState<Record<string, string>>({});
  const [loadingTemplates, setLoadingTemplates] = React.useState(false);

  // Past logs
  const [logs, setLogs] = React.useState<SmsLogItem[]>([]);
  const [loadingLogs, setLoadingLogs] = React.useState(false);

  // Character count & segments
  const charCount = messageText.length;
  const smsSegments = charCount === 0 ? 0 : charCount <= 70 ? 1 : Math.ceil(charCount / 67);

  // Resolve active recipient phone when order changes
  React.useEffect(() => {
    if (order) {
      const bestPhone =
        order.shipping_phone ||
        order.phone ||
        order.address?.phone ||
        order.alternative_phone ||
        "";
      setRecipientPhone(bestPhone);
    }
  }, [order]);

  // Load templates on dialog open
  React.useEffect(() => {
    if (open) {
      setLoadingTemplates(true);
      getSmsConfigAction()
        .then((res) => {
          if (res.success && res.config?.templates) {
            setTemplates(res.config.templates);
          }
        })
        .finally(() => setLoadingTemplates(false));
    }
  }, [open]);

  // Load SMS history on dialog open
  const loadLogs = React.useCallback(async () => {
    if (!order) return;
    setLoadingLogs(true);
    try {
      const res = await getOrderSmsHistoryAction(order.order_number || order.id);
      if (res.success) {
        setLogs(res.logs);
      }
    } catch {
      // Ignore
    } finally {
      setLoadingLogs(false);
    }
  }, [order]);

  React.useEffect(() => {
    if (open && order) {
      loadLogs();
    }
  }, [open, order, loadLogs]);

  // Render message when template or event selection changes
  React.useEffect(() => {
    if (!order) return;

    if (selectedEvent === "manual") {
      // Keep existing manual text if user edited, or blank default
      return;
    }

    const rawTemplate =
      templates[selectedEvent] ||
      (selectedEvent === "placed"
        ? "প্রিয় {customer_name}, আপনার অর্ডার #{order_number} সফলভাবে গৃহীত হয়েছে। মোট বিল: ৳{amount}। খুব শীঘ্রই আমাদের প্রতিনিধি যোগাযোগ করবেন। ধন্যবাদ!"
        : selectedEvent === "confirmed"
        ? "প্রিয় {customer_name}, আপনার অর্ডার #{order_number} কনফার্ম করা হয়েছে। মোট বিল: ৳{amount}। আপনার পার্সেলটি প্যাকিং সম্পন্ন করে দ্রুত পাঠিয়ে দেওয়া হবে। ধন্যবাদ!"
        : selectedEvent === "shipped"
        ? "প্রিয় {customer_name}, আপনার অর্ডার #{order_number} {courier_name} কুরিয়ারের মাধ্যমে পাঠানো হয়েছে। ট্র্যাকিং কোড: {tracking_code}। পার্সেল ট্র্যাক করুন: {tracking_url}"
        : "প্রিয় {customer_name}, আপনার অর্ডার #{order_number} সফলভাবে ডেলিভারি সম্পন্ন হয়েছে। খেজুরের খাঁটি গুড়-এর সাথে থাকার জন্য ধন্যবাদ!");

    const rendered = renderSmsTemplate(rawTemplate, {
      customer_name: order.customer || order.address?.recipient_name || "সম্মানিত গ্রাহক",
      order_number: order.order_number || order.id,
      order_id: order.order_number || order.id,
      amount: Math.round(Number(order.grand_total) || 0),
      courier_name: order.courier_name || "Steadfast Courier",
      tracking_code: order.courier_tracking_code || "N/A",
      tracking_url: order.courier_tracking_url || "https://steadfast.com.bd/t/" + (order.courier_tracking_code || ""),
      support_phone: "+880 1700-000001",
      store_name: "খেজুরের খাঁটি গুড়",
    });

    setMessageText(rendered);
  }, [selectedEvent, templates, order]);

  const handleSendSms = async () => {
    if (!order) return;

    const cleanPhone = recipientPhone.trim();
    if (!cleanPhone) {
      toast.error("Please enter a customer mobile number.");
      return;
    }

    if (!normalizeBdPhoneNumber(cleanPhone)) {
      toast.error("Please enter a valid 11-digit Bangladeshi mobile number.");
      return;
    }

    if (!messageText.trim()) {
      toast.error("SMS message content cannot be empty.");
      return;
    }

    setSending(true);
    try {
      const res = await sendManualOrderSmsAction({
        orderId: order.id,
        orderNumber: order.order_number || order.id,
        statusEvent: selectedEvent,
        customerPhone: cleanPhone,
        customerName: order.customer || order.address?.recipient_name,
        grandTotal: order.grand_total,
        courierName: order.courier_name,
        trackingCode: order.courier_tracking_code,
        trackingUrl: order.courier_tracking_url,
        customMessage: messageText,
      });

      if (res.success) {
        toast.success(`SMS sent successfully to ${cleanPhone}!`);
        await loadLogs();
        if (onSmsSentSuccess) {
          onSmsSentSuccess();
        }
      } else {
        toast.error(`Failed to send SMS: ${res.error || res.skipReason || "Gateway rejected"}`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to dispatch SMS.");
    } finally {
      setSending(false);
    }
  };

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 flex flex-col">
        <DialogHeader className="shrink-0 border-b pb-3">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <MessageSquare className="h-5 w-5 text-sky-600" />
              Send SMS to Customer
            </DialogTitle>
            <Badge variant="outline" className="font-mono text-xs bg-muted">
              Order #{order.order_number || order.id}
            </Badge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground pt-1">
            Dispatch direct transactional SMS to {order.customer || "Customer"} via SMSBangladesh gateway.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3 flex-1">
          {/* Recipient Phone & Milestone Template Picker */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-sky-600" />
                Customer Mobile Number
              </label>
              <Input
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                placeholder="017XXXXXXXX"
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                Select Milestone Template
              </label>
              <Select
                value={selectedEvent}
                onValueChange={(val: any) => setSelectedEvent(val)}
              >
                <SelectTrigger className="text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="placed">Order Placed (গৃহীত হয়েছে)</SelectItem>
                  <SelectItem value="confirmed">Order Confirmed (কনফার্ম করা হয়েছে)</SelectItem>
                  <SelectItem value="shipped">Order Shipped (পাঠিয়ে দেওয়া হয়েছে)</SelectItem>
                  <SelectItem value="delivered">Order Delivered (ডেলিভারি সম্পন্ন)</SelectItem>
                  <SelectItem value="manual">Custom Text Message (নিজের মতো লিখুন)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* SMS Message Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold">Message Text (বাংলা / English)</label>
              <span className="text-[11px] font-mono text-muted-foreground">
                {charCount} chars • {smsSegments} {smsSegments === 1 ? "SMS" : "SMS segments"} (70
                chars/SMS)
              </span>
            </div>
            <Textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              rows={4}
              className="text-xs font-sans leading-relaxed"
              placeholder="Write customer message here..."
            />
          </div>

          {/* Past SMS History for this Order */}
          <div className="border rounded-lg p-3 bg-muted/20 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold border-b pb-2">
              <div className="flex items-center gap-1.5 text-foreground">
                <History className="h-3.5 w-3.5 text-muted-foreground" />
                Past SMS History ({logs.length})
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={loadLogs}
                disabled={loadingLogs}
                className="h-6 px-2 text-[10px] gap-1"
              >
                <RefreshCw className={`h-3 w-3 ${loadingLogs ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>

            {loadingLogs ? (
              <div className="py-3 text-center text-xs text-muted-foreground">Loading SMS history...</div>
            ) : logs.length === 0 ? (
              <div className="py-2 text-center text-xs text-muted-foreground">
                No previous SMS sent for this order yet.
              </div>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-2 border rounded bg-card text-xs space-y-1 flex flex-col"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {log.is_success ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-rose-600" />
                        )}
                        <span className="font-semibold uppercase tracking-wider text-[10px]">
                          {log.status_event}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          to {log.recipient_phone}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
                        <Clock className="h-2.5 w-2.5" />
                        {new Date(log.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        {new Date(log.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <p className="text-[11px] text-foreground font-sans line-clamp-2">
                      {log.message_text}
                    </p>
                    {log.error_message && (
                      <p className="text-[10px] text-destructive font-mono">{log.error_message}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t pt-3 flex items-center justify-between sm:justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={sending}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSendSms}
            disabled={sending || loadingTemplates}
            className="text-xs bg-sky-600 hover:bg-sky-700 text-white gap-1.5 shadow-sm"
          >
            <Send className="h-3.5 w-3.5" />
            {sending ? "Sending SMS..." : "Send SMS Now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
