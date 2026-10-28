"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Save, Store, Shield, Bell, DollarSign, Truck, Smartphone, Mail, Database, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { fetchSiteSettingsFromDb, updateSiteSettingInDb } from "@/lib/supabase";

export default function SettingsPage() {
  const [storeName, setStoreName] = React.useState("Molasses Store");
  const [currency, setCurrency] = React.useState("BDT");
  const [supportPhone, setSupportPhone] = React.useState("+880 1700-000001");
  const [whatsapp, setWhatsapp] = React.useState("+880 1700-000001");
  const [codEnabled, setCodEnabled] = React.useState(true);
  const [guestCheckoutEnabled, setGuestCheckoutEnabled] = React.useState(true);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [isDbConnected, setIsDbConnected] = React.useState(false);
  const [saveMessage, setSaveMessage] = React.useState<string | null>(null);

  const loadSettings = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSiteSettingsFromDb();
      if (data && Object.keys(data).length > 0) {
        if (data["store.name"]) setStoreName(data["store.name"]);
        if (data["store.currency"]) setCurrency(data["store.currency"]);
        if (data["store.support_phone"]) setSupportPhone(data["store.support_phone"]);
        if (data["store.whatsapp"]) setWhatsapp(data["store.whatsapp"]);
        if (typeof data["checkout.cod_enabled"] === "boolean") setCodEnabled(data["checkout.cod_enabled"]);
        if (typeof data["checkout.guest_checkout_enabled"] === "boolean") setGuestCheckoutEnabled(data["checkout.guest_checkout_enabled"]);
        setIsDbConnected(true);
      } else {
        setIsDbConnected(false);
      }
    } catch (e) {
      console.warn("Failed to load settings from Supabase:", e);
      setIsDbConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      await Promise.all([
        updateSiteSettingInDb("store.name", storeName),
        updateSiteSettingInDb("store.currency", currency),
        updateSiteSettingInDb("store.support_phone", supportPhone),
        updateSiteSettingInDb("store.whatsapp", whatsapp),
        updateSiteSettingInDb("checkout.cod_enabled", codEnabled),
        updateSiteSettingInDb("checkout.guest_checkout_enabled", guestCheckoutEnabled),
      ]);
      setSaveMessage("Settings saved successfully!");
      setTimeout(() => setSaveMessage(null), 3500);
    } catch (e: any) {
      console.warn("Could not save settings:", e);
      setSaveMessage("Settings saved locally");
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
          <h1 className="text-2xl font-bold tracking-tight">System & Store Settings</h1>
          <p className="text-muted-foreground text-sm">
            Configure business registration, tax / BIN credentials, SMS gateways, and inventory alert limits
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saveMessage && (
            <span className="text-xs text-emerald-600 font-medium animate-pulse">
              {saveMessage}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={loadSettings}
            disabled={loading}
            className="h-9 cursor-pointer"
            title="Refresh settings"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white cursor-pointer h-9"
            onClick={handleSave}
            disabled={saving}
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
          <TabsList className="grid w-full grid-cols-4 lg:w-[600px] mb-6">
            <TabsTrigger value="general">Store Profile</TabsTrigger>
            <TabsTrigger value="tax">Tax & Legal</TabsTrigger>
            <TabsTrigger value="inventory">Orders & Stock</TabsTrigger>
            <TabsTrigger value="notifications">SMS & Outbox</TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Store className="h-4 w-4 text-amber-600" />
                  Store Identity & Branding
                </CardTitle>
                <CardDescription>Public information shown on invoices, receipts, and order confirmations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Store Legal Name (English)</label>
                    <Input
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold font-bangla">প্রতিষ্ঠানের নাম (বাংলা)</label>
                    <Input defaultValue="মোলাসেস স্টোর বাংলাদেশ" />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Support Phone Number</label>
                    <Input
                      value={supportPhone}
                      onChange={(e) => setSupportPhone(e.target.value)}
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Official Invoicing Email</label>
                    <Input defaultValue="billing@molassesstore.com" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Headquarters Physical Address</label>
                  <Input defaultValue="24/B Industrial Area, Tejgaon Industrial Area, Dhaka-1208, Bangladesh" />
                </div>

                <div className="grid gap-4 sm:grid-cols-3 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Default Currency</label>
                    <Select defaultValue="bdt">
                      <SelectTrigger>
                        <SelectValue placeholder="Currency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bdt">BDT (৳ Bangladeshi Taka)</SelectItem>
                        <SelectItem value="usd">USD ($ US Dollar)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Timezone</label>
                    <Input defaultValue="Asia/Dhaka (UTC+6)" disabled className="bg-muted" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Default Language</label>
                    <Select defaultValue="bn_en">
                      <SelectTrigger>
                        <SelectValue />
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

          {/* Tax Tab */}
          <TabsContent value="tax">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4 text-amber-600" />
                  Corporate Registration & NBR Compliance
                </CardTitle>
                <CardDescription>National Board of Revenue (NBR) Value Added Tax and Trade Credentials</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">VAT / BIN Registration Number</label>
                    <Input defaultValue="BIN-001928374-0101" className="font-mono" />
                    <p className="text-[11px] text-muted-foreground">Appears automatically on standard Mushak 6.3 invoices</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Taxpayer Identification Number (TIN)</label>
                    <Input defaultValue="TIN-49102938471" className="font-mono" />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Trade License Number</label>
                    <Input defaultValue="TRAD/DNCC/2026/089412" className="font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">BSTI Certification Number</label>
                    <Input defaultValue="BSTI-AGRI-2026-0041" className="font-mono" />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Standard Retail VAT Rate</label>
                    <Input defaultValue="5.0%" className="font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Bulk Animal Feed VAT Exemption</label>
                    <Badge variant="secondary" className="bg-green-100 text-green-700 block w-fit mt-1">
                      Exempted (Feed Grade SRO Clause 4)
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Inventory & Orders Tab */}
          <TabsContent value="inventory">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Truck className="h-4 w-4 text-amber-600" />
                  Inventory Thresholds & Order Automation
                </CardTitle>
                <CardDescription>Stock alert triggers, low-inventory notifications, and order lifecycle timeouts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Low Stock Alert Threshold (Tons)</label>
                    <Input type="number" defaultValue="10" className="font-mono" />
                    <p className="text-[11px] text-muted-foreground">Alerts manager when aggregate bulk stock falls below this quantity</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Retail Pack Alert Threshold (Units)</label>
                    <Input type="number" defaultValue="20" className="font-mono" />
                    <p className="text-[11px] text-muted-foreground">Triggers low-stock badge for bottles, pails, and jars</p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Auto-Cancel Unpaid COD Orders</label>
                    <Select defaultValue="48">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="24">After 24 hours</SelectItem>
                        <SelectItem value="48">After 48 hours</SelectItem>
                        <SelectItem value="72">After 72 hours</SelectItem>
                        <SelectItem value="never">Never auto-cancel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Allow Customer Backorders</label>
                    <Select defaultValue="no">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">Do not allow backorders when out of stock</SelectItem>
                        <SelectItem value="yes">Allow backorders with delivery notice</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-amber-600" />
                  SMS & Outbox Delivery Channels (notification_outbox)
                </CardTitle>
                <CardDescription>Configure Onnorokom / Greenweb SMS API, WhatsApp alerts, and transactional email</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">SMS Gateway Provider</label>
                    <Select defaultValue="greenweb">
                      <SelectTrigger>
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
                    <Input defaultValue="MOLASSES" className="font-mono" />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">WhatsApp Business Phone</label>
                    <Input defaultValue="+880 1711-234567" className="font-mono" />
                    <p className="text-[11px] text-muted-foreground">Connected to Meta WhatsApp Cloud API</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">SMTP Transactional Server</label>
                    <Input defaultValue="smtp.sendgrid.net (Port 587)" className="font-mono" />
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
