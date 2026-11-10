"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Phone,
  MessageCircle,
  Store,
  User,
  MapPin,
  Plus,
  Trash2,
  Check,
  Search,
  Loader2,
  Tag,
  CreditCard,
  Truck,
  ArrowLeft,
  Building,
  Link2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  searchCustomerByPhoneAction,
  searchInquiryByRefCodeAction,
  createManualOrderAction,
  CustomerLookupResult,
  InquiryLookupResult,
} from "@/actions/new-order-ops";
import { formatBDT, normalizeBDPhone } from "@/lib/admin-format";
import { extractRefToken } from "@/lib/utils";

interface CatalogVariant {
  id: string;
  title: string;
  sku: string;
  price: number;
  uom: string;
  productName: string;
}

interface ShippingMethod {
  id: string;
  name: string;
  baseRate?: number;
}

interface DistrictOption {
  id: number;
  name: string;
  nameBn?: string | null;
}

interface NewOrderViewProps {
  catalogVariants: CatalogVariant[];
  shippingMethods: ShippingMethod[];
  districts: DistrictOption[];
}

interface OrderItemLine {
  variantId: string;
  productName: string;
  variantTitle: string;
  sku: string;
  price: number;
  uom: string;
  quantity: number;
  priceOverride?: string;
}

export function NewOrderView({
  catalogVariants,
  shippingMethods,
  districts,
}: NewOrderViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Channel
  const [channel, setChannel] = useState<"phone" | "whatsapp" | "facebook" | "walk_in" | "admin">("phone");

  // Customer & lookup
  const [phoneInput, setPhoneInput] = useState("");
  const [isSearchingPhone, setIsSearchingPhone] = useState(false);
  const [foundCustomer, setFoundCustomer] = useState<CustomerLookupResult | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");

  // Reference Code & Web Touchpoint
  const [refCodeInput, setRefCodeInput] = useState("");
  const [isSearchingRefCode, setIsSearchingRefCode] = useState(false);
  const [matchedInquiry, setMatchedInquiry] = useState<InquiryLookupResult | null>(null);

  // Handle ref code lookup
  const handleRefCodeLookup = async () => {
    const raw = extractRefToken(refCodeInput);
    if (!raw) return;
    setIsSearchingRefCode(true);
    try {
      const res = await searchInquiryByRefCodeAction(raw);
      if (res.ok && res.data) {
        setMatchedInquiry(res.data);
        setRefCodeInput(`#${res.data.refCode}`);
        toast.success(`Matched web session: #${res.data.refCode}`);
        if (res.data.channel === "whatsapp" && channel !== "whatsapp") {
          setChannel("whatsapp");
        } else if (res.data.channel === "phone" && channel !== "phone") {
          setChannel("phone");
        }
        if (res.data.customerPhone && !phoneInput) {
          setPhoneInput(res.data.customerPhone);
          const cRes = await searchCustomerByPhoneAction(res.data.customerPhone);
          if (cRes.ok && cRes.data) {
            setFoundCustomer(cRes.data);
            setCustomerName(cRes.data.name);
            if (cRes.data.email) setCustomerEmail(cRes.data.email);
            setRecipientName(cRes.data.name);
            setRecipientPhone(cRes.data.phone);
            if (cRes.data.address) {
              if (cRes.data.address.districtId) setDistrictId(cRes.data.address.districtId);
              if (cRes.data.address.upazila) setUpazila(cRes.data.address.upazila);
              if (cRes.data.address.addressLine) setAddressLine(cRes.data.address.addressLine);
            }
          }
        }
      } else {
        setMatchedInquiry(null);
        toast.info("No active web session found for this reference code.");
      }
    } finally {
      setIsSearchingRefCode(false);
    }
  };

  // Shipping
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [districtId, setDistrictId] = useState<number | null>(districts[0]?.id || 1);
  const [upazila, setUpazila] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [shippingMethodId, setShippingMethodId] = useState<string>(shippingMethods[0]?.id || "");

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "cash" | "credit_terms" | "bank_transfer" | "bkash">("cod");

  // Order Items
  const [lines, setLines] = useState<OrderItemLine[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState<string>(catalogVariants[0]?.id || "");
  const [addQty, setAddQty] = useState<string>("1");
  const [customerNote, setCustomerNote] = useState("");

  // Handle phone lookup
  const handlePhoneLookup = async () => {
    if (!phoneInput.trim()) return;
    setIsSearchingPhone(true);
    try {
      const res = await searchCustomerByPhoneAction(phoneInput);
      if (res.ok && res.data) {
        setFoundCustomer(res.data);
        setCustomerName(res.data.name);
        if (res.data.email) setCustomerEmail(res.data.email);
        setRecipientName(res.data.name);
        setRecipientPhone(res.data.phone);
        if (res.data.address) {
          if (res.data.address.districtId) setDistrictId(res.data.address.districtId);
          if (res.data.address.upazila) setUpazila(res.data.address.upazila);
          if (res.data.address.addressLine) setAddressLine(res.data.address.addressLine);
        }
        toast.success(`Found existing customer: ${res.data.name}`);
      } else {
        setFoundCustomer(null);
        toast.info("No prior customer found with this phone. Creating as new customer.");
      }
    } finally {
      setIsSearchingPhone(false);
    }
  };

  // Add line item
  const handleAddLine = () => {
    const v = catalogVariants.find((v) => v.id === selectedVariantId);
    if (!v) return;

    const qty = Number(addQty);
    if (!qty || qty <= 0) {
      toast.error("Please enter a valid quantity.");
      return;
    }

    const existingIndex = lines.findIndex((l) => l.variantId === v.id);
    if (existingIndex >= 0) {
      const copy = [...lines];
      copy[existingIndex].quantity += qty;
      setLines(copy);
    } else {
      setLines((prev) => [
        ...prev,
        {
          variantId: v.id,
          productName: v.productName,
          variantTitle: v.title,
          sku: v.sku,
          price: v.price,
          uom: v.uom,
          quantity: qty,
        },
      ]);
    }
    setAddQty("1");
  };

  const handleRemoveLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateLine = (idx: number, updates: Partial<OrderItemLine>) => {
    setLines((prev) =>
      prev.map((line, i) => (i === idx ? { ...line, ...updates } : line))
    );
  };

  // Calculations
  const subtotal = lines.reduce((sum, line) => {
    const unitPrice =
      line.priceOverride && Number(line.priceOverride) > 0
        ? Number(line.priceOverride)
        : line.price;
    return sum + unitPrice * line.quantity;
  }, 0);

  // Submit Order
  const handleSubmitOrder = () => {
    if (lines.length === 0) {
      toast.error("Please add at least one product item.");
      return;
    }
    if (!phoneInput.trim()) {
      toast.error("Customer phone number is required.");
      return;
    }
    if (!customerName.trim()) {
      toast.error("Customer name is required.");
      return;
    }
    if (!districtId) {
      toast.error("Delivery district is required.");
      return;
    }
    if (!addressLine.trim()) {
      toast.error("Delivery address line is required.");
      return;
    }

    startTransition(async () => {
      const res = await createManualOrderAction({
        channel,
        customerName,
        customerPhone: phoneInput,
        customerEmail: customerEmail.trim() || null,
        userId: foundCustomer?.id || null,
        businessId: foundCustomer?.businessId || null,
        refCode: matchedInquiry?.refCode || extractRefToken(refCodeInput) || undefined,
        shippingAddress: {
          recipientName: recipientName.trim() || customerName.trim(),
          phone: recipientPhone.trim() || phoneInput.trim(),
          districtId,
          upazila: upazila.trim() || null,
          addressLine: addressLine.trim(),
        },
        shippingMethodId,
        paymentMethod: paymentMethod as any,
        customerNote: customerNote.trim() || null,
        items: lines.map((l) => ({
          variantId: l.variantId,
          quantity: l.quantity,
          priceOverride: l.priceOverride ? Number(l.priceOverride) : null,
        })),
      });

      if (!res.ok) {
        toast.error(res.message || "Failed to create order");
        return;
      }

      toast.success(`Order created successfully! (${res.orderNumber || ""})`);
      if (res.orderId) {
        router.push(`/admin/orders/${res.orderId}`);
      } else {
        router.push("/admin/orders");
      }
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="h-8 gap-1 text-xs"
          >
            <ArrowLeft className="size-3.5" />
            Back
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              New Customer Order / নতুন অর্ডার গ্রহণ
            </h1>
            <p className="text-xs text-muted-foreground">
              Record manual intake for Phone, WhatsApp, Facebook, or Walk-in customers.
            </p>
          </div>
        </div>

        {/* Channel Selector */}
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border">
          <button
            type="button"
            onClick={() => setChannel("phone")}
            className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-md transition-colors ${
              channel === "phone" ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground"
            }`}
          >
            <Phone className="size-3" />
            Phone
          </button>
          <button
            type="button"
            onClick={() => setChannel("whatsapp")}
            className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-md transition-colors ${
              channel === "whatsapp" ? "bg-emerald-600 text-white font-medium" : "text-muted-foreground"
            }`}
          >
            <MessageCircle className="size-3" />
            WhatsApp
          </button>
          <button
            type="button"
            onClick={() => setChannel("walk_in")}
            className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-md transition-colors ${
              channel === "walk_in" ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground"
            }`}
          >
            <Store className="size-3" />
            Walk-in
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Customer & Delivery */}
        <div className="lg:col-span-2 space-y-5">
          {/* Customer Lookup Card */}
          <Card className="rounded-xl border shadow-xs">
            <CardHeader className="py-3 px-4 border-b">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <User className="size-4 text-primary" />
                  Customer Information / ক্রেতার তথ্য
                </span>
                {foundCustomer && (
                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-300 text-[10px]">
                    Existing Customer
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4 text-xs">
              {/* Optional Web / WhatsApp Inquiry Reference Code */}
              <div className="p-3 bg-muted/40 rounded-lg border border-dashed border-border/80 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium flex items-center gap-1.5 text-foreground">
                    <Link2 className="size-3.5 text-primary" />
                    Web / WhatsApp Reference ID (ওয়েব সেশন রেফারেন্স)
                  </Label>
                  {matchedInquiry ? (
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-300 text-[10px] gap-1 font-mono">
                      <Check className="size-2.5" />
                      Linked: #{matchedInquiry.refCode}
                    </Badge>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">
                      Links Meta ad cookies & web session
                    </span>
                  )}
                </div>

                <div className="flex gap-1.5">
                  <Input
                    placeholder="e.g. #W-7391 or paste WhatsApp message"
                    value={refCodeInput}
                    onChange={(e) => setRefCodeInput(e.target.value)}
                    className="h-8 text-xs font-mono"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleRefCodeLookup();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant={matchedInquiry ? "secondary" : "outline"}
                    onClick={handleRefCodeLookup}
                    disabled={isSearchingRefCode || !refCodeInput.trim()}
                    className="h-8 px-2.5 text-xs gap-1 shrink-0"
                  >
                    {isSearchingRefCode ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Link2 className="size-3" />
                    )}
                    {matchedInquiry ? "Linked" : "Link Ref"}
                  </Button>
                  {matchedInquiry && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setMatchedInquiry(null);
                        setRefCodeInput("");
                      }}
                      className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
                      title="Clear linked session"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  )}
                </div>

                {matchedInquiry && (
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-500/5 p-2 rounded border border-emerald-500/20 flex flex-wrap items-center justify-between gap-2">
                    <span>
                      ✓ Origin: <strong>{matchedInquiry.channel.toUpperCase()}</strong> | 
                      Meta Ad Cookies: <strong>{matchedInquiry.hasMetaTracking ? "Available (_fbp/_fbc attached)" : "Direct Web Traffic"}</strong>
                    </span>
                    <span className="text-muted-foreground font-mono text-[10px]">
                      {new Date(matchedInquiry.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Phone Number / ফোন নম্বর *</Label>
                  <div className="flex gap-1.5">
                    <Input
                      placeholder="01712345678"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      className="h-8 text-xs font-mono"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handlePhoneLookup();
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handlePhoneLookup}
                      disabled={isSearchingPhone || !phoneInput.trim()}
                      className="h-8 px-2 text-xs gap-1"
                    >
                      {isSearchingPhone ? <Loader2 className="size-3 animate-spin" /> : <Search className="size-3" />}
                      Find
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Customer Name / নাম *</Label>
                  <Input
                    placeholder="e.g. Rafiqul Islam"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Email / ইমেইল (Optional)</Label>
                  <Input
                    type="email"
                    placeholder="rafiq@gmail.com"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>

                {foundCustomer?.businessName && (
                  <div className="space-y-1">
                    <Label className="text-xs">B2B Account</Label>
                    <div className="h-8 rounded-md bg-muted/40 border px-2.5 flex items-center gap-1.5 text-xs font-medium">
                      <Building className="size-3.5 text-primary" />
                      {foundCustomer.businessName}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Shipping Address Card */}
          <Card className="rounded-xl border shadow-xs">
            <CardHeader className="py-3 px-4 border-b">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <MapPin className="size-4 text-primary" />
                Delivery Address / ডেলিভারি ঠিকানা
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">District / জেলা *</Label>
                  <Select
                    value={districtId ? String(districtId) : ""}
                    onValueChange={(val) => setDistrictId(Number(val))}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select District" />
                    </SelectTrigger>
                    <SelectContent>
                      {districts.map((d) => (
                        <SelectItem key={d.id} value={String(d.id)} className="text-xs">
                          {d.name} {d.nameBn && `(${d.nameBn})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Upazila / Police Station</Label>
                  <Input
                    placeholder="e.g. Mirpur / Dhanmondi"
                    value={upazila}
                    onChange={(e) => setUpazila(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Full Address / বিস্তারিত ঠিকানা *</Label>
                <Textarea
                  placeholder="House 12, Road 4, Sector 7..."
                  value={addressLine}
                  onChange={(e) => setAddressLine(e.target.value)}
                  rows={2}
                  className="text-xs resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <Label className="text-xs">Shipping Method / শিপিং মাধ্যম</Label>
                  <Select
                    value={shippingMethodId}
                    onValueChange={(val) => setShippingMethodId(val ?? "")}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {shippingMethods.map((m) => (
                        <SelectItem key={m.id} value={m.id} className="text-xs">
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Payment Method / মূল্য পরিশোধের মাধ্যম</Label>
                  <Select
                    value={paymentMethod}
                    onValueChange={(val) => setPaymentMethod(val as any)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cod" className="text-xs">Cash on Delivery (COD)</SelectItem>
                      <SelectItem value="cash" className="text-xs">Cash (Walk-in)</SelectItem>
                      <SelectItem value="bkash" className="text-xs">bKash (MFS)</SelectItem>
                      <SelectItem value="bank_transfer" className="text-xs">Bank Transfer</SelectItem>
                      <SelectItem value="credit_terms" className="text-xs">B2B Credit Terms</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Product Items Picker */}
          <Card className="rounded-xl border shadow-xs">
            <CardHeader className="py-3 px-4 border-b">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span>Order Line Items / পণ্যের তালিকা</span>
                <span className="text-xs text-muted-foreground font-normal">
                  {lines.length} items added
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4 text-xs">
              {/* Item Adder Bar */}
              <div className="flex flex-col sm:flex-row items-end gap-2 p-3 bg-muted/30 rounded-lg border">
                <div className="flex-1 space-y-1 w-full">
                  <Label className="text-[11px] text-muted-foreground">Select Product Variant</Label>
                  <Select
                    value={selectedVariantId}
                    onValueChange={(val) => setSelectedVariantId(val ?? "")}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {catalogVariants.map((v) => (
                        <SelectItem key={v.id} value={v.id} className="text-xs">
                          {v.productName} - {v.title} ({formatBDT(v.price)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-24 space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Quantity</Label>
                  <Input
                    type="number"
                    min="1"
                    value={addQty}
                    onChange={(e) => setAddQty(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddLine}
                  className="h-8 text-xs gap-1"
                >
                  <Plus className="size-3.5" />
                  Add
                </Button>
              </div>

              {/* Items Table */}
              {lines.length === 0 ? (
                <div className="py-6 text-center text-muted-foreground text-xs italic">
                  No items added yet. Select a product variant above.
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/50 text-[11px] border-b font-medium text-muted-foreground">
                      <tr>
                        <th className="p-2">Item</th>
                        <th className="p-2 text-right">Standard Price</th>
                        <th className="p-2 text-right">Price Override (Negotiated)</th>
                        <th className="p-2 text-center">Qty</th>
                        <th className="p-2 text-right">Total</th>
                        <th className="p-2 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {lines.map((line, idx) => {
                        const effectivePrice =
                          line.priceOverride && Number(line.priceOverride) > 0
                            ? Number(line.priceOverride)
                            : line.price;
                        const lineTotal = effectivePrice * line.quantity;

                        return (
                          <tr key={line.variantId}>
                            <td className="p-2 font-medium">
                              <div>{line.productName}</div>
                              <div className="text-[10px] text-muted-foreground font-mono">
                                {line.variantTitle} · {line.sku}
                              </div>
                            </td>
                            <td className="p-2 text-right font-mono text-muted-foreground">
                              {formatBDT(line.price)}
                            </td>
                            <td className="p-2 text-right">
                              <Input
                                type="number"
                                placeholder={String(line.price)}
                                value={line.priceOverride || ""}
                                onChange={(e) =>
                                  handleUpdateLine(idx, { priceOverride: e.target.value })
                                }
                                className="h-7 w-24 text-right text-xs font-mono ml-auto"
                              />
                            </td>
                            <td className="p-2 text-center">
                              <Input
                                type="number"
                                min="1"
                                value={line.quantity}
                                onChange={(e) =>
                                  handleUpdateLine(idx, {
                                    quantity: Math.max(1, Number(e.target.value) || 1),
                                  })
                                }
                                className="h-7 w-16 text-center text-xs font-mono mx-auto"
                              />
                            </td>
                            <td className="p-2 text-right font-mono font-bold">
                              {formatBDT(lineTotal)}
                            </td>
                            <td className="p-2 text-center">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleRemoveLine(idx)}
                                className="size-6 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="size-3" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Order Summary & Place */}
        <div className="space-y-5">
          <Card className="rounded-xl border shadow-xs sticky top-20">
            <CardHeader className="py-3 px-4 border-b">
              <CardTitle className="text-sm font-semibold">Order Summary / মূল্য সংক্ষেপ</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4 text-xs">
              <div className="space-y-2">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal ({lines.length} lines)</span>
                  <span className="font-mono text-foreground">{formatBDT(subtotal)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Shipping Fee</span>
                  <span className="font-mono text-foreground">Calculated at checkout</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-bold text-sm text-foreground">
                  <span>Estimated Total</span>
                  <span className="font-mono text-primary text-base">{formatBDT(subtotal)}</span>
                </div>
              </div>

              <div className="space-y-1 pt-2 border-t">
                <Label className="text-xs">Order Notes / বিশেষ নির্দেশনা</Label>
                <Textarea
                  placeholder="e.g. Call before delivery, morning delivery preferred"
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  rows={2}
                  className="text-xs resize-none"
                />
              </div>

              <Button
                type="button"
                onClick={handleSubmitOrder}
                disabled={isPending || lines.length === 0}
                className="w-full text-xs h-9 gap-1.5 shadow-xs font-semibold"
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                Place Order / অর্ডার সম্পন্ন করুন
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
