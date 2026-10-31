"use client";

import * as React from "react";
import { motion } from "motion/react";
import {
  Save,
  Store,
  Truck,
  Smartphone,
  RefreshCw,
  CreditCard,
  PackageCheck,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
} from "lucide-react";
import { ImageUploader } from "@/components/ui/image-uploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/toast-notification";
import { useQueryClient } from "@tanstack/react-query";
import { getSiteSettingsAction, updateSiteSettingsAction } from "@/actions/settings";
import { SITE_SETTINGS_QUERY_KEY } from "@/hooks/use-site-settings";

export default function SettingsPage() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  // Store Profile State
  const [storeName, setStoreName] = React.useState("Molasses Store");
  const [storeNameBn, setStoreNameBn] = React.useState("মোলাসেস স্টোর বাংলাদেশ");
  const [currency, setCurrency] = React.useState("BDT");
  const [supportPhone, setSupportPhone] = React.useState("+880 1700-000001");
  const [email, setEmail] = React.useState("billing@molassesstore.com");
  const [address, setAddress] = React.useState(
    "24/B Industrial Area, Tejgaon Industrial Area, Dhaka-1208, Bangladesh"
  );
  const [timezone, setTimezone] = React.useState("Asia/Dhaka");
  const [language, setLanguage] = React.useState("bn_en");
  const [logoUrl, setLogoUrl] = React.useState("");
  const [faviconUrl, setFaviconUrl] = React.useState("");

  // Orders & Stock State
  const [codEnabled, setCodEnabled] = React.useState(true);
  const [guestCheckoutEnabled, setGuestCheckoutEnabled] = React.useState(true);
  const [autoCancelCodHours, setAutoCancelCodHours] = React.useState("48");
  const [allowBackorders, setAllowBackorders] = React.useState("no");
  const [lowStockBulk, setLowStockBulk] = React.useState(10);
  const [lowStockRetail, setLowStockRetail] = React.useState(20);

  // SMS & Notifications State
  const [smsGateway, setSmsGateway] = React.useState("greenweb");
  const [smsSenderId, setSmsSenderId] = React.useState("MOLASSES");
  const [whatsapp, setWhatsapp] = React.useState("+880 1711-234567");
  const [smtpServer, setSmtpServer] = React.useState("smtp.sendgrid.net (Port 587)");

  // UI State
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [isDbConnected, setIsDbConnected] = React.useState(false);
  const [saveMessage, setSaveMessage] = React.useState<string | null>(null);

  const loadSettings = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await getSiteSettingsAction();
      if (res.success && res.settings) {
        const data = res.settings;

        // Store Profile
        if (data["store.name"] !== undefined) setStoreName(String(data["store.name"]));
        if (data["store.name_bn"] !== undefined) setStoreNameBn(String(data["store.name_bn"]));
        if (data["store.currency"] !== undefined) setCurrency(String(data["store.currency"]));
        if (data["store.support_phone"] !== undefined) setSupportPhone(String(data["store.support_phone"]));
        if (data["store.email"] !== undefined) setEmail(String(data["store.email"]));
        if (data["store.address"] !== undefined) setAddress(String(data["store.address"]));
        if (data["store.timezone"] !== undefined) setTimezone(String(data["store.timezone"]));
        if (data["store.language"] !== undefined) setLanguage(String(data["store.language"]));
        if (data["store.logo_url"] !== undefined) setLogoUrl(String(data["store.logo_url"] || ""));
        if (data["store.favicon_url"] !== undefined) setFaviconUrl(String(data["store.favicon_url"] || ""));

        // Orders & Stock
        if (typeof data["checkout.cod_enabled"] === "boolean") {
          setCodEnabled(data["checkout.cod_enabled"]);
        }
        if (typeof data["checkout.guest_checkout_enabled"] === "boolean") {
          setGuestCheckoutEnabled(data["checkout.guest_checkout_enabled"]);
        }
        if (data["orders.auto_cancel_cod_hours"] !== undefined) {
          setAutoCancelCodHours(String(data["orders.auto_cancel_cod_hours"]));
        }
        if (data["orders.allow_backorders"] !== undefined) {
          setAllowBackorders(String(data["orders.allow_backorders"]));
        }
        if (data["inventory.low_stock_threshold_bulk"] !== undefined) {
          setLowStockBulk(Number(data["inventory.low_stock_threshold_bulk"]));
        }
        if (data["inventory.low_stock_threshold_retail"] !== undefined) {
          setLowStockRetail(Number(data["inventory.low_stock_threshold_retail"]));
        }

        // SMS & Notifications
        if (data["notifications.sms_gateway"] !== undefined) {
          setSmsGateway(String(data["notifications.sms_gateway"]));
        }
        if (data["notifications.sms_sender_id"] !== undefined) {
          setSmsSenderId(String(data["notifications.sms_sender_id"]));
        }
        if (data["store.whatsapp"] !== undefined) {
          setWhatsapp(String(data["store.whatsapp"]));
        }
        if (data["notifications.smtp_server"] !== undefined) {
          setSmtpServer(String(data["notifications.smtp_server"]));
        }

        setIsDbConnected(true);
      } else {
        setIsDbConnected(false);
        showToast(res.error || "Failed to load site settings", "destructive");
      }
    } catch (e: any) {
      console.error("Failed to load settings:", e);
      setIsDbConnected(false);
      showToast(e?.message || "Failed to connect to settings database", "destructive");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  React.useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const payload = {
        "store.name": storeName,
        "store.name_bn": storeNameBn,
        "store.currency": currency,
        "store.support_phone": supportPhone,
        "store.email": email,
        "store.address": address,
        "store.timezone": timezone,
        "store.language": language,
        "store.logo_url": logoUrl,
        "store.favicon_url": faviconUrl,
        "checkout.cod_enabled": codEnabled,
        "checkout.guest_checkout_enabled": guestCheckoutEnabled,
        "orders.auto_cancel_cod_hours": autoCancelCodHours,
        "orders.allow_backorders": allowBackorders,
        "inventory.low_stock_threshold_bulk": Number(lowStockBulk),
        "inventory.low_stock_threshold_retail": Number(lowStockRetail),
        "notifications.sms_gateway": smsGateway,
        "notifications.sms_sender_id": smsSenderId,
        "store.whatsapp": whatsapp,
        "notifications.smtp_server": smtpServer,
      };

      const res = await updateSiteSettingsAction(payload);
      if (res.success) {
        setIsDbConnected(true);
        queryClient.invalidateQueries({ queryKey: SITE_SETTINGS_QUERY_KEY });
        setSaveMessage("Settings saved successfully!");
        showToast("Settings saved to database.", "success");
        setTimeout(() => setSaveMessage(null), 3500);
      } else {
        showToast(res.error || "Could not save settings", "destructive");
        setSaveMessage("Failed to save settings");
        setTimeout(() => setSaveMessage(null), 3500);
      }
    } catch (e: any) {
      console.error("Could not save settings:", e);
      showToast(e?.message || "Error saving settings", "destructive");
      setSaveMessage("Save error");
      setTimeout(() => setSaveMessage(null), 3500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">System & Store Settings</h1>
            {isDbConnected ? (
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 bg-emerald-500/10 text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1 inline" />
                Live Database
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-500/30 text-amber-600 bg-amber-500/10 text-xs">
                <AlertCircle className="h-3 w-3 mr-1 inline" />
                Offline
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm">
            Configure store branding, checkout policies, inventory thresholds, and SMS notification gateways
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saveMessage && (
            <span
              className={`text-xs font-medium animate-pulse ${
                saveMessage.includes("error") || saveMessage.includes("Failed")
                  ? "text-rose-600"
                  : "text-emerald-600"
              }`}
            >
              {saveMessage}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={loadSettings}
            disabled={loading || saving}
            className="h-9 cursor-pointer"
            title="Refresh settings from database"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white cursor-pointer h-9"
            onClick={handleSave}
            disabled={saving || loading}
          >
            <Save className={`h-4 w-4 mr-2 ${saving ? "animate-spin" : ""}`} />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Tabs defaultValue="general">
          <TabsList className="grid w-full grid-cols-3 lg:w-[500px] mb-6">
            <TabsTrigger value="general">Store Profile</TabsTrigger>
            <TabsTrigger value="inventory">Orders & Stock</TabsTrigger>
            <TabsTrigger value="notifications">SMS & Outbox</TabsTrigger>
          </TabsList>

          {/* Store Profile Tab */}
          <TabsContent value="general" className="space-y-6">
            {/* Store Brand Assets (Logo & Favicon) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-amber-600" />
                  Store Brand Assets (Logo & Favicon)
                </CardTitle>
                <CardDescription>
                  Upload your official company emblem, transparent logo, and browser favicon
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 sm:grid-cols-2">
                  {/* Business Logo */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold block">Business Logo</label>
                    <p className="text-[11px] text-muted-foreground mb-2">
                      Shown on login portal, sidebar navigation, invoices, and receipts (PNG, WebP, or SVG recommended)
                    </p>
                    <ImageUploader
                      value={logoUrl ? [logoUrl] : []}
                      onChange={(items) => {
                        const first = items[0];
                        setLogoUrl(first?.url || first?.path || "");
                      }}
                      onRemove={() => setLogoUrl("")}
                      multiple={false}
                      bucket="catalog-images"
                      folder="branding/logo"
                      label="Upload Business Logo"
                      description="Click or drag company logo (PNG, JPG, WebP)"
                      aspectRatio="auto"
                    />
                  </div>

                  {/* Browser Favicon */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold block">Store Favicon / Web App Icon</label>
                    <p className="text-[11px] text-muted-foreground mb-2">
                      Shown on browser tabs and desktop bookmarks (Square PNG, ICO, or SVG recommended)
                    </p>
                    <ImageUploader
                      value={faviconUrl ? [faviconUrl] : []}
                      onChange={(items) => {
                        const first = items[0];
                        setFaviconUrl(first?.url || first?.path || "");
                      }}
                      onRemove={() => setFaviconUrl("")}
                      multiple={false}
                      bucket="catalog-images"
                      folder="branding/favicon"
                      label="Upload Store Favicon"
                      description="Square icon (64x64 or 128x128 recommended)"
                      aspectRatio="square"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Store className="h-4 w-4 text-amber-600" />
                  Store Identity & Branding
                </CardTitle>
                <CardDescription>
                  Public information shown on customer storefront, invoices, receipts, and order confirmations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Store Legal Name (English)</label>
                    <Input
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      placeholder="e.g. Molasses Store"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold font-bangla">প্রতিষ্ঠানের নাম (বাংলা)</label>
                    <Input
                      value={storeNameBn}
                      onChange={(e) => setStoreNameBn(e.target.value)}
                      placeholder="e.g. মোলাসেস স্টোর বাংলাদেশ"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Support Phone Number</label>
                    <Input
                      value={supportPhone}
                      onChange={(e) => setSupportPhone(e.target.value)}
                      placeholder="+880 1700-000000"
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Official Invoicing Email</label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="billing@molassesstore.com"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Headquarters Physical Address</label>
                  <Input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Physical address for invoices and business records"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-3 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Default Currency</label>
                    <Select value={currency} onValueChange={(val) => setCurrency(val || "BDT")}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Currency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BDT">BDT (৳ Bangladeshi Taka)</SelectItem>
                        <SelectItem value="USD">USD ($ US Dollar)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Timezone</label>
                    <Input
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      placeholder="Asia/Dhaka"
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Default Language</label>
                    <Select value={language} onValueChange={(val) => setLanguage(val || "bn_en")}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Language" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bn_en">Bilingual (English + Bangla)</SelectItem>
                        <SelectItem value="en">English Only</SelectItem>
                        <SelectItem value="bn">Bangla Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Orders & Stock Tab */}
          <TabsContent value="inventory" className="space-y-6">
            {/* Checkout & Payment Policies */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-amber-600" />
                  Checkout & Payment Policies
                </CardTitle>
                <CardDescription>
                  Customer checkout controls, cash on delivery allowance, and automatic order expiration
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* COD Toggle Card */}
                  <div
                    onClick={() => setCodEnabled(!codEnabled)}
                    className={`flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition-colors ${
                      codEnabled
                        ? "border-amber-500/40 bg-amber-500/5 dark:bg-amber-500/10"
                        : "border-border bg-card hover:bg-muted/40"
                    }`}
                  >
                    <Checkbox
                      checked={codEnabled}
                      onCheckedChange={(checked) => setCodEnabled(Boolean(checked))}
                      className="mt-0.5"
                    />
                    <div className="space-y-0.5">
                      <label className="text-xs font-semibold cursor-pointer">
                        Enable Cash on Delivery (COD)
                      </label>
                      <p className="text-[11px] text-muted-foreground">
                        Permit customers to place orders with payment upon delivery. Disabling forces online payments.
                      </p>
                    </div>
                  </div>

                  {/* Guest Checkout Toggle Card */}
                  <div
                    onClick={() => setGuestCheckoutEnabled(!guestCheckoutEnabled)}
                    className={`flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition-colors ${
                      guestCheckoutEnabled
                        ? "border-amber-500/40 bg-amber-500/5 dark:bg-amber-500/10"
                        : "border-border bg-card hover:bg-muted/40"
                    }`}
                  >
                    <Checkbox
                      checked={guestCheckoutEnabled}
                      onCheckedChange={(checked) => setGuestCheckoutEnabled(Boolean(checked))}
                      className="mt-0.5"
                    />
                    <div className="space-y-0.5">
                      <label className="text-xs font-semibold cursor-pointer">
                        Allow Guest Checkout
                      </label>
                      <p className="text-[11px] text-muted-foreground">
                        Allow shoppers to checkout without creating an account or signing in first.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Auto-Cancel Unpaid COD Orders</label>
                    <Select
                      value={autoCancelCodHours}
                      onValueChange={(val) => setAutoCancelCodHours(val || "48")}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="24">After 24 hours</SelectItem>
                        <SelectItem value="48">After 48 hours</SelectItem>
                        <SelectItem value="72">After 72 hours</SelectItem>
                        <SelectItem value="never">Never auto-cancel</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      Unconfirmed or unreachable COD orders are flagged or cancelled after this time window.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Allow Customer Backorders</label>
                    <Select
                      value={allowBackorders}
                      onValueChange={(val) => setAllowBackorders(val || "no")}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">Do not allow backorders when out of stock</SelectItem>
                        <SelectItem value="yes">Allow backorders with delivery notice</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      Controls whether the cart accepts orders for items with zero warehouse inventory.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Inventory Thresholds */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Truck className="h-4 w-4 text-amber-600" />
                  Inventory Thresholds & Stock Alerts
                </CardTitle>
                <CardDescription>
                  Stock alert triggers, low-inventory notifications, and warehouse re-order warnings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Low Stock Alert Threshold (Tons)</label>
                    <Input
                      type="number"
                      value={lowStockBulk}
                      onChange={(e) => setLowStockBulk(Number(e.target.value))}
                      className="font-mono"
                      min={0}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Alerts warehouse management when aggregate bulk raw molasses stock falls below this quantity.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Retail Pack Alert Threshold (Units)</label>
                    <Input
                      type="number"
                      value={lowStockRetail}
                      onChange={(e) => setLowStockRetail(Number(e.target.value))}
                      className="font-mono"
                      min={0}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Triggers low-stock warnings across consumer retail bottles, pails, and jars.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SMS & Outbox Tab */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-amber-600" />
                  SMS & Outbox Delivery Channels
                </CardTitle>
                <CardDescription>
                  Configure SMS notification gateways, WhatsApp customer service contact, and transactional email server
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">SMS Gateway Provider</label>
                    <Select
                      value={smsGateway}
                      onValueChange={(val) => setSmsGateway(val || "greenweb")}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="greenweb">Greenweb Bangladesh (Masking SMS)</SelectItem>
                        <SelectItem value="onnorokom">Onnorokom SMS</SelectItem>
                        <SelectItem value="infobip">Infobip Global</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Masking Sender ID</label>
                    <Input
                      value={smsSenderId}
                      onChange={(e) => setSmsSenderId(e.target.value)}
                      placeholder="e.g. MOLASSES"
                      className="font-mono"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">WhatsApp Business Phone</label>
                    <Input
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      placeholder="+880 1711-000000"
                      className="font-mono"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Used for customer support chat links and instant WhatsApp dispatch notifications.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">SMTP Transactional Server Host</label>
                    <Input
                      value={smtpServer}
                      onChange={(e) => setSmtpServer(e.target.value)}
                      placeholder="e.g. smtp.sendgrid.net (Port 587)"
                      className="font-mono"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
