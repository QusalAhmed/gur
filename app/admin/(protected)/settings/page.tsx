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
  Factory,
  Mail,
  Send,
  Key,
  ExternalLink,
  MessageSquare,
  Wallet,
  Info,
  Sparkles,
} from "lucide-react";
import { ImageUploader } from "@/components/ui/image-uploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  getSiteSettingsAction,
  updateSiteSettingsAction,
  resetSimulatedStockAction,
} from "@/actions/settings";
import { testBrevoConnectionAction } from "@/actions/brevo";
import { checkSmsBalanceAction, sendTestSmsAction } from "@/actions/sms";
import { SITE_SETTINGS_QUERY_KEY } from "@/hooks/use-site-settings";
import { OutboxMonitor } from "@/components/admin/outbox-monitor";
import {
  SeoSettingsTab,
  type SeoSettingsFormState,
} from "@/components/admin/seo-settings-tab";

export default function SettingsPage() {
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
  const [dailyProductionKg, setDailyProductionKg] = React.useState(50);

  // Simulated Stock & Pre-Order Urgency State (Inngest)
  const [simulatedDemandEnabled, setSimulatedDemandEnabled] = React.useState(true);
  const [simulatedDemandKg, setSimulatedDemandKg] = React.useState(0);
  const [simulatedDemandMinKg, setSimulatedDemandMinKg] = React.useState(1.0);
  const [simulatedDemandMaxKg, setSimulatedDemandMaxKg] = React.useState(3.0);
  const [simulatedDemandMaxCapKg, setSimulatedDemandMaxCapKg] = React.useState(80);
  const [simulatedDemandIntervalMins, setSimulatedDemandIntervalMins] = React.useState(10);
  const [isResettingSimulatedStock, setIsResettingSimulatedStock] = React.useState(false);

  // SMS & Notifications State
  const [smsEnabled, setSmsEnabled] = React.useState(true);
  const [smsGateway, setSmsGateway] = React.useState("smsbangladesh");
  const [smsUser, setSmsUser] = React.useState("");
  const [smsPassword, setSmsPassword] = React.useState("");
  const [smsSenderId, setSmsSenderId] = React.useState("MOLASSES");
  const [smsPlacedEnabled, setSmsPlacedEnabled] = React.useState(true);
  const [smsConfirmedEnabled, setSmsConfirmedEnabled] = React.useState(true);
  const [smsShippedEnabled, setSmsShippedEnabled] = React.useState(true);
  const [smsDeliveredEnabled, setSmsDeliveredEnabled] = React.useState(true);
  const [smsTemplatePlaced, setSmsTemplatePlaced] = React.useState(
    "প্রিয় {customer_name}, আপনার অর্ডার #{order_number} সফলভাবে গৃহীত হয়েছে। মোট বিল: ৳{amount}। খুব শীঘ্রই আমাদের প্রতিনিধি যোগাযোগ করবেন। ধন্যবাদ!"
  );
  const [smsTemplateConfirmed, setSmsTemplateConfirmed] = React.useState(
    "প্রিয় {customer_name}, আপনার অর্ডার #{order_number} কনফার্ম করা হয়েছে। মোট বিল: ৳{amount}। আপনার পার্সেলটি প্যাকিং সম্পন্ন করে দ্রুত পাঠিয়ে দেওয়া হবে। ধন্যবাদ!"
  );
  const [smsTemplateShipped, setSmsTemplateShipped] = React.useState(
    "প্রিয় {customer_name}, আপনার অর্ডার #{order_number} {courier_name} কুরিয়ারের মাধ্যমে পাঠানো হয়েছে। ট্র্যাকিং কোড: {tracking_code}। পার্সেল ট্র্যাক করুন: {tracking_url}"
  );
  const [smsTemplateDelivered, setSmsTemplateDelivered] = React.useState(
    "প্রিয় {customer_name}, আপনার অর্ডার #{order_number} সফলভাবে ডেলিভারি সম্পন্ন হয়েছে। খেজুরের খাঁটি গুড়-এর সাথে থাকার জন্য ধন্যবাদ!"
  );
  const [checkingBalance, setCheckingBalance] = React.useState(false);
  const [smsBalance, setSmsBalance] = React.useState<number | null>(null);
  const [testingSms, setTestingSms] = React.useState(false);
  const [testSmsPhone, setTestSmsPhone] = React.useState("");
  const [whatsapp, setWhatsapp] = React.useState("+880 1711-234567");
  const [smtpServer, setSmtpServer] = React.useState("smtp.sendgrid.net (Port 587)");

  // Brevo Transactional Email Notification State
  const [brevoEnabled, setBrevoEnabled] = React.useState(true);
  const [brevoApiKey, setBrevoApiKey] = React.useState("");
  const [brevoAdminEmail, setBrevoAdminEmail] = React.useState("");
  const [brevoSenderEmail, setBrevoSenderEmail] = React.useState("");
  const [brevoSenderName, setBrevoSenderName] = React.useState("খেজুরের খাঁটি গুড়");
  const [testingBrevo, setTestingBrevo] = React.useState(false);

  // SEO & Social State
  const [seoState, setSeoState] = React.useState<SeoSettingsFormState>({
    storeSubtitle: "আমার নিজের বাসায় তৈরী খাঁটি ও নির্ভেজাল ঐতিহ্যবাহী গুড়",
    seoSiteUrl: "",
    seoDefaultTitle: "খেজুরের খাটি গুড় | Pure Cane & Date Palm Molasses",
    seoTitleTemplate: "%s | খেজুরের খাটি গুড়",
    seoDefaultDescription:
      "Pure sugarcane and date palm molasses (ঝোলা গুড়, পাটালি গুড়) manufacturing, retail, and B2B wholesale distribution platform in Bangladesh.",
    seoKeywords: "",
    seoOgImageUrl: "",
    seoTwitterHandle: "",
    seoHomeTitle: "",
    seoHomeDescription: "",
    seoProductsTitle: "সকল খাঁটি গুড়ের পণ্যসমূহ",
    seoProductsDescription:
      "বাঘা, রাজশাহীর আসল ঝোলা গুড়, দানাদার পাটালি ও নলেন গুড়ের সংগ্রহ। ১০০% খাঁটি ও ক্যাশ অন ডেলিভারিতে অর্ডার করুন।",
    seoContactTitle: "যোগাযোগ ও সরাসরি অর্ডার",
    seoContactDescription:
      "গাছিদের খাঁটি খেজুরের গুড় কিনতে বা যেকোনো তথ্যে সরাসরি ফোন, হোয়াটসঅ্যাপ বা মেসেঞ্জারে আমাদের সাথে যোগাযোগ করুন। বাঘা, রাজশাহী।",
    seoPrivacyTitle: "গোপনীয়তা নীতি (Privacy Policy)",
    seoPrivacyDescription:
      "আমাদের প্ল্যাটফর্মে গ্রাহকদের ব্যক্তিগত তথ্যের সর্বোচ্চ নিরাপত্তা ও গোপনীয়তা রক্ষা আমাদের প্রধান অগ্রাধিকার। জানুন আমাদের প্রাইভেসি পলিসি।",
    seoBusinessType: "Store",
    seoBusinessDescription: "",
    seoFacebookUrl: "",
    seoInstagramUrl: "",
    seoYoutubeUrl: "",
    seoGoogleVerification: "",
    seoGa4MeasurementId: "",
    seoAllowIndexing: true,
  });

  const handleSeoChange = React.useCallback(
    <K extends keyof SeoSettingsFormState>(
      key: K,
      value: SeoSettingsFormState[K]
    ) => {
      setSeoState((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

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
        if (data["inventory.daily_production_kg"] !== undefined) {
          setDailyProductionKg(Number(data["inventory.daily_production_kg"]) || 50);
        }
        if (data["inventory.simulated_demand_enabled"] !== undefined) {
          setSimulatedDemandEnabled(data["inventory.simulated_demand_enabled"] === true);
        }
        if (data["inventory.simulated_demand_kg"] !== undefined) {
          setSimulatedDemandKg(Number(data["inventory.simulated_demand_kg"]) || 0);
        }
        if (data["inventory.simulated_demand_min_kg"] !== undefined) {
          setSimulatedDemandMinKg(Number(data["inventory.simulated_demand_min_kg"]) || 1.0);
        }
        if (data["inventory.simulated_demand_max_kg"] !== undefined) {
          setSimulatedDemandMaxKg(Number(data["inventory.simulated_demand_max_kg"]) || 3.0);
        }
        if (data["inventory.simulated_demand_max_cap_kg"] !== undefined) {
          setSimulatedDemandMaxCapKg(Number(data["inventory.simulated_demand_max_cap_kg"]) || 80);
        }
        if (data["inventory.simulated_demand_interval_mins"] !== undefined) {
          setSimulatedDemandIntervalMins(Number(data["inventory.simulated_demand_interval_mins"]) || 10);
        }

        // SMS & Notifications
        if (typeof data["notifications.sms_enabled"] === "boolean") {
          setSmsEnabled(data["notifications.sms_enabled"]);
        }
        if (data["notifications.sms_gateway"] !== undefined) {
          setSmsGateway(String(data["notifications.sms_gateway"]).replace(/^"|"$/g, ""));
        }
        if (data["notifications.smsbangladesh_user"] !== undefined) {
          setSmsUser(String(data["notifications.smsbangladesh_user"]).replace(/^"|"$/g, ""));
        }
        if (data["notifications.smsbangladesh_password"] !== undefined) {
          setSmsPassword(String(data["notifications.smsbangladesh_password"]).replace(/^"|"$/g, ""));
        }
        if (data["notifications.smsbangladesh_from"] !== undefined) {
          setSmsSenderId(String(data["notifications.smsbangladesh_from"]).replace(/^"|"$/g, ""));
        }
        if (typeof data["notifications.sms_placed_enabled"] === "boolean") {
          setSmsPlacedEnabled(data["notifications.sms_placed_enabled"]);
        }
        if (typeof data["notifications.sms_confirmed_enabled"] === "boolean") {
          setSmsConfirmedEnabled(data["notifications.sms_confirmed_enabled"]);
        }
        if (typeof data["notifications.sms_shipped_enabled"] === "boolean") {
          setSmsShippedEnabled(data["notifications.sms_shipped_enabled"]);
        }
        if (typeof data["notifications.sms_delivered_enabled"] === "boolean") {
          setSmsDeliveredEnabled(data["notifications.sms_delivered_enabled"]);
        }
        if (data["notifications.sms_template_placed"] !== undefined) {
          setSmsTemplatePlaced(String(data["notifications.sms_template_placed"]).replace(/^"|"$/g, ""));
        }
        if (data["notifications.sms_template_confirmed"] !== undefined) {
          setSmsTemplateConfirmed(String(data["notifications.sms_template_confirmed"]).replace(/^"|"$/g, ""));
        }
        if (data["notifications.sms_template_shipped"] !== undefined) {
          setSmsTemplateShipped(String(data["notifications.sms_template_shipped"]).replace(/^"|"$/g, ""));
        }
        if (data["notifications.sms_template_delivered"] !== undefined) {
          setSmsTemplateDelivered(String(data["notifications.sms_template_delivered"]).replace(/^"|"$/g, ""));
        }
        if (data["store.whatsapp"] !== undefined) {
          setWhatsapp(String(data["store.whatsapp"]));
        }
        if (data["notifications.smtp_server"] !== undefined) {
          setSmtpServer(String(data["notifications.smtp_server"]));
        }

        // Brevo Notification Settings
        if (typeof data["notifications.brevo_enabled"] === "boolean") {
          setBrevoEnabled(data["notifications.brevo_enabled"]);
        }
        if (data["notifications.brevo_api_key"] !== undefined) {
          setBrevoApiKey(String(data["notifications.brevo_api_key"]).replace(/^"|"$/g, ""));
        }
        if (data["notifications.brevo_admin_email"] !== undefined) {
          setBrevoAdminEmail(String(data["notifications.brevo_admin_email"]).replace(/^"|"$/g, ""));
        }
        if (data["notifications.brevo_sender_email"] !== undefined) {
          setBrevoSenderEmail(String(data["notifications.brevo_sender_email"]).replace(/^"|"$/g, ""));
        }
        if (data["notifications.brevo_sender_name"] !== undefined) {
          setBrevoSenderName(String(data["notifications.brevo_sender_name"]).replace(/^"|"$/g, ""));
        }

        // SEO & Social Settings
        const readStr = (k: string) =>
          data[k] !== undefined && data[k] !== null
            ? String(data[k]).replace(/^"|"$/g, "")
            : undefined;
        setSeoState((prev) => ({
          ...prev,
          storeSubtitle: readStr("store.subtitle") ?? prev.storeSubtitle,
          seoSiteUrl: readStr("seo.site_url") ?? prev.seoSiteUrl,
          seoDefaultTitle: readStr("seo.default_title") ?? prev.seoDefaultTitle,
          seoTitleTemplate: readStr("seo.title_template") ?? prev.seoTitleTemplate,
          seoDefaultDescription:
            readStr("seo.default_description") ?? prev.seoDefaultDescription,
          seoKeywords: readStr("seo.keywords") ?? prev.seoKeywords,
          seoOgImageUrl: readStr("seo.og_image_url") ?? prev.seoOgImageUrl,
          seoTwitterHandle: readStr("seo.twitter_handle") ?? prev.seoTwitterHandle,
          seoHomeTitle: readStr("seo.home_title") ?? prev.seoHomeTitle,
          seoHomeDescription:
            readStr("seo.home_description") ?? prev.seoHomeDescription,
          seoProductsTitle: readStr("seo.products_title") ?? prev.seoProductsTitle,
          seoProductsDescription:
            readStr("seo.products_description") ?? prev.seoProductsDescription,
          seoContactTitle: readStr("seo.contact_title") ?? prev.seoContactTitle,
          seoContactDescription:
            readStr("seo.contact_description") ?? prev.seoContactDescription,
          seoPrivacyTitle: readStr("seo.privacy_title") ?? prev.seoPrivacyTitle,
          seoPrivacyDescription:
            readStr("seo.privacy_description") ?? prev.seoPrivacyDescription,
          seoBusinessType: readStr("seo.business_type") || prev.seoBusinessType,
          seoBusinessDescription:
            readStr("seo.business_description") ?? prev.seoBusinessDescription,
          seoFacebookUrl: readStr("seo.facebook_url") ?? prev.seoFacebookUrl,
          seoInstagramUrl: readStr("seo.instagram_url") ?? prev.seoInstagramUrl,
          seoYoutubeUrl: readStr("seo.youtube_url") ?? prev.seoYoutubeUrl,
          seoGoogleVerification:
            readStr("seo.google_verification") ?? prev.seoGoogleVerification,
          seoGa4MeasurementId:
            readStr("seo.ga4_measurement_id") ?? prev.seoGa4MeasurementId,
          seoAllowIndexing:
            typeof data["seo.allow_indexing"] === "boolean"
              ? data["seo.allow_indexing"]
              : prev.seoAllowIndexing,
        }));

        setIsDbConnected(true);
      } else {
        setIsDbConnected(false);
        toast.error(res.error || "Failed to load site settings");
      }
    } catch (e: any) {
      console.error("Failed to load settings:", e);
      setIsDbConnected(false);
      toast.error(e?.message || "Failed to connect to settings database");
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
        "inventory.daily_production_kg": Number(dailyProductionKg) || 50,
        "inventory.simulated_demand_enabled": simulatedDemandEnabled,
        "inventory.simulated_demand_min_kg": Number(simulatedDemandMinKg),
        "inventory.simulated_demand_max_kg": Number(simulatedDemandMaxKg),
        "inventory.simulated_demand_max_cap_kg": Number(simulatedDemandMaxCapKg),
        "inventory.simulated_demand_interval_mins": Number(simulatedDemandIntervalMins),
        "notifications.sms_enabled": smsEnabled,
        "notifications.sms_gateway": smsGateway,
        "notifications.smsbangladesh_user": smsUser.trim(),
        "notifications.smsbangladesh_password": smsPassword.trim(),
        "notifications.smsbangladesh_from": smsSenderId.trim(),
        "notifications.sms_placed_enabled": smsPlacedEnabled,
        "notifications.sms_confirmed_enabled": smsConfirmedEnabled,
        "notifications.sms_shipped_enabled": smsShippedEnabled,
        "notifications.sms_delivered_enabled": smsDeliveredEnabled,
        "notifications.sms_template_placed": smsTemplatePlaced.trim(),
        "notifications.sms_template_confirmed": smsTemplateConfirmed.trim(),
        "notifications.sms_template_shipped": smsTemplateShipped.trim(),
        "notifications.sms_template_delivered": smsTemplateDelivered.trim(),
        "store.whatsapp": whatsapp,
        "notifications.smtp_server": smtpServer,
        "notifications.brevo_enabled": brevoEnabled,
        "notifications.brevo_api_key": brevoApiKey.trim(),
        "notifications.brevo_admin_email": brevoAdminEmail.trim(),
        "notifications.brevo_sender_email": brevoSenderEmail.trim(),
        "notifications.brevo_sender_name": brevoSenderName.trim(),
        // SEO & Social
        "store.subtitle": seoState.storeSubtitle.trim(),
        "seo.site_url": seoState.seoSiteUrl.trim(),
        "seo.default_title": seoState.seoDefaultTitle.trim(),
        "seo.title_template": seoState.seoTitleTemplate.trim(),
        "seo.default_description": seoState.seoDefaultDescription.trim(),
        "seo.keywords": seoState.seoKeywords.trim(),
        "seo.og_image_url": seoState.seoOgImageUrl.trim(),
        "seo.twitter_handle": seoState.seoTwitterHandle.trim(),
        "seo.home_title": seoState.seoHomeTitle.trim(),
        "seo.home_description": seoState.seoHomeDescription.trim(),
        "seo.products_title": seoState.seoProductsTitle.trim(),
        "seo.products_description": seoState.seoProductsDescription.trim(),
        "seo.contact_title": seoState.seoContactTitle.trim(),
        "seo.contact_description": seoState.seoContactDescription.trim(),
        "seo.privacy_title": seoState.seoPrivacyTitle.trim(),
        "seo.privacy_description": seoState.seoPrivacyDescription.trim(),
        "seo.business_type": seoState.seoBusinessType.trim() || "Store",
        "seo.business_description": seoState.seoBusinessDescription.trim(),
        "seo.facebook_url": seoState.seoFacebookUrl.trim(),
        "seo.instagram_url": seoState.seoInstagramUrl.trim(),
        "seo.youtube_url": seoState.seoYoutubeUrl.trim(),
        "seo.google_verification": seoState.seoGoogleVerification.trim(),
        "seo.ga4_measurement_id": seoState.seoGa4MeasurementId.trim().toUpperCase(),
        "seo.allow_indexing": seoState.seoAllowIndexing,
      };

      const res = await updateSiteSettingsAction(payload);
      if (res.success) {
        setIsDbConnected(true);
        queryClient.invalidateQueries({ queryKey: SITE_SETTINGS_QUERY_KEY });
        setSaveMessage("Settings saved successfully!");
        toast.success("Settings saved to database.");
        setTimeout(() => setSaveMessage(null), 3500);
      } else {
        toast.error(res.error || "Could not save settings");
        setSaveMessage("Failed to save settings");
        setTimeout(() => setSaveMessage(null), 3500);
      }
    } catch (e: any) {
      console.error("Could not save settings:", e);
      toast.error(e?.message || "Error saving settings");
      setSaveMessage("Save error");
      setTimeout(() => setSaveMessage(null), 3500);
    } finally {
      setSaving(false);
    }
  };

  const handleResetSimulatedStock = async () => {
    setIsResettingSimulatedStock(true);
    try {
      const res = await resetSimulatedStockAction();
      if (res.success) {
        setSimulatedDemandKg(0);
        queryClient.invalidateQueries({ queryKey: SITE_SETTINGS_QUERY_KEY });
        toast.success(res.message || "Simulated stock backlog reset to 0 KG");
      } else {
        toast.error(res.error || "Failed to reset simulated stock");
      }
    } catch (err: any) {
      toast.error(err?.message || "An error occurred while resetting simulated stock");
    } finally {
      setIsResettingSimulatedStock(false);
    }
  };

  const handleTestBrevo = async () => {
    setTestingBrevo(true);
    try {
      const targetEmail = brevoAdminEmail.trim() || email.trim();
      if (!targetEmail) {
        toast.error("Please enter at least one Admin Email address to receive the test email.");
        return;
      }

      toast.info(`Sending test order notification via Brevo to ${targetEmail}...`);
      const res = await testBrevoConnectionAction(targetEmail);

      if (res.success) {
        toast.success(`Test email sent successfully! Message ID: ${res.messageId || "sent"}`);
      } else {
        toast.error(`Brevo test failed: ${res.error || "Unknown error"}`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to trigger Brevo test email");
    } finally {
      setTestingBrevo(false);
    }
  };

  const handleCheckBalance = async () => {
    setCheckingBalance(true);
    try {
      const res = await checkSmsBalanceAction();
      if (res.success && res.balance !== undefined) {
        setSmsBalance(res.balance);
        toast.success(`SMSBangladesh Active Balance: ৳${res.balance.toFixed(2)}`);
      } else {
        toast.error(res.error || "Failed to check SMS balance. Please verify API credentials.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to query SMS gateway balance.");
    } finally {
      setCheckingBalance(false);
    }
  };

  const handleSendTestSms = async () => {
    const targetPhone = testSmsPhone.trim() || supportPhone.trim();
    if (!targetPhone) {
      toast.error("Please enter a valid mobile number for the test SMS.");
      return;
    }
    setTestingSms(true);
    try {
      toast.info(`Sending test SMS via SMSBangladesh to ${targetPhone}...`);
      const res = await sendTestSmsAction(targetPhone);
      if (res.success) {
        toast.success(`Test SMS delivered successfully to ${targetPhone}!`);
      } else {
        toast.error(`SMS send failed: ${res.error || res.skipReason || "Check credentials & balance"}`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to send test SMS");
    } finally {
      setTestingSms(false);
    }
  };

  const getSmsSegments = (text: string) => {
    const len = text.length;
    if (len === 0) return { chars: 0, parts: 0 };
    // Bengali unicode SMS: 70 chars for single segment, 67 chars per part for multipart
    const parts = len <= 70 ? 1 : Math.ceil(len / 67);
    return { chars: len, parts };
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
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:w-[640px] mb-6 h-auto sm:h-9">
            <TabsTrigger value="general">Store Profile</TabsTrigger>
            <TabsTrigger value="inventory">Orders &amp; Stock</TabsTrigger>
            <TabsTrigger value="notifications">SMS &amp; Outbox</TabsTrigger>
            <TabsTrigger value="seo">SEO &amp; Social</TabsTrigger>
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

            {/* Daily Production & Future Stock Capacity */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Factory className="h-4 w-4 text-amber-600" />
                  Daily Production & Live Stock Capacity
                </CardTitle>
                <CardDescription>
                  Set future production capacity per day in kilograms. The storefront live stock calculation deducts active orders from this to project tomorrow and future available stock.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Future Production Per Day (KG)</label>
                    <Input
                      type="number"
                      value={dailyProductionKg}
                      onChange={(e) => setDailyProductionKg(Math.max(1, Number(e.target.value)))}
                      className="font-mono"
                      min={1}
                      placeholder="50"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Expected daily molasses (গুড়) yield. Active orders are subtracted from future days sequentially.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Simulated Live Stock & Pre-Order Urgency (Inngest Automation) */}
            <Card className="border-amber-200/80 dark:border-amber-900/60 bg-gradient-to-b from-amber-50/20 to-transparent">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-amber-100 dark:bg-amber-950/80 rounded-lg text-amber-800 dark:text-amber-300">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        Simulated Stock & Urgency Automation
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300"
                        >
                          Inngest Cron
                        </Badge>
                      </CardTitle>
                      <CardDescription>
                        Randomly adds simulated pre-order demand to the live stock section to create natural urgency. Operates strictly between 8:00 AM – 11:30 PM (Dhaka Time) and auto-resets at midnight.
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold cursor-pointer select-none">
                      {simulatedDemandEnabled ? "Automation Active" : "Automation Paused"}
                    </label>
                    <Checkbox
                      checked={simulatedDemandEnabled}
                      onCheckedChange={(c) => setSimulatedDemandEnabled(!!c)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Current Simulated Status & Quick Reset */}
                <div className="p-3 rounded-xl bg-amber-100/50 dark:bg-stone-800/60 border border-amber-200 dark:border-stone-700 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Current Simulated Backlog:</span>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className="text-xl font-bold font-mono text-amber-900 dark:text-amber-200">
                        {simulatedDemandKg}
                      </span>
                      <span className="text-xs font-semibold text-muted-foreground">KG booked</span>
                      <span className="text-xs text-muted-foreground">
                        (Capped at {simulatedDemandMaxCapKg} KG)
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isResettingSimulatedStock || simulatedDemandKg === 0}
                    onClick={handleResetSimulatedStock}
                    className="border-amber-300 hover:bg-amber-100 text-amber-900 dark:text-amber-200"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 mr-1.5 ${
                        isResettingSimulatedStock ? "animate-spin" : ""
                      }`}
                    />
                    Reset to 0 KG Now
                  </Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Min Decrement (KG)</label>
                    <Input
                      type="number"
                      step="1"
                      min={1}
                      value={simulatedDemandMinKg}
                      onChange={(e) => setSimulatedDemandMinKg(Math.max(1, Math.round(Number(e.target.value))))}
                      className="font-mono"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Smallest simulated order step (whole KG).
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Max Decrement (KG)</label>
                    <Input
                      type="number"
                      step="1"
                      min={1}
                      value={simulatedDemandMaxKg}
                      onChange={(e) => setSimulatedDemandMaxKg(Math.max(1, Math.round(Number(e.target.value))))}
                      className="font-mono"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Largest simulated order step (whole KG).
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Interval (Minutes)</label>
                    <Input
                      type="number"
                      min={1}
                      value={simulatedDemandIntervalMins}
                      onChange={(e) => setSimulatedDemandIntervalMins(Math.max(1, Number(e.target.value)))}
                      className="font-mono"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      How frequently stock drops.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Max Backlog Cap (KG)</label>
                    <Input
                      type="number"
                      min={10}
                      value={simulatedDemandMaxCapKg}
                      onChange={(e) => setSimulatedDemandMaxCapKg(Math.max(10, Number(e.target.value)))}
                      className="font-mono"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Maximum fake demand limit.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SMS & Outbox Tab */}
          <TabsContent value="notifications" className="space-y-6">
            {/* Brevo Transactional Email (Admin Order Notifications) */}
            <Card className="border-amber-200/70 bg-gradient-to-b from-white to-amber-50/20">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-amber-100 rounded-lg text-amber-800">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        Brevo Transactional Email & Admin Order Notifications
                        <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-800 border-amber-300">
                          v3 API
                        </Badge>
                      </CardTitle>
                      <CardDescription>
                        Send instant, beautiful email notifications to store administrators whenever a customer places an order
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleTestBrevo}
                      disabled={testingBrevo || saving}
                      className="text-xs h-8 gap-1.5 border-amber-300 hover:bg-amber-100/50"
                    >
                      <Send className="h-3.5 w-3.5 text-amber-700" />
                      {testingBrevo ? "Sending Test..." : "Send Test Email"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Enable / Disable Brevo toggle */}
                <div
                  className={`flex items-start gap-3 p-3.5 rounded-lg border transition-colors ${
                    brevoEnabled
                      ? "bg-amber-50/50 border-amber-200 text-amber-950"
                      : "bg-muted/40 border-border text-muted-foreground"
                  }`}
                >
                  <Checkbox
                    id="brevo-enabled"
                    checked={brevoEnabled}
                    onCheckedChange={(checked) => setBrevoEnabled(Boolean(checked))}
                    className="mt-0.5 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                  />
                  <div className="space-y-0.5">
                    <label
                      htmlFor="brevo-enabled"
                      className="text-sm font-semibold cursor-pointer select-none"
                    >
                      Enable Brevo Admin Order Notifications
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Automatically sends an email alert to the admin for all incoming orders (including both completed customer orders and incomplete checkout draft leads).
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold flex items-center justify-between">
                      <span>Admin Recipient Email(s)</span>
                      <span className="text-[10px] text-muted-foreground font-normal">Comma-separated</span>
                    </label>
                    <Input
                      value={brevoAdminEmail}
                      onChange={(e) => setBrevoAdminEmail(e.target.value)}
                      placeholder="e.g. admin@molassesstore.com, owner@example.com"
                      className="font-mono text-xs"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Order notification emails will be sent to these addresses. Defaults to <code>BREVO_ADMIN_EMAIL</code> or Store Email if empty.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold flex items-center justify-between">
                      <span>Brevo API Key (xkeysib-...)</span>
                      <a
                        href="https://app.brevo.com/settings/keys/api"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-amber-700 hover:underline flex items-center gap-0.5"
                      >
                        Get Key <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </label>
                    <Input
                      type="password"
                      value={brevoApiKey}
                      onChange={(e) => setBrevoApiKey(e.target.value)}
                      placeholder="xkeysib-... (or leave empty if configured in .env)"
                      className="font-mono text-xs"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Can also be provided via <code>BREVO_API_KEY</code> in <code>.env</code>.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Verified Sender Email</label>
                    <Input
                      value={brevoSenderEmail}
                      onChange={(e) => setBrevoSenderEmail(e.target.value)}
                      placeholder="e.g. notifications@yourdomain.com"
                      className="font-mono text-xs"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Must be a verified sender domain/address in your Brevo account dashboard.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Sender Display Name</label>
                    <Input
                      value={brevoSenderName}
                      onChange={(e) => setBrevoSenderName(e.target.value)}
                      placeholder="e.g. খেজুরের খাঁটি গুড়"
                      className="text-xs"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Display name shown in the recipient inbox header.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* SMSBangladesh Gateway & Credentials Card */}
            <Card className="border-sky-200/70 bg-gradient-to-b from-white to-sky-50/20">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-sky-100 rounded-lg text-sky-800">
                      <Smartphone className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        SMSBangladesh Gateway & Customer Messaging
                        <Badge variant="outline" className="text-[10px] bg-sky-100 text-sky-800 border-sky-300">
                          REST API v1
                        </Badge>
                      </CardTitle>
                      <CardDescription>
                        Direct HTTP GET integration via panel.smsbangladesh.com for automated Bangladeshi transactional SMS
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {smsBalance !== null && (
                      <Badge variant="secondary" className="font-mono text-xs px-2.5 py-1 bg-sky-100 text-sky-900 border border-sky-300">
                        <Wallet className="h-3 w-3 mr-1 inline" />
                        Balance: ৳{smsBalance.toFixed(2)}
                      </Badge>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCheckBalance}
                      disabled={checkingBalance || saving}
                      className="text-xs h-8 gap-1.5 border-sky-300 hover:bg-sky-100/50"
                    >
                      <Wallet className="h-3.5 w-3.5 text-sky-700" />
                      {checkingBalance ? "Checking..." : "Check Balance"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Enable / Disable Master SMS toggle */}
                <div
                  className={`flex items-start gap-3 p-3.5 rounded-lg border transition-colors ${
                    smsEnabled
                      ? "bg-sky-50/50 border-sky-200 text-sky-950"
                      : "bg-muted/40 border-border text-muted-foreground"
                  }`}
                >
                  <Checkbox
                    id="sms-enabled"
                    checked={smsEnabled}
                    onCheckedChange={(checked) => setSmsEnabled(Boolean(checked))}
                    className="mt-0.5 data-[state=checked]:bg-sky-600 data-[state=checked]:border-sky-600"
                  />
                  <div className="space-y-0.5">
                    <label
                      htmlFor="sms-enabled"
                      className="text-sm font-semibold cursor-pointer select-none"
                    >
                      Enable Customer SMS Notifications
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Automatically dispatches transactional SMS updates to customer mobile numbers on order placed, confirmed, shipped, and delivered.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">SMS Gateway Provider</label>
                    <Select
                      value={smsGateway}
                      onValueChange={(val) => setSmsGateway(val || "smsbangladesh")}
                    >
                      <SelectTrigger className="w-full text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="smsbangladesh">SMSBangladesh (panel.smsbangladesh.com)</SelectItem>
                        <SelectItem value="greenweb">Greenweb Bangladesh (Masking SMS)</SelectItem>
                        <SelectItem value="onnorokom">Onnorokom SMS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold flex items-center justify-between">
                      <span>Sender ID / Masking Name</span>
                      <span className="text-[10px] text-muted-foreground">Approved ID</span>
                    </label>
                    <Input
                      value={smsSenderId}
                      onChange={(e) => setSmsSenderId(e.target.value)}
                      placeholder="e.g. NAJJTECH or MOLASSES"
                      className="font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">SMSBangladesh Username</label>
                    <Input
                      value={smsUser}
                      onChange={(e) => setSmsUser(e.target.value)}
                      placeholder="Your SMSBangladesh username"
                      className="font-mono text-xs"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Can also be set via <code>SMSBANGLADESH_USER</code> in <code>.env</code>.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">SMSBangladesh Password</label>
                    <Input
                      type="password"
                      value={smsPassword}
                      onChange={(e) => setSmsPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="font-mono text-xs"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Can also be set via <code>SMSBANGLADESH_PASSWORD</code> in <code>.env</code>.
                    </p>
                  </div>

                  {/* Send Test SMS Sandbox */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Send Test SMS</label>
                    <div className="flex gap-2">
                      <Input
                        value={testSmsPhone}
                        onChange={(e) => setTestSmsPhone(e.target.value)}
                        placeholder="017XXXXXXXX"
                        className="font-mono text-xs"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleSendTestSms}
                        disabled={testingSms || saving}
                        className="text-xs shrink-0 gap-1 bg-sky-100 hover:bg-sky-200 text-sky-900 border border-sky-300"
                      >
                        <Send className="h-3 w-3" />
                        {testingSms ? "Sending..." : "Test SMS"}
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Sends an instant verification message to the specified number to test credentials.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Order Lifecycle SMS Notification Templates Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-amber-600" />
                  Order Lifecycle SMS Templates
                </CardTitle>
                <CardDescription>
                  Configure automated Bengali (বাংলা) messages sent to customers at each milestone. Standard Bengali SMS is 70 characters per message segment.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Available Variables Guide */}
                <div className="p-3 bg-muted/40 rounded-lg border text-xs space-y-1.5">
                  <div className="font-semibold flex items-center gap-1.5 text-foreground">
                    <Info className="h-3.5 w-3.5 text-amber-600" />
                    Available Dynamic Placeholders (Click to Copy / Reference):
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      "{customer_name}",
                      "{order_number}",
                      "{amount}",
                      "{courier_name}",
                      "{tracking_code}",
                      "{tracking_url}",
                      "{support_phone}",
                      "{store_name}",
                    ].map((pill) => (
                      <Badge
                        key={pill}
                        variant="secondary"
                        className="font-mono text-[11px] cursor-pointer hover:bg-amber-100 transition-colors"
                        onClick={() => {
                          navigator.clipboard.writeText(pill);
                          toast.success(`Copied ${pill} to clipboard!`);
                        }}
                      >
                        {pill}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* 1. Order Placed Template */}
                <div className="space-y-2 p-3.5 border rounded-lg bg-card">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="sms-placed-toggle"
                        checked={smsPlacedEnabled}
                        onCheckedChange={(checked) => setSmsPlacedEnabled(Boolean(checked))}
                        className="data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                      />
                      <label htmlFor="sms-placed-toggle" className="text-xs font-semibold cursor-pointer">
                        1. Order Placed (Storefront Checkout Completion)
                      </label>
                    </div>
                    {(() => {
                      const { chars, parts } = getSmsSegments(smsTemplatePlaced);
                      return (
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {chars} chars • {parts} {parts === 1 ? "SMS" : "SMS segments"}
                        </span>
                      );
                    })()}
                  </div>
                  <Textarea
                    value={smsTemplatePlaced}
                    onChange={(e) => setSmsTemplatePlaced(e.target.value)}
                    rows={2}
                    className="text-xs font-sans leading-relaxed"
                    placeholder="প্রিয় {customer_name}, আপনার অর্ডার #{order_number} সফলভাবে গৃহীত হয়েছে..."
                  />
                </div>

                {/* 2. Order Confirmed Template */}
                <div className="space-y-2 p-3.5 border rounded-lg bg-card">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="sms-confirmed-toggle"
                        checked={smsConfirmedEnabled}
                        onCheckedChange={(checked) => setSmsConfirmedEnabled(Boolean(checked))}
                        className="data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                      />
                      <label htmlFor="sms-confirmed-toggle" className="text-xs font-semibold cursor-pointer">
                        2. Order Confirmed (Admin Status Transition to Confirmed)
                      </label>
                    </div>
                    {(() => {
                      const { chars, parts } = getSmsSegments(smsTemplateConfirmed);
                      return (
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {chars} chars • {parts} {parts === 1 ? "SMS" : "SMS segments"}
                        </span>
                      );
                    })()}
                  </div>
                  <Textarea
                    value={smsTemplateConfirmed}
                    onChange={(e) => setSmsTemplateConfirmed(e.target.value)}
                    rows={2}
                    className="text-xs font-sans leading-relaxed"
                    placeholder="প্রিয় {customer_name}, আপনার অর্ডার #{order_number} কনফার্ম করা হয়েছে..."
                  />
                </div>

                {/* 3. Order Shipped Template */}
                <div className="space-y-2 p-3.5 border rounded-lg bg-card">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="sms-shipped-toggle"
                        checked={smsShippedEnabled}
                        onCheckedChange={(checked) => setSmsShippedEnabled(Boolean(checked))}
                        className="data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                      />
                      <label htmlFor="sms-shipped-toggle" className="text-xs font-semibold cursor-pointer">
                        3. Order Shipped (Courier Dispatch & Consignment Booking)
                      </label>
                    </div>
                    {(() => {
                      const { chars, parts } = getSmsSegments(smsTemplateShipped);
                      return (
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {chars} chars • {parts} {parts === 1 ? "SMS" : "SMS segments"}
                        </span>
                      );
                    })()}
                  </div>
                  <Textarea
                    value={smsTemplateShipped}
                    onChange={(e) => setSmsTemplateShipped(e.target.value)}
                    rows={2}
                    className="text-xs font-sans leading-relaxed"
                    placeholder="প্রিয় {customer_name}, আপনার অর্ডার #{order_number} {courier_name} কুরিয়ারের মাধ্যমে পাঠানো হয়েছে..."
                  />
                </div>

                {/* 4. Order Delivered Template */}
                <div className="space-y-2 p-3.5 border rounded-lg bg-card">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="sms-delivered-toggle"
                        checked={smsDeliveredEnabled}
                        onCheckedChange={(checked) => setSmsDeliveredEnabled(Boolean(checked))}
                        className="data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                      />
                      <label htmlFor="sms-delivered-toggle" className="text-xs font-semibold cursor-pointer">
                        4. Order Delivered (Delivery Completion & Steadfast Webhook)
                      </label>
                    </div>
                    {(() => {
                      const { chars, parts } = getSmsSegments(smsTemplateDelivered);
                      return (
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {chars} chars • {parts} {parts === 1 ? "SMS" : "SMS segments"}
                        </span>
                      );
                    })()}
                  </div>
                  <Textarea
                    value={smsTemplateDelivered}
                    onChange={(e) => setSmsTemplateDelivered(e.target.value)}
                    rows={2}
                    className="text-xs font-sans leading-relaxed"
                    placeholder="প্রিয় {customer_name}, আপনার অর্ডার #{order_number} সফলভাবে ডেলিভারি সম্পন্ন হয়েছে..."
                  />
                </div>
              </CardContent>
            </Card>

            {/* Other Channels */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-amber-600" />
                  WhatsApp & Support Channels
                </CardTitle>
                <CardDescription>
                  Customer service WhatsApp number and transactional fallback configuration
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">WhatsApp Business Phone</label>
                    <Input
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      placeholder="+880 1711-000000"
                      className="font-mono text-xs"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Used for customer support chat links and direct WhatsApp inquiries.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">SMTP Transactional Server Host</label>
                    <Input
                      value={smtpServer}
                      onChange={(e) => setSmtpServer(e.target.value)}
                      placeholder="e.g. smtp.sendgrid.net (Port 587)"
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Transactional Outbox & Inngest Background Jobs Monitor */}
            <OutboxMonitor />
          </TabsContent>

          {/* SEO & Social Tab */}
          <TabsContent value="seo" className="space-y-6">
            <SeoSettingsTab
              state={seoState}
              onChange={handleSeoChange}
              storeName={storeName}
              storeNameBn={storeNameBn}
            />
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
