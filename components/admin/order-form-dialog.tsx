"use client";

import * as React from "react";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  User,
  MapPin,
  Truck,
  Building,
  RefreshCw,
  PackageCheck,
  PackagePlus,
  CheckSquare,
  Square,
  Check,
  Database,
  CreditCard,
  MessageSquare,
  ShieldCheck,
  Minus,
  Receipt,
  Clock,
  Calendar,
  X,
  Link2,
  Loader2,
} from "lucide-react";
import {
  searchInquiryByRefCodeAction,
  type InquiryLookupResult,
} from "@/actions/new-order-ops";
import {
  DbGeoDivision,
  DbGeoDistrict,
  updateOrderNoteInDb,
  deleteOrderNoteInDb,
  addOrderNoteInDb,
} from "@/lib/supabase";
import { DistrictCombobox } from "@/components/admin/district-combobox";
import { SteadfastDeliveryRecordBadge } from "@/components/admin/steadfast-delivery-record-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useForm } from "@tanstack/react-form";
import {
  FormFieldItem,
  FormFieldLabel,
  FormFieldError,
  createShallowSelector,
} from "@/components/ui/tanstack-form";
import { cn, formatDateTime, extractRefToken } from "@/lib/utils";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { Order, OrderItem, OrderEvent, OrderNote, OrderNoteType, CatalogProduct } from "@/types/order";
import {
  orderFormSchema,
  orderCustomerSchema,
  orderPhoneSchema,
  orderAlternativePhoneSchema,
  orderShippingPhoneSchema,
  orderRecipientNameSchema,
  orderEmailSchema,
  orderDivisionSchema,
  orderDistrictSchema,
  orderAddressLineSchema,
  orderShippingTotalSchema,
  orderDiscountTotalSchema,
  orderAmountPaidSchema,
  orderCustomerNoteSchema,
  orderCourierNameSchema,
  BANGLADESH_COURIERS,
  isFieldRequiredForStatus,
  validateWithZod,
} from "@/lib/validations/order";

export interface OrderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  order?: Order | null;
  defaultStatus?: Order["status"];
  onSave: (order: Order, mode: "create" | "edit") => Promise<void> | void;
  geoDivisions: DbGeoDivision[];
  geoDistricts: DbGeoDistrict[];
  setGeoDistricts?: React.Dispatch<React.SetStateAction<DbGeoDistrict[]>>;
  availableCatalogProducts: CatalogProduct[];
  ordersCount: number;
  showToast?: (message: string, type?: "success" | "info" | "destructive") => void;
}

const PACKAGE_TYPES = ["Jar", "Foil", "Bottle", "Box"] as const;

function detectItemPackageType(name?: string, packType?: string): string {
  if (packType) {
    const pt = packType.toLowerCase();
    if (pt === "jar") return "Jar";
    if (pt === "foil") return "Foil";
    if (pt === "bottle") return "Bottle";
    if (pt === "box") return "Box";
  }
  if (!name) return "Jar";
  const lower = name.toLowerCase();
  if (lower.includes("foil") || lower.includes("pouch")) return "Foil";
  if (lower.includes("bottle") || lower.includes("jerrycan") || lower.includes("liquid")) return "Bottle";
  if (lower.includes("box") || lower.includes("block") || lower.includes("drum") || lower.includes("tote") || lower.includes("pail") || lower.includes("bag")) return "Box";
  return "Jar";
}

interface OrderEditNoteItemProps {
  note: OrderNote;
  onSave: (id: string, text: string, type: OrderNoteType) => Promise<void>;
  onCancel: () => void;
  isUpdating: boolean;
}

function OrderEditNoteItem({ note, onSave, onCancel, isUpdating }: OrderEditNoteItemProps) {
  const initialType: OrderNoteType =
    note.type === "delivery_note"
      ? "delivery"
      : note.type === "packaging_note"
      ? "packaging"
      : note.type === "internal_staff_note"
      ? "internal"
      : (note.type as OrderNoteType);

  const [text, setText] = React.useState(note.text);
  const [type, setType] = React.useState<OrderNoteType>(initialType);

  return (
    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-1.5 text-xs">
          <Edit className="h-3.5 w-3.5 text-amber-600" />
          Editing Note ({note.author})
        </span>
        <Select
          value={type}
          onValueChange={(val) => {
            if (val) setType(val as OrderNoteType);
          }}
        >
          <SelectTrigger className="h-7 text-[11px] font-medium bg-background min-w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-[70]">
            <SelectItem value="internal">Internal Staff Note</SelectItem>
            <SelectItem value="system">System Note</SelectItem>
            <SelectItem value="packaging">Packaging Note</SelectItem>
            <SelectItem value="delivery">Delivery Note</SelectItem>
            <SelectItem value="customer">Customer Instruction</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        className="text-xs bg-background"
        placeholder="Edit note text..."
        autoFocus
      />

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          className="h-7 text-xs px-2.5 cursor-pointer"
          disabled={isUpdating}
        >
          <X className="h-3 w-3 mr-1" />
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => onSave(note.id, text, type)}
          className="bg-amber-600 hover:bg-amber-700 text-white h-7 text-xs px-2.5 cursor-pointer"
          disabled={isUpdating}
        >
          <Check className="h-3 w-3 mr-1" />
          {isUpdating ? "Saving..." : "Save Note"}
        </Button>
      </div>
    </div>
  );
}

interface OrderNewNoteComposerProps {
  onAddNote: (text: string, type: OrderNoteType) => Promise<void>;
  pendingNoteRef: React.MutableRefObject<{ text: string; type: OrderNoteType }>;
}

function OrderNewNoteComposer({ onAddNote, pendingNoteRef }: OrderNewNoteComposerProps) {
  const [noteType, setNoteType] = React.useState<OrderNoteType>("internal");
  const [noteText, setNoteText] = React.useState("");

  React.useEffect(() => {
    pendingNoteRef.current = { text: noteText, type: noteType };
  }, [noteText, noteType, pendingNoteRef]);

  const handleAdd = async () => {
    const text = noteText.trim();
    if (!text) return;
    setNoteText("");
    await onAddNote(text, noteType);
  };

  return (
    <div className="space-y-2.5 pt-3 border-t">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5 text-amber-600" />
          Add New Note
        </Label>
        <Select
          value={noteType}
          onValueChange={(val) => {
            if (val) setNoteType(val as OrderNoteType);
          }}
        >
          <SelectTrigger id="order_form_new_note_type" className="h-7 text-[11px] font-medium bg-background min-w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-[70]">
            <SelectItem value="internal">Internal Staff Note</SelectItem>
            <SelectItem value="system">System Note</SelectItem>
            <SelectItem value="packaging">Packaging Note</SelectItem>
            <SelectItem value="delivery">Delivery Note</SelectItem>
            <SelectItem value="customer">Customer Instruction</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Textarea
        id="order_form_new_note_text"
        placeholder={
          noteType === "packaging"
            ? "e.g. Double bubble wrap glass jars, inspect seals, affix fragile label..."
            : noteType === "delivery"
              ? "e.g. Call before delivery, gate code, delivery after 4 PM..."
              : noteType === "system"
                ? "e.g. Automated system trigger, external synchronization notice..."
                : noteType === "customer"
                  ? "e.g. Special customer request or customization instructions..."
                  : "e.g. Phone verification note, manager approved adjustment, staff remarks..."
        }
        value={noteText}
        onChange={(e) => setNoteText(e.target.value)}
        rows={2}
        className="text-xs bg-background"
      />
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <p className="text-[10px] text-muted-foreground">
          {noteType === "internal"
            ? "Internal notes visible to staff only."
            : noteType === "packaging"
              ? "Packaging notes appear on packing lists."
              : noteType === "delivery"
                ? "Delivery notes provide instructions to couriers."
                : noteType === "system"
                  ? "System notes record automated updates and system triggers."
                  : "Customer requests recorded against this order."}
        </p>
        <Button
          id="btn-add-order-note"
          type="button"
          size="sm"
          onClick={handleAdd}
          disabled={!noteText.trim()}
          className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-7 px-2.5 cursor-pointer shadow-xs disabled:opacity-50"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Note
        </Button>
      </div>
    </div>
  );
}

export function OrderFormDialog({
  open,
  onOpenChange,
  mode,
  order,
  defaultStatus,
  onSave,
  geoDivisions,
  geoDistricts,
  setGeoDistricts,
  availableCatalogProducts,
  ordersCount,
  showToast,
}: OrderFormDialogProps) {
  const { orderPrefix, currency } = useSiteSettings();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  // Product Selection Modal state (internal to this dialog)
  const [isProductModalOpen, setIsProductModalOpen] = React.useState(false);
  const [selectedModalProducts, setSelectedModalProducts] = React.useState<
    Record<string, { quantity: number; unit_price: number }>
  >({});
  const [productSearchQuery, setProductSearchQuery] = React.useState("");
  const [packageTypeFilter, setPackageTypeFilter] = React.useState<string>("all");
  const pendingNoteRef = React.useRef<{ text: string; type: OrderNoteType }>({
    text: "",
    type: "internal",
  });
  const [notesList, setNotesList] = React.useState<OrderNote[]>([]);
  const [editingNoteId, setEditingNoteId] = React.useState<string | null>(null);
  const [isUpdatingNote, setIsUpdatingNote] = React.useState(false);

  // Helper: Add note to list and optionally sync if in edit mode
  const handleAddNote = async (textToAdd: string, typeToAdd: OrderNoteType) => {
    const text = textToAdd.trim();
    if (!text) {
      if (showToast) showToast("Please enter note text first.", "info");
      return;
    }

    const nowStr = new Date().toISOString().replace("T", " ").slice(0, 16);
    const newNoteId = `note-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newNote: OrderNote = {
      id: newNoteId,
      author: typeToAdd === "system" ? "System" : typeToAdd === "customer" ? (order?.customer || "Customer") : "Admin Staff",
      text,
      type: typeToAdd,
      created_at: nowStr,
    };

    setNotesList((prev) => [newNote, ...prev]);
    pendingNoteRef.current = { text: "", type: "internal" };

    if (typeToAdd === "customer") {
      form.setFieldValue("customer_note", text);
    }

    if (mode === "edit" && order?.id) {
      try {
        await addOrderNoteInDb(order.id, newNote, order);
        if (showToast) showToast("Note added and synced to order.", "success");
      } catch (err: any) {
        console.warn("Could not immediately persist note:", err);
        if (showToast) showToast("Note added to form. Click 'Save Changes' to finalize.", "info");
      }
    } else {
      if (showToast) showToast("Note added to order.", "success");
    }
  };

  // Helper: Start editing a note
  const handleStartEditNote = (n: OrderNote) => {
    setEditingNoteId(n.id);
  };

  // Helper: Cancel editing
  const handleCancelEditNote = () => {
    setEditingNoteId(null);
  };

  // Helper: Save edited note
  const handleSaveEditNote = async (noteId: string, textToSave: string, typeToSave: OrderNoteType) => {
    const text = textToSave.trim();
    if (!text) {
      if (showToast) showToast("Note content cannot be empty.", "destructive");
      return;
    }

    setIsUpdatingNote(true);
    try {
      const updated = notesList.map((n) =>
        n.id === noteId ? { ...n, text, type: typeToSave } : n
      );
      setNotesList(updated);

      if (typeToSave === "customer" || noteId === "customer_note") {
        form.setFieldValue("customer_note", text);
      }

      if (mode === "edit" && order?.id) {
        try {
          await updateOrderNoteInDb(order.id, noteId, text, typeToSave, order);
          if (showToast) showToast("Note updated successfully.", "success");
        } catch (err: any) {
          console.warn("Could not immediately sync note update to DB:", err);
          if (showToast) showToast("Note updated. Click 'Save Changes' to finalize.", "info");
        }
      } else {
        if (showToast) showToast("Note updated.", "success");
      }

      setEditingNoteId(null);
    } catch (err: any) {
      console.error("Failed to update note:", err);
      if (showToast) showToast("Failed to update note.", "destructive");
    } finally {
      setIsUpdatingNote(false);
    }
  };

  // Helper: Delete note from list and sync
  const handleDeleteNote = async (noteId: string) => {
    const noteToDelete = notesList.find((n) => n.id === noteId);
    if (!noteToDelete) return;

    const updated = notesList.filter((n) => n.id !== noteId);
    setNotesList(updated);

    if (noteToDelete.type === "customer" || noteId === "customer_note") {
      form.setFieldValue("customer_note", "");
    }

    if (editingNoteId === noteId) {
      setEditingNoteId(null);
    }

    if (mode === "edit" && order?.id) {
      try {
        await deleteOrderNoteInDb(order.id, noteId, order);
        if (showToast) showToast("Note deleted successfully.", "success");
      } catch (err: any) {
        console.warn("Could not immediately sync note deletion:", err);
        if (showToast) showToast("Note removed from form. Click 'Save Changes' to finalize.", "info");
      }
    } else {
      if (showToast) showToast("Note removed.", "info");
    }
  };

  // Reference Code & Web Touchpoint
  const [refCodeInput, setRefCodeInput] = React.useState(
    order?.attribution?.inquiry_ref_code ? `#${order.attribution.inquiry_ref_code}` : ""
  );
  const [isSearchingRefCode, setIsSearchingRefCode] = React.useState(false);
  const [matchedInquiry, setMatchedInquiry] = React.useState<InquiryLookupResult | null>(null);

  React.useEffect(() => {
    if (open) {
      const existingRef = order?.attribution?.inquiry_ref_code;
      setRefCodeInput(existingRef ? `#${existingRef}` : "");
      setMatchedInquiry(null);
    }
  }, [open, order]);

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
        if (showToast) {
          showToast(`Matched web session: #${res.data.refCode}`, "success");
        }
        // Auto fill phone if empty
        const curPhone = form.getFieldValue("phone");
        if (res.data.customerPhone && !curPhone) {
          form.setFieldValue("phone", res.data.customerPhone);
        }
        // Auto match channel
        if (res.data.channel === "whatsapp") {
          form.setFieldValue("channel", "whatsapp");
        } else if (res.data.channel === "phone") {
          form.setFieldValue("channel", "phone");
        }
      } else {
        setMatchedInquiry(null);
        if (showToast) {
          showToast("No active web session found for this reference code.", "info");
        }
      }
    } catch (err: any) {
      if (showToast) {
        showToast(err.message || "Failed to search reference code", "destructive");
      }
    } finally {
      setIsSearchingRefCode(false);
    }
  };

  // TanStack Form instance
  const form = useForm({
    canSubmitWhenInvalid: true,
    defaultValues: {
      customer: (mode === "edit" && order?.customer ? order.customer : "") || "",
      phone: (mode === "edit" && order?.phone ? order.phone : "") || "",
      alternative_phone: (mode === "edit" && order?.alternative_phone ? order.alternative_phone : "") || "",
      different_shipping_recipient: mode === "edit" && Boolean(
        (order?.shipping_phone && order.shipping_phone !== order.phone) ||
        (order?.address?.phone && order.address.phone !== order.phone) ||
        (order?.address?.recipient_name && order.address.recipient_name !== order.customer) ||
        (order?.recipient_name && order.recipient_name !== order.customer)
      ),
      shipping_recipient_name: (mode === "edit" ? (order?.address?.recipient_name || order?.recipient_name || "") : "") || "",
      shipping_phone: (mode === "edit" ? (order?.address?.phone || order?.shipping_phone || "") : "") || "",
      email: (mode === "edit" && order?.email ? order.email : "") || "",
      division: (mode === "edit" && order?.address?.division ? order.address.division : "") || "",
      district: (mode === "edit" && order?.address?.district ? order.address.district : "") || "",
      address_line: (mode === "edit" && order?.address?.address_line ? order.address.address_line : "") || "",
      channel: (mode === "edit" ? (order?.channel || "phone") : "phone") as Order["channel"],
      method: (mode === "edit" ? (order?.method || "cod") : "cod") as Order["method"],
      status: (mode === "edit" ? (order?.status || "confirmed") : (defaultStatus || "confirmed")) as Order["status"],
      payment: (mode === "edit" ? (order?.payment || "unpaid") : "unpaid") as Order["payment"],
      fulfillment: (mode === "edit" ? (order?.fulfillment || "unfulfilled") : "unfulfilled") as Order["fulfillment"],
      shipping_total: mode === "edit" ? (order?.shipping_total ?? 120) : 120,
      discount_total: mode === "edit" ? (order?.discount_total ?? 0) : 0,
      amount_paid: mode === "edit" ? (order?.amount_paid ?? 0) : 0,
      customer_note: mode === "edit" ? (order?.customer_note || "") : "",
      staff_note: "",
      delivery_note: "",
      packaging_note: "",
      courier_name: mode === "edit" ? (order?.courier_name || "") : "",
      cancel_reason: mode === "edit" ? (order?.cancel_reason || "") : "",
      items: (mode === "edit" && order?.items ? order.items.map((it) => ({ ...it })) : []) as OrderItem[],
    },
    onSubmitInvalid: ({ formApi }) => {
      const currentStatus = formApi.getFieldValue("status");
      const fieldEntries = Object.entries(formApi.state.fieldMeta);
      const invalidEntry = fieldEntries.find(([fieldName, meta]) => {
        if (!meta?.errors || meta.errors.length === 0) return false;
        const isReq = isFieldRequiredForStatus(fieldName as any, currentStatus);
        const val = formApi.getFieldValue(fieldName as any) as unknown;
        const isStringEmpty = typeof val === "string" && (val as string).trim().length === 0;
        if (!isReq && (!val || isStringEmpty)) {
          return false;
        }
        return true;
      });
      const firstError = invalidEntry?.[1]?.errors?.[0];
      const errorMsg =
        typeof firstError === "string"
          ? firstError
          : (firstError as unknown as { message?: string })?.message || "Please complete all mandatory order fields before submitting.";
      if (showToast && errorMsg) {
        showToast(errorMsg, "destructive");
      }
    },
    onSubmit: async ({ value }) => {
      const validation = orderFormSchema.safeParse(value);
      if (!validation.success) {
        const firstIssue = validation.error.issues[0];
        const errorMsg = firstIssue?.message || "Please fix validation errors.";
        if (showToast) {
          showToast(errorMsg, "destructive");
        }
        return;
      }

      const valid = validation.data;
      setIsSubmitting(true);
      try {
        const subtotal = valid.items.reduce((sum, item) => sum + item.line_total, 0);
        const shipping_total = Number(valid.shipping_total) || 0;
        const discount_total = Number(valid.discount_total) || 0;
        const grand_total = Math.max(0, subtotal - discount_total + shipping_total);
        const nowStr = new Date().toISOString().replace("T", " ").slice(0, 16);

        let finalAmountPaid = Number(valid.amount_paid) || 0;
        if (valid.payment === "paid") {
          finalAmountPaid = grand_total;
        } else if (valid.payment === "unpaid") {
          finalAmountPaid = 0;
        } else if (valid.payment === "partially_paid") {
          finalAmountPaid = Math.min(grand_total, Math.max(0, finalAmountPaid));
        }

        const newNoteClean = pendingNoteRef.current.text.trim();
        const pendingType = pendingNoteRef.current.type;
        let extraStaffNote = valid.staff_note || "";
        let extraPackagingNote = valid.packaging_note || "";
        let extraCustomerNote = valid.customer_note || "";

        if (newNoteClean) {
          if (pendingType === "internal") {
            extraStaffNote = extraStaffNote ? `${extraStaffNote}\n${newNoteClean}` : newNoteClean;
          } else if (pendingType === "packaging") {
            extraPackagingNote = extraPackagingNote ? `${extraPackagingNote}\n${newNoteClean}` : newNoteClean;
          } else if (pendingType === "customer") {
            extraCustomerNote = extraCustomerNote ? `${extraCustomerNote}\n${newNoteClean}` : newNoteClean;
          }
        }

        if (mode === "create") {
          const prefix = orderPrefix || "MOL";
          const newId = `${prefix}-2610-0${1085 + ordersCount}`;
          const effectiveRecipientName = valid.different_shipping_recipient
            ? (valid.shipping_recipient_name?.trim() || valid.customer.trim())
            : valid.customer.trim();
          const effectiveShippingPhone = valid.different_shipping_recipient
            ? (valid.shipping_phone?.trim() || valid.phone.trim())
            : valid.phone.trim();

          const baseAttr = order?.attribution || {};
          let orderAttribution: Record<string, any> | undefined = undefined;
          if (matchedInquiry) {
            const meta = matchedInquiry.metaTracking || {};
            orderAttribution = {
              ...baseAttr,
              channel_source: valid.channel,
              inquiry_ref_code: matchedInquiry.refCode,
              fbp: matchedInquiry.fbp || meta.fbp || baseAttr.fbp || null,
              fbc: matchedInquiry.fbc || meta.fbc || baseAttr.fbc || null,
              client_ip: matchedInquiry.clientIp || meta.client_ip_address || baseAttr.client_ip || null,
              user_agent: meta.client_user_agent || baseAttr.user_agent || null,
              event_source_url: meta.event_source_url || null,
              meta_tracking: {
                ...meta,
                ...(baseAttr.meta_tracking || {}),
                fbp: matchedInquiry.fbp || meta.fbp || baseAttr.fbp || null,
                fbc: matchedInquiry.fbc || meta.fbc || baseAttr.fbc || null,
                client_ip_address: matchedInquiry.clientIp || meta.client_ip_address || null,
                matched_ref_code: matchedInquiry.refCode,
                matched_at: new Date().toISOString(),
              },
            };
          } else if (refCodeInput.trim()) {
            const cleanRef = extractRefToken(refCodeInput).replace(/^#/, "");
            orderAttribution = {
              ...baseAttr,
              channel_source: valid.channel,
              inquiry_ref_code: cleanRef,
              meta_tracking: {
                ...(baseAttr.meta_tracking || {}),
                matched_ref_code: cleanRef,
              },
            };
          } else {
            orderAttribution = Object.keys(baseAttr).length > 0 ? baseAttr : undefined;
          }

          const createdOrder: Order = {
            id: newId,
            customer: valid.customer.trim(),
            phone: valid.phone,
            alternative_phone: valid.alternative_phone || "",
            shipping_phone: effectiveShippingPhone,
            recipient_name: effectiveRecipientName,
            email: valid.email || "",
            address: {
              division: valid.division || "",
              district: valid.district || "",
              address_line: valid.address_line || "",
              recipient_name: effectiveRecipientName,
              phone: effectiveShippingPhone,
            },
            status: valid.status,
            payment: valid.payment,
            fulfillment: valid.fulfillment,
            method: valid.method,
            channel: valid.channel,
            subtotal,
            discount_total,
            shipping_total,
            grand_total,
            amount_paid: finalAmountPaid,
            currency: currency || "BDT",
            date: nowStr,
            customer_note: (() => {
              const custNoteInList = notesList.find((n) => n.type === "customer");
              if (custNoteInList) return custNoteInList.text.trim();
              if (newNoteClean && pendingType === "customer") return newNoteClean;
              return extraCustomerNote || valid.customer_note || "";
            })(),
            courier_name: valid.courier_name || "",
            cancel_reason: valid.cancel_reason || "",
            items: valid.items as OrderItem[],
            notes: (() => {
              const finalNotes: OrderNote[] = notesList.filter((n) => n.type !== "customer");
              if (newNoteClean && pendingType !== "customer") {
                finalNotes.unshift({
                  id: `note-${Date.now()}`,
                  author: "Admin Staff",
                  text: newNoteClean,
                  type: pendingType,
                  created_at: nowStr,
                });
              }
              if (valid.delivery_note && valid.delivery_note.trim()) {
                const hasDeliv = finalNotes.some(
                  (n) => (n.type === "delivery" || n.type === "delivery_note") && n.text.trim() === valid.delivery_note.trim()
                );
                if (!hasDeliv) {
                  finalNotes.push({
                    id: `note-deliv-${Date.now()}`,
                    author: "Admin Staff",
                    text: valid.delivery_note.trim(),
                    type: "delivery",
                    created_at: nowStr,
                  });
                }
              }
              if (finalNotes.length === 0) {
                finalNotes.push({
                  id: `note-${Date.now()}`,
                  author: "Admin Staff",
                  text: valid.items.length > 0
                    ? `Manual order created with ${valid.items.length} product(s) via ${valid.channel.toUpperCase()} channel.${valid.payment === "partially_paid" ? ` Partial advance payment: ৳ ${finalAmountPaid.toLocaleString()} recorded.` : ""}${valid.courier_name ? ` Assigned courier: ${valid.courier_name}.` : ""}`
                    : `Draft ${valid.status === "incomplete_order" ? "incomplete" : "pending"} order created without product items via ${valid.channel.toUpperCase()} channel.`,
                  type: "internal",
                  created_at: nowStr,
                });
              }
              return finalNotes;
            })(),
            events: [
              {
                id: `ev-${Date.now()}`,
                event_type: "placed",
                message: valid.items.length > 0
                  ? `Manual order created by staff (${valid.channel})${valid.courier_name ? ` via ${valid.courier_name}` : ""}`
                  : `Draft order created (${valid.status.replace(/_/g, " ")}) without items`,
                actor: "Admin Staff",
                created_at: nowStr,
              },
            ],
            attribution: orderAttribution,
          };

          await onSave(createdOrder, "create");
          onOpenChange(false);
        } else {
          if (!order) return;
          const editEvent: OrderEvent = {
            id: `ev-${Date.now()}`,
            event_type: "order_edited",
            message: `Order updated: ${valid.items.length} item(s), total ৳ ${grand_total.toLocaleString()}${valid.payment === "partially_paid" ? `, partial payment ৳ ${finalAmountPaid.toLocaleString()}` : ""}${valid.courier_name ? `, courier: ${valid.courier_name}` : ""}`,
            actor: "Admin Staff",
            created_at: nowStr,
          };

          // Filter out customer notes from notes table array (customer note lives in customer_note column)
          let updatedNotes: OrderNote[] = notesList.filter((n) => n.type !== "customer");
          if (newNoteClean && pendingType !== "customer") {
            updatedNotes.unshift({
              id: `note-${Date.now()}`,
              author: "Admin Staff",
              text: newNoteClean,
              type: pendingType,
              created_at: nowStr,
            });
          }
          if (valid.delivery_note && valid.delivery_note.trim()) {
            const hasDeliv = updatedNotes.some(
              (n) => (n.type === "delivery" || n.type === "delivery_note") && n.text.trim() === valid.delivery_note.trim()
            );
            if (!hasDeliv) {
              updatedNotes.unshift({
                id: `note-deliv-${Date.now()}`,
                author: "Admin Staff",
                text: valid.delivery_note.trim(),
                type: "delivery",
                created_at: nowStr,
              });
            }
          }

          const custNoteInList = notesList.find((n) => n.type === "customer");
          const finalCustomerNote = custNoteInList
            ? custNoteInList.text.trim()
            : newNoteClean && pendingType === "customer"
            ? newNoteClean
            : valid.customer_note || "";

          const effectiveRecipientName = valid.different_shipping_recipient
            ? (valid.shipping_recipient_name?.trim() || valid.customer.trim())
            : valid.customer.trim();
          const effectiveShippingPhone = valid.different_shipping_recipient
            ? (valid.shipping_phone?.trim() || valid.phone.trim())
            : valid.phone.trim();

          const updatedOrder: Order = {
            ...order,
            customer: valid.customer.trim(),
            phone: valid.phone,
            alternative_phone: valid.alternative_phone || "",
            shipping_phone: effectiveShippingPhone,
            recipient_name: effectiveRecipientName,
            email: valid.email || "",
            address: {
              ...(order.address || {}),
              division: valid.division || "",
              district: valid.district || "",
              address_line: valid.address_line || "",
              recipient_name: effectiveRecipientName,
              phone: effectiveShippingPhone,
            },
            status: valid.status,
            payment: valid.payment,
            fulfillment: valid.fulfillment,
            channel: valid.channel,
            method: valid.method,
            shipping_total,
            discount_total,
            subtotal,
            grand_total,
            amount_paid: finalAmountPaid,
            customer_note: finalCustomerNote,
            courier_name: valid.courier_name || order.courier_name || "",
            cancel_reason: valid.cancel_reason || "",
            items: valid.items as OrderItem[],
            notes: updatedNotes,
            events: [editEvent, ...(order.events || [])],
            attribution: (() => {
              const baseAttr = order.attribution || {};
              if (matchedInquiry) {
                const meta = matchedInquiry.metaTracking || {};
                return {
                  ...baseAttr,
                  channel_source: valid.channel,
                  inquiry_ref_code: matchedInquiry.refCode,
                  fbp: matchedInquiry.fbp || meta.fbp || baseAttr.fbp || null,
                  fbc: matchedInquiry.fbc || meta.fbc || baseAttr.fbc || null,
                  client_ip: matchedInquiry.clientIp || meta.client_ip_address || baseAttr.client_ip || null,
                  user_agent: meta.client_user_agent || baseAttr.user_agent || null,
                  event_source_url: meta.event_source_url || null,
                  meta_tracking: {
                    ...meta,
                    ...(baseAttr.meta_tracking || {}),
                    fbp: matchedInquiry.fbp || meta.fbp || baseAttr.fbp || null,
                    fbc: matchedInquiry.fbc || meta.fbc || baseAttr.fbc || null,
                    client_ip_address: matchedInquiry.clientIp || meta.client_ip_address || null,
                    matched_ref_code: matchedInquiry.refCode,
                    matched_at: new Date().toISOString(),
                  },
                };
              } else if (refCodeInput.trim()) {
                const cleanRef = extractRefToken(refCodeInput).replace(/^#/, "");
                return {
                  ...baseAttr,
                  inquiry_ref_code: cleanRef,
                };
              }
              return baseAttr;
            })(),
          };

          await onSave(updatedOrder, "edit");
          onOpenChange(false);
        }
      } catch (err: any) {
        console.error("Order submission error:", err);
        if (showToast) {
          showToast(err?.message || "Failed to save order", "destructive");
        }
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  // Sync form values whenever modal opens or active order changes
  React.useEffect(() => {
    if (open) {
      pendingNoteRef.current = { text: "", type: "internal" };
      setEditingNoteId(null);

      if (mode === "edit" && order) {
        const initialList: OrderNote[] = [];
        if (order.customer_note && order.customer_note.trim()) {
          initialList.push({
            id: "customer_note",
            author: order.customer || "Customer",
            text: order.customer_note.trim(),
            type: "customer",
            created_at: order.date || "Order Placed",
          });
        }
        if (order.notes && order.notes.length > 0) {
          order.notes.forEach((n) => {
            if (n.type === "customer" && initialList.some((ex) => ex.type === "customer")) {
              return;
            }
            initialList.push(n);
          });
        }
        setNotesList(initialList);

        const isDiffRecipient = Boolean(
          (order.shipping_phone && order.shipping_phone !== order.phone) ||
          (order.address?.phone && order.address.phone !== order.phone) ||
          (order.address?.recipient_name && order.address.recipient_name !== order.customer) ||
          (order.recipient_name && order.recipient_name !== order.customer)
        );
        const recipientName = order.address?.recipient_name || order.recipient_name || "";
        const shipPhone = order.address?.phone || order.shipping_phone || "";

        form.reset({
          customer: order.customer || "",
          phone: order.phone || "",
          alternative_phone: order.alternative_phone || "",
          different_shipping_recipient: isDiffRecipient,
          shipping_recipient_name: isDiffRecipient ? recipientName : "",
          shipping_phone: isDiffRecipient ? shipPhone : "",
          email: order.email || "",
          division: order.address?.division || "",
          district: order.address?.district || "",
          address_line: order.address?.address_line || "",
          channel: order.channel || "phone",
          method: order.method || "cod",
          status: order.status || "confirmed",
          payment: order.payment || "unpaid",
          fulfillment: order.fulfillment || "unfulfilled",
          shipping_total: order.shipping_total ?? 120,
          discount_total: order.discount_total ?? 0,
          amount_paid: order.amount_paid ?? 0,
          customer_note: order.customer_note || "",
          staff_note: "",
          delivery_note: "",
          packaging_note: "",
          courier_name: order.courier_name || "",
          cancel_reason: order.cancel_reason || "",
          items: order.items
            ? order.items.map((it) => ({
                ...it,
                package_type: it.package_type || detectItemPackageType(it.variant_name),
              }))
            : [],
        });
      } else {
        setNotesList([]);
        form.reset({
          customer: "",
          phone: "",
          alternative_phone: "",
          different_shipping_recipient: false,
          shipping_recipient_name: "",
          shipping_phone: "",
          email: "",
          division: "",
          district: "",
          address_line: "",
          channel: "phone",
          method: "cod",
          status: defaultStatus || "confirmed",
          payment: "unpaid",
          fulfillment: "unfulfilled",
          shipping_total: 120,
          discount_total: 0,
          amount_paid: 0,
          customer_note: "",
          staff_note: "",
          delivery_note: "",
          packaging_note: "",
          courier_name: "",
          cancel_reason: "",
          items: [],
        });
      }
    }
  }, [open, mode, order, defaultStatus, form]);

  // Group available catalog products by parent product
  const groupedCatalogProducts = React.useMemo(() => {
    const groups: {
      product_id: string;
      product_name: string;
      category: string;
      image: string;
      variants: CatalogProduct[];
    }[] = [];
    const groupMap = new Map<string, (typeof groups)[number]>();

    availableCatalogProducts.forEach((p) => {
      const key = p.product_id || p.product_name;
      let group = groupMap.get(key);
      if (!group) {
        group = {
          product_id: key,
          product_name: p.product_name,
          category: p.category,
          image: p.image,
          variants: [],
        };
        groupMap.set(key, group);
        groups.push(group);
      }
      group.variants.push(p);
    });

    return groups;
  }, [availableCatalogProducts]);

  // Smart-filtered grouped catalog products for product selection modal
  const filteredGroupedProducts = React.useMemo(() => {
    const q = productSearchQuery.toLowerCase().trim();
    const pkg = packageTypeFilter.toLowerCase();

    const results: typeof groupedCatalogProducts = [];

    groupedCatalogProducts.forEach((group) => {
      const productNameMatch = q ? group.product_name.toLowerCase().includes(q) : false;
      const categoryMatch = q ? group.category.toLowerCase().includes(q) : false;

      const matchingVariants = group.variants.filter((v) => {
        if (pkg !== "all") {
          const vPkg = detectItemPackageType(v.variant_name, v.pack_type).toLowerCase();
          if (vPkg !== pkg) return false;
        }

        if (!q) return true;
        if (productNameMatch || categoryMatch) return true;

        return (
          v.variant_name.toLowerCase().includes(q) ||
          v.sku.toLowerCase().includes(q)
        );
      });

      if (matchingVariants.length > 0) {
        results.push({
          ...group,
          variants: matchingVariants,
        });
      }
    });

    return results;
  }, [groupedCatalogProducts, productSearchQuery, packageTypeFilter]);

  // Flat list of currently visible/filtered variants for bulk selection
  const filteredCatalogProducts = React.useMemo(() => {
    return filteredGroupedProducts.flatMap((g) => g.variants);
  }, [filteredGroupedProducts]);

  // Memoized shallow selectors to prevent unnecessary re-rendering across the form tree
  const partialPaymentSelector = React.useMemo(
    () =>
      createShallowSelector((state: any) => ({
        payment: (state.values.payment || "unpaid") as Order["payment"],
        items: (state.values.items || []) as OrderItem[],
        shipping_total: (state.values.shipping_total ?? 0) as number,
        discount_total: (state.values.discount_total ?? 0) as number,
      })),
    []
  );

  const orderSummarySelector = React.useMemo(
    () =>
      createShallowSelector((state: any) => ({
        items: (state.values.items || []) as OrderItem[],
        shipping_total: (state.values.shipping_total ?? 0) as number,
        discount_total: (state.values.discount_total ?? 0) as number,
        payment: (state.values.payment || "unpaid") as Order["payment"],
        amount_paid: (state.values.amount_paid ?? 0) as number,
      })),
    []
  );

  const footerPayableSelector = React.useMemo(
    () =>
      createShallowSelector((state: any) => ({
        items: (state.values.items || []) as OrderItem[],
        shipping_total: (state.values.shipping_total ?? 0) as number,
        discount_total: (state.values.discount_total ?? 0) as number,
      })),
    []
  );

  // Open Product Selection Modal
  const handleOpenProductModal = () => {
    setSelectedModalProducts({});
    setProductSearchQuery("");
    setPackageTypeFilter("all");
    setIsProductModalOpen(true);
  };

  // Toggle selection button in modal
  const handleToggleProductSelection = (sku: string) => {
    const prod = availableCatalogProducts.find((p) => p.sku === sku);
    if (!prod) return;

    setSelectedModalProducts((prev) => {
      const next = { ...prev };
      if (next[sku] && next[sku].quantity > 0) {
        delete next[sku];
      } else {
        next[sku] = {
          quantity: 1,
          unit_price: prod.unit_price,
        };
      }
      return next;
    });
  };

  // Set quantity in product selection modal
  const handleSetModalProductQty = (sku: string, newQty: number) => {
    const prod = availableCatalogProducts.find((p) => p.sku === sku);
    if (!prod) return;

    setSelectedModalProducts((prev) => {
      const next = { ...prev };
      const safeQty = Math.max(0, Math.floor(newQty));
      if (safeQty === 0) {
        delete next[sku];
      } else {
        const existingPrice = prev[sku]?.unit_price ?? prod.unit_price;
        next[sku] = {
          quantity: safeQty,
          unit_price: existingPrice,
        };
      }
      return next;
    });
  };

  // Update unit price in modal (auto-selects with quantity 1 if currently unselected)
  const handleUpdateModalProductPrice = (sku: string, newPrice: number) => {
    const price = Math.max(0, newPrice);
    setSelectedModalProducts((prev) => {
      const existing = prev[sku];
      return {
        ...prev,
        [sku]: {
          quantity: existing && existing.quantity > 0 ? existing.quantity : 1,
          unit_price: price,
        },
      };
    });
  };

  // Select all filtered products in modal
  const handleSelectAllFiltered = () => {
    const next = { ...selectedModalProducts };
    filteredCatalogProducts.forEach((prod) => {
      if (!next[prod.sku] || next[prod.sku].quantity <= 0) {
        next[prod.sku] = { quantity: 1, unit_price: prod.unit_price };
      }
    });
    setSelectedModalProducts(next);
  };

  // Clear modal selections
  const handleClearSelection = () => {
    setSelectedModalProducts({});
  };

  // Batch confirm adding selected products to order form
  const handleConfirmAddProducts = () => {
    const entries = Object.entries(selectedModalProducts);
    if (entries.length === 0) {
      if (showToast) {
        showToast("Please select at least one product.", "destructive");
      }
      return;
    }

    const itemsToAdd: OrderItem[] = entries.map(([sku, config]) => {
      const prod = availableCatalogProducts.find((p) => p.sku === sku)!;
      const quantity = Math.max(1, config.quantity);
      const unit_price = Math.max(0, config.unit_price);
      return {
        id: `item-${Date.now()}-${sku}-${Math.random().toString(36).substring(2, 6)}`,
        sku: prod.sku,
        product_name: prod.product_name,
        variant_name: prod.variant_name,
        package_type: detectItemPackageType(prod.variant_name, prod.pack_type),
        quantity,
        unit_price,
        line_total: quantity * unit_price,
        variant_id: prod.variant_id,
        product_id: prod.product_id,
      };
    });

    const currentItems = form.getFieldValue("items") || [];
    const merged = [...currentItems];
    itemsToAdd.forEach((newItem) => {
      const existingIdx = merged.findIndex(
        (it) => it.sku === newItem.sku && it.unit_price === newItem.unit_price
      );
      if (existingIdx >= 0) {
        const q = merged[existingIdx].quantity + newItem.quantity;
        merged[existingIdx] = {
          ...merged[existingIdx],
          quantity: q,
          line_total: q * merged[existingIdx].unit_price,
        };
      } else {
        merged.push(newItem);
      }
    });

    form.setFieldValue("items", merged);
    try {
      form.validateField("items", "change");
    } catch {
      // Ignore
    }
    if (showToast) {
      showToast(`Added ${itemsToAdd.length} product(s) to order`, "success");
    }
    setIsProductModalOpen(false);
  };

  // Line item helpers
  const handleUpdateItemQty = (itemId: string, newQty: number) => {
    if (newQty < 1) return;
    const current = form.getFieldValue("items") || [];
    form.setFieldValue(
      "items",
      current.map((it) =>
        it.id === itemId
          ? { ...it, quantity: newQty, line_total: newQty * it.unit_price }
          : it
      )
    );
  };

  const handleUpdateItemPrice = (itemId: string, newPrice: number) => {
    const price = Math.max(0, newPrice);
    const current = form.getFieldValue("items") || [];
    form.setFieldValue(
      "items",
      current.map((it) =>
        it.id === itemId
          ? { ...it, unit_price: price, line_total: it.quantity * price }
          : it
      )
    );
  };

  const handleUpdateItemPackageType = (itemId: string, newPackageType: string) => {
    const current = form.getFieldValue("items") || [];
    form.setFieldValue(
      "items",
      current.map((it) => {
        if (it.id !== itemId) return it;
        let newVariantName = it.variant_name || "";
        if (/(jar|foil|bottle|box|pouch|drum|pail|jerrycan|tote|bag)/i.test(newVariantName)) {
          newVariantName = newVariantName.replace(
            /(glass jar|plastic jar|jar|foil pack|vacuum pouch|pouch|foil|plastic bottle|glass bottle|bottle|box|pail|drum|jerrycan|ibc tote|tote)/gi,
            newPackageType
          );
        } else {
          newVariantName = newVariantName ? `${newVariantName} (${newPackageType})` : newPackageType;
        }
        return {
          ...it,
          package_type: newPackageType,
          variant_name: newVariantName,
        };
      })
    );
  };

  const handleRemoveItem = (itemId: string) => {
    const current = form.getFieldValue("items") || [];
    form.setFieldValue(
      "items",
      current.filter((it) => it.id !== itemId)
    );
  };

  return (
    <>
      {/* UNIFIED ORDER FORM DIALOG (CREATE & EDIT) */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          id={mode === "edit" ? "dialog-content-edit-order" : "dialog-content-create-order"}
          className="w-[96vw] sm:w-[94vw] md:w-[92vw] lg:w-[90vw] xl:w-[86vw] max-w-7xl h-[96vh] max-h-[96vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8"
        >
          <DialogHeader className="border-b pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
                {mode === "edit" ? (
                  <>
                    <Edit className="h-5 w-5 text-amber-600" />
                    <span>Edit Order {order?.id}</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-5 w-5 text-amber-600" />
                    <span>Create Manual Order</span>
                  </>
                )}
              </DialogTitle>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-muted/60 border text-xs sm:text-sm text-muted-foreground font-medium w-fit">
                <Calendar className="h-4 w-4 text-amber-600 shrink-0" />
                <span className="text-muted-foreground">{mode === "edit" ? "Order Placed:" : "Order Date:"}</span>
                <span className="text-foreground font-semibold">
                  {order?.date ? formatDateTime(order.date) : formatDateTime(new Date())}
                </span>
              </div>
            </div>
            <DialogDescription>
              {mode === "edit"
                ? "Update customer contact info, shipping destination, payment, status, and purchased product quantities."
                : "Create a new order for phone, WhatsApp, or walk-in depot purchases."}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
            className="space-y-6 py-2"
          >
            <div className="space-y-6">
              {/* 1. CUSTOMER INFORMATION & DELIVERY ADDRESS (Combined Section) */}
              <div className="p-4 sm:p-5 rounded-xl bg-card border shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
                      <User className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Customer & Destination Details</h3>
                      <p className="text-[11px] text-muted-foreground">
                        Customer contact details and delivery destination address
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground hidden sm:flex items-center gap-1">
                    <Database className="h-3 w-3 text-emerald-600" />
                    {geoDivisions.length} Divisions • {geoDistricts.length} Districts (DB)
                  </span>
                </div>

                {/* Web / WhatsApp Reference Code Banner */}
                <div className="p-3 bg-muted/40 rounded-lg border border-dashed border-border/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="order_form_reference_id" className="text-xs font-medium flex items-center gap-1.5 text-foreground">
                      <Link2 className="h-3.5 w-3.5 text-amber-600" />
                      Web / WhatsApp Reference ID (ওয়েব সেশন রেফারেন্স)
                    </Label>
                    {matchedInquiry ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-600 border border-emerald-300">
                        <Check className="h-2.5 w-2.5" />
                        Linked: #{matchedInquiry.refCode}
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">
                        Links customer&apos;s website visit, ad click &amp; Meta ad cookies (_fbp/_fbc)
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Input
                      id="order_form_reference_id"
                      placeholder="e.g. #W-7391 or paste customer WhatsApp message"
                      value={refCodeInput}
                      onChange={(e) => setRefCodeInput(e.target.value)}
                      className="h-8 text-xs font-mono bg-background"
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
                      className="h-8 px-3 text-xs gap-1.5 shrink-0"
                    >
                      {isSearchingRefCode ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Link2 className="h-3 w-3" />
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
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>

                  {matchedInquiry && (
                    <div className="text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-500/5 p-2 rounded border border-emerald-500/20 flex flex-wrap items-center justify-between gap-2">
                      <span>
                        ✓ Origin: <strong>{matchedInquiry.channel.toUpperCase()}</strong> | 
                        Meta Tracking: <strong>{matchedInquiry.hasMetaTracking ? "Ad Click / Cookies Attached" : "Direct Web Traffic"}</strong>
                      </span>
                      <span className="text-muted-foreground font-mono text-[10px]">
                        Session: {new Date(matchedInquiry.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  )}
                </div>

                {/* Row 1: Customer Name & Contact Phone Numbers */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <form.Field
                    name="customer"
                    validators={{
                      onChangeListenTo: ["status"],
                      onBlurListenTo: ["status"],
                      onChange: ({ value }) => {
                        const status = form.getFieldValue("status");
                        const trimmed = (value || "").trim();
                        if (!isFieldRequiredForStatus("customer", status) && !trimmed) return undefined;
                        return validateWithZod(orderCustomerSchema)({ value: trimmed });
                      },
                      onBlur: ({ value }) => {
                        const status = form.getFieldValue("status");
                        const trimmed = (value || "").trim();
                        if (!isFieldRequiredForStatus("customer", status) && !trimmed) return undefined;
                        return validateWithZod(orderCustomerSchema)({ value: trimmed });
                      },
                      onSubmit: ({ value }) => {
                        const status = form.getFieldValue("status");
                        const trimmed = (value || "").trim();
                        if (!isFieldRequiredForStatus("customer", status) && !trimmed) return undefined;
                        return validateWithZod(orderCustomerSchema)({ value: trimmed });
                      },
                    }}
                  >
                    {(field) => (
                      <FormFieldItem>
                        <form.Subscribe selector={(state) => state.values.status}>
                          {(currentStatus) => (
                            <FormFieldLabel
                              htmlFor="order_form_customer_name"
                              required={isFieldRequiredForStatus("customer", currentStatus)}
                            >
                              Customer Name
                            </FormFieldLabel>
                          )}
                        </form.Subscribe>
                        <Input
                          id="order_form_customer_name"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                          placeholder="e.g. Modern Bakery Ltd / Rahim Ahmed"
                        />
                        <FormFieldError errors={field.state.meta.errors} />
                      </FormFieldItem>
                    )}
                  </form.Field>

                  <form.Field
                    name="phone"
                    validators={{
                      onChangeListenTo: ["status"],
                      onBlurListenTo: ["status"],
                      onChange: ({ value }) => {
                        const status = form.getFieldValue("status");
                        const cleaned = (value || "").replace(/[\s-]/g, "");
                        if (!isFieldRequiredForStatus("phone", status) && !cleaned) return undefined;
                        return validateWithZod(orderPhoneSchema)({ value: cleaned });
                      },
                      onBlur: ({ value }) => {
                        const status = form.getFieldValue("status");
                        const cleaned = (value || "").replace(/[\s-]/g, "");
                        if (!isFieldRequiredForStatus("phone", status) && !cleaned) return undefined;
                        return validateWithZod(orderPhoneSchema)({ value: cleaned });
                      },
                      onSubmit: ({ value }) => {
                        const status = form.getFieldValue("status");
                        const cleaned = (value || "").replace(/[\s-]/g, "");
                        if (!isFieldRequiredForStatus("phone", status) && !cleaned) return undefined;
                        return validateWithZod(orderPhoneSchema)({ value: cleaned });
                      },
                    }}
                  >
                    {(field) => (
                      <FormFieldItem>
                        <form.Subscribe selector={(state) => state.values.status}>
                          {(currentStatus) => (
                            <FormFieldLabel
                              htmlFor="order_form_customer_phone"
                              required={isFieldRequiredForStatus("phone", currentStatus)}
                            >
                              Phone Number
                            </FormFieldLabel>
                          )}
                        </form.Subscribe>
                        <Input
                          id="order_form_customer_phone"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                          placeholder="+88017XXXXXXXX"
                        />
                        <FormFieldError errors={field.state.meta.errors} />
                        {/* Steadfast Delivery Record below customer phone */}
                        <SteadfastDeliveryRecordBadge phone={field.state.value} variant="inline" />
                      </FormFieldItem>
                    )}
                  </form.Field>

                  <form.Field
                    name="alternative_phone"
                    validators={{
                      onChangeListenTo: ["phone"],
                      onBlurListenTo: ["phone"],
                      onChange: ({ value }) => {
                        const cleaned = (value || "").replace(/[\s-]/g, "");
                        if (!cleaned) return undefined;
                        const phone = form.getFieldValue("phone");
                        const cleanPhone = (phone || "").replace(/[\s-]/g, "");
                        if (cleanPhone && cleaned === cleanPhone) {
                          return "Alternative phone cannot be identical to primary phone";
                        }
                        return validateWithZod(orderAlternativePhoneSchema)({ value: cleaned });
                      },
                      onBlur: ({ value }) => {
                        const cleaned = (value || "").replace(/[\s-]/g, "");
                        if (!cleaned) return undefined;
                        const phone = form.getFieldValue("phone");
                        const cleanPhone = (phone || "").replace(/[\s-]/g, "");
                        if (cleanPhone && cleaned === cleanPhone) {
                          return "Alternative phone cannot be identical to primary phone";
                        }
                        return validateWithZod(orderAlternativePhoneSchema)({ value: cleaned });
                      },
                      onSubmit: ({ value }) => {
                        const cleaned = (value || "").replace(/[\s-]/g, "");
                        if (!cleaned) return undefined;
                        const phone = form.getFieldValue("phone");
                        const cleanPhone = (phone || "").replace(/[\s-]/g, "");
                        if (cleanPhone && cleaned === cleanPhone) {
                          return "Alternative phone cannot be identical to primary phone";
                        }
                        return validateWithZod(orderAlternativePhoneSchema)({ value: cleaned });
                      },
                    }}
                  >
                    {(field) => (
                      <FormFieldItem>
                        <FormFieldLabel htmlFor="order_form_alternative_phone">
                          Alternative Phone (Optional)
                        </FormFieldLabel>
                        <Input
                          id="order_form_alternative_phone"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                          placeholder="+88018XXXXXXXX"
                        />
                        <FormFieldError errors={field.state.meta.errors} />
                        {/* Steadfast Delivery Record below alternative phone */}
                        <SteadfastDeliveryRecordBadge phone={field.state.value} variant="inline" />
                      </FormFieldItem>
                    )}
                  </form.Field>
                </div>

                {/* Row 3: Geo Division & District */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <form.Field
                    name="division"
                    validators={{
                      onChangeListenTo: ["status"],
                      onBlurListenTo: ["status"],
                      onChange: ({ value }) => {
                        const status = form.getFieldValue("status");
                        const trimmed = (value || "").trim();
                        if (!isFieldRequiredForStatus("division", status) && !trimmed) return undefined;
                        return validateWithZod(orderDivisionSchema)({ value });
                      },
                      onBlur: ({ value }) => {
                        const status = form.getFieldValue("status");
                        const trimmed = (value || "").trim();
                        if (!isFieldRequiredForStatus("division", status) && !trimmed) return undefined;
                        return validateWithZod(orderDivisionSchema)({ value });
                      },
                      onSubmit: ({ value }) => {
                        const status = form.getFieldValue("status");
                        const trimmed = (value || "").trim();
                        if (!isFieldRequiredForStatus("division", status) && !trimmed) return undefined;
                        return validateWithZod(orderDivisionSchema)({ value });
                      },
                    }}
                  >
                    {(field) => (
                      <FormFieldItem>
                        <form.Subscribe selector={(state) => state.values.status}>
                          {(currentStatus) => (
                            <FormFieldLabel
                              htmlFor="order_form_division"
                              required={isFieldRequiredForStatus("division", currentStatus)}
                            >
                              Division
                            </FormFieldLabel>
                          )}
                        </form.Subscribe>
                        <Select
                          value={field.state.value || "none"}
                          onValueChange={(newDiv) => {
                            const val = !newDiv || newDiv === "none" ? "" : newDiv;
                            field.handleChange(val);
                            form.setFieldValue("district", "");
                          }}
                        >
                          <SelectTrigger id="order_form_division" className="w-full h-9 text-xs bg-background">
                            <SelectValue placeholder="Select Division" />
                          </SelectTrigger>
                          <SelectContent className="z-[70]">
                            <SelectItem value="none">Select Division</SelectItem>
                            {geoDivisions.map((div) => (
                              <SelectItem key={div.id} value={div.name}>
                                {div.name} {div.name_bn ? `(${div.name_bn})` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormFieldError errors={field.state.meta.errors} />
                      </FormFieldItem>
                    )}
                  </form.Field>

                  <form.Field
                    name="district"
                    validators={{
                      onChangeListenTo: ["status"],
                      onBlurListenTo: ["status"],
                      onChange: ({ value }) => {
                        const status = form.getFieldValue("status");
                        const trimmed = (value || "").trim();
                        if (!isFieldRequiredForStatus("district", status) && !trimmed) return undefined;
                        return validateWithZod(orderDistrictSchema)({ value });
                      },
                      onBlur: ({ value }) => {
                        const status = form.getFieldValue("status");
                        const trimmed = (value || "").trim();
                        if (!isFieldRequiredForStatus("district", status) && !trimmed) return undefined;
                        return validateWithZod(orderDistrictSchema)({ value });
                      },
                      onSubmit: ({ value }) => {
                        const status = form.getFieldValue("status");
                        const trimmed = (value || "").trim();
                        if (!isFieldRequiredForStatus("district", status) && !trimmed) return undefined;
                        return validateWithZod(orderDistrictSchema)({ value });
                      },
                    }}
                  >
                    {(field) => {
                      const currentDivName = form.getFieldValue("division") || "";
                      const currentDivObj = currentDivName
                        ? geoDivisions.find(
                          (d) => d.name.toLowerCase() === currentDivName.toLowerCase()
                        )
                        : undefined;

                      return (
                        <FormFieldItem className="flex flex-col">
                          <form.Subscribe selector={(state) => state.values.status}>
                            {(currentStatus) => (
                              <FormFieldLabel
                                htmlFor="order_form_district"
                                required={isFieldRequiredForStatus("district", currentStatus)}
                              >
                                District
                              </FormFieldLabel>
                            )}
                          </form.Subscribe>
                          <DistrictCombobox
                            id="order_form_district"
                            value={field.state.value}
                            onChange={(val) => field.handleChange(val)}
                            onBlur={field.handleBlur}
                            divisionId={currentDivObj?.id}
                            divisionName={currentDivName}
                            districts={geoDistricts}
                            onAddCustomDistrict={(customName) => {
                              if (
                                setGeoDistricts &&
                                !geoDistricts.some(
                                  (d) => d.name.toLowerCase() === customName.toLowerCase()
                                )
                              ) {
                                setGeoDistricts((prev) => [
                                  ...prev,
                                  {
                                    id: Date.now(),
                                    division_id: currentDivObj?.id || 1,
                                    name: customName,
                                    name_bn: customName,
                                  },
                                ]);
                              }
                              if (showToast) {
                                showToast(`Custom district "${customName}" selected`, "success");
                              }
                            }}
                          />
                          <FormFieldError errors={field.state.meta.errors} />
                        </FormFieldItem>
                      );
                    }}
                  </form.Field>
                </div>

                {/* Row 4: Street / Delivery Address Line (Full width) */}
                <form.Field
                  name="address_line"
                  validators={{
                    onChangeListenTo: ["status"],
                    onBlurListenTo: ["status"],
                    onChange: ({ value }) => {
                      const status = form.getFieldValue("status");
                      const trimmed = (value || "").trim();
                      if (!isFieldRequiredForStatus("address_line", status) && !trimmed) return undefined;
                      return validateWithZod(orderAddressLineSchema)({ value: trimmed });
                    },
                    onBlur: ({ value }) => {
                      const status = form.getFieldValue("status");
                      const trimmed = (value || "").trim();
                      if (!isFieldRequiredForStatus("address_line", status) && !trimmed) return undefined;
                      return validateWithZod(orderAddressLineSchema)({ value: trimmed });
                    },
                    onSubmit: ({ value }) => {
                      const status = form.getFieldValue("status");
                      const trimmed = (value || "").trim();
                      if (!isFieldRequiredForStatus("address_line", status) && !trimmed) return undefined;
                      return validateWithZod(orderAddressLineSchema)({ value: trimmed });
                    },
                  }}
                >
                  {(field) => (
                    <FormFieldItem>
                      <form.Subscribe selector={(state) => state.values.status}>
                        {(currentStatus) => (
                          <FormFieldLabel
                            htmlFor="order_form_address_line"
                            required={isFieldRequiredForStatus("address_line", currentStatus)}
                          >
                            Delivery Address Line
                          </FormFieldLabel>
                        )}
                      </form.Subscribe>
                      <Input
                        id="order_form_address_line"
                        placeholder="House/Plot, Road number, Area, Ward or Landmark"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                      />
                      <FormFieldError errors={field.state.meta.errors} />
                    </FormFieldItem>
                  )}
                </form.Field>

                {/* Ship to different recipient toggle & fields */}
                <div className="pt-3 border-t border-border/70">
                  <form.Field name="different_shipping_recipient">
                    {(field) => (
                      <div className="space-y-3">
                        <label
                          htmlFor="order_form_different_recipient"
                          className="flex items-center gap-2.5 cursor-pointer text-xs sm:text-sm font-medium text-foreground select-none hover:text-foreground/80 transition-colors"
                        >
                          <Checkbox
                            id="order_form_different_recipient"
                            checked={Boolean(field.state.value)}
                            onCheckedChange={(checked) => field.handleChange(Boolean(checked))}
                          />
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span>Ship to another recipient / different person</span>
                            <span className="text-[11px] text-muted-foreground font-normal">
                              (Recipient name & phone for delivery)
                            </span>
                          </span>
                        </label>

                        {field.state.value && (
                          <div className="p-3.5 rounded-lg bg-amber-500/5 border border-amber-500/20 space-y-3 animate-in fade-in-50 duration-200">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <form.Field
                                name="shipping_recipient_name"
                                validators={{
                                  onChange: validateWithZod(orderRecipientNameSchema),
                                  onBlur: validateWithZod(orderRecipientNameSchema),
                                }}
                              >
                                {(subField) => (
                                  <FormFieldItem>
                                    <FormFieldLabel htmlFor="order_form_shipping_recipient_name" required>
                                      Recipient Name
                                    </FormFieldLabel>
                                    <Input
                                      id="order_form_shipping_recipient_name"
                                      placeholder="e.g. Rahima Begum"
                                      value={subField.state.value}
                                      onChange={(e) => subField.handleChange(e.target.value)}
                                      onBlur={subField.handleBlur}
                                    />
                                    <FormFieldError errors={subField.state.meta.errors} />
                                  </FormFieldItem>
                                )}
                              </form.Field>

                              <form.Field
                                name="shipping_phone"
                                validators={{
                                  onChange: validateWithZod(orderShippingPhoneSchema),
                                  onBlur: validateWithZod(orderShippingPhoneSchema),
                                }}
                              >
                                {(subField) => (
                                  <FormFieldItem>
                                    <FormFieldLabel htmlFor="order_form_shipping_phone" required>
                                      Shipping Phone Number
                                    </FormFieldLabel>
                                    <Input
                                      id="order_form_shipping_phone"
                                      placeholder="01XXXXXXXXX"
                                      value={subField.state.value}
                                      onChange={(e) => subField.handleChange(e.target.value)}
                                      onBlur={subField.handleBlur}
                                    />
                                    <FormFieldError errors={subField.state.meta.errors} />
                                    {/* Steadfast Delivery Record badge for shipping phone */}
                                    <SteadfastDeliveryRecordBadge phone={subField.state.value} variant="inline" />
                                  </FormFieldItem>
                                )}
                              </form.Field>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </form.Field>
                </div>
              </div>

              {/* ORDER STATUS & CHANNEL SECTION (BELOW CUSTOMER & DESTINATION DETAILS) */}
              <div className="p-4 sm:p-5 rounded-xl bg-card border shadow-xs space-y-4">
                <div className="flex items-center gap-2 border-b pb-2.5">
                  <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
                    <RefreshCw className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Order Status, Channel & Date</h3>
                    <p className="text-[11px] text-muted-foreground">
                      Current workflow processing status, incoming order sales channel, and order placement timestamp
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-0.5">
                  <form.Field name="status">
                    {(field) => (
                      <FormFieldItem>
                        <FormFieldLabel htmlFor="order_form_status">Order Status</FormFieldLabel>
                        <Select
                          value={field.state.value}
                          onValueChange={(val) => {
                            if (!val) return;
                            const newStatus = val as Order["status"];
                            field.handleChange(newStatus);
                            setTimeout(() => {
                              const isDraft = newStatus === "incomplete_order" || newStatus === "pending";
                              if (isDraft) {
                                const clearIfEmpty = (fieldName: any) => {
                                  const val = form.getFieldValue(fieldName) as unknown;
                                  if (!val || (typeof val === "string" && !val.trim())) {
                                    form.setFieldMeta(fieldName, (prev) => ({
                                      ...prev,
                                      errorMap: {},
                                      errors: [],
                                    }));
                                  }
                                };
                                clearIfEmpty("customer");
                                clearIfEmpty("address_line");
                                clearIfEmpty("division");
                                clearIfEmpty("district");
                                clearIfEmpty("courier_name");
                                clearIfEmpty("cancel_reason");
                              }
                              form.validateField("customer", "change");
                              form.validateField("address_line", "change");
                              form.validateField("division", "change");
                              form.validateField("district", "change");
                              form.validateField("courier_name", "change");
                              form.validateField("cancel_reason", "change");
                              form.validateField("shipping_total", "change");
                            }, 0);
                          }}
                        >
                          <SelectTrigger id="order_form_status" className="w-full h-9 text-xs bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="z-[70]">
                            <SelectItem value="incomplete_order">Incomplete Order</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="confirmed">Confirmed</SelectItem>
                            <SelectItem value="processing">Processing</SelectItem>
                            <SelectItem value="shipped">Shipped</SelectItem>
                            <SelectItem value="delivered">Delivered</SelectItem>
                            <SelectItem value="partially_delivered">Partially Delivered</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                            <SelectItem value="returned">Returned</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormFieldItem>
                    )}
                  </form.Field>

                  <form.Field name="channel">
                    {(field) => (
                      <FormFieldItem>
                        <form.Subscribe selector={(state) => state.values.status}>
                          {(currentStatus) => (
                            <FormFieldLabel
                              htmlFor="order_form_channel"
                              required={isFieldRequiredForStatus("channel", currentStatus)}
                            >
                              Order Channel
                            </FormFieldLabel>
                          )}
                        </form.Subscribe>
                        <Select
                          value={field.state.value}
                          onValueChange={(val) => {
                            if (val) field.handleChange(val as Order["channel"]);
                          }}
                        >
                          <SelectTrigger id="order_form_channel" className="w-full h-9 text-xs bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="z-[70]">
                            <SelectItem value="phone">Phone Call</SelectItem>
                            <SelectItem value="whatsapp">WhatsApp</SelectItem>
                            <SelectItem value="walk_in">Walk-in Depot</SelectItem>
                            <SelectItem value="admin">Admin Desk</SelectItem>
                            <SelectItem value="web">Web Storefront</SelectItem>
                            <SelectItem value="facebook">Facebook Page</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormFieldItem>
                    )}
                  </form.Field>

                  <FormFieldItem>
                    <FormFieldLabel htmlFor="order_form_datetime_display">
                      Order Date & Time
                    </FormFieldLabel>
                    <div
                      id="order_form_datetime_display"
                      className="w-full h-9 rounded-lg border border-input bg-muted/40 px-3 flex items-center gap-2 text-sm text-foreground select-all"
                      title={order?.date ? `Order placed on ${formatDateTime(order.date)}` : `Current order timestamp`}
                    >
                      <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                      <span className="font-medium text-xs sm:text-sm truncate">
                        {order?.date ? formatDateTime(order.date) : formatDateTime(new Date())}
                      </span>
                    </div>
                  </FormFieldItem>
                </div>

                {/* Conditional Cancellation / Return Reason */}
                <form.Subscribe selector={(state) => state.values.status}>
                  {(status) => {
                    if (status !== "cancelled" && status !== "returned") return null;

                    return (
                      <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-2">
                        <form.Field
                          name="cancel_reason"
                          validators={{
                            onChangeListenTo: ["status"],
                            onBlurListenTo: ["status"],
                            onChange: ({ value }) => {
                              const curStatus = form.getFieldValue("status");
                              if (
                                isFieldRequiredForStatus("cancel_reason", curStatus) &&
                                (!value || value.trim().length < 3)
                              ) {
                                return `Please provide a reason for marking order as ${curStatus.replace("_", " ")}`;
                              }
                              return undefined;
                            },
                            onBlur: ({ value }) => {
                              const curStatus = form.getFieldValue("status");
                              if (
                                isFieldRequiredForStatus("cancel_reason", curStatus) &&
                                (!value || value.trim().length < 3)
                              ) {
                                return `Please provide a reason for marking order as ${curStatus.replace("_", " ")}`;
                              }
                              return undefined;
                            },
                            onSubmit: ({ value }) => {
                              const curStatus = form.getFieldValue("status");
                              if (
                                isFieldRequiredForStatus("cancel_reason", curStatus) &&
                                (!value || value.trim().length < 3)
                              ) {
                                return `Please provide a reason for marking order as ${curStatus.replace("_", " ")}`;
                              }
                              return undefined;
                            },
                          }}
                        >
                          {(field) => (
                            <FormFieldItem>
                              <FormFieldLabel
                                htmlFor="order_form_cancel_reason"
                                required={isFieldRequiredForStatus("cancel_reason", status)}
                                className="text-rose-900 dark:text-rose-200"
                              >
                                Reason for {status === "returned" ? "Return" : "Cancellation"}
                              </FormFieldLabel>
                              <Textarea
                                id="order_form_cancel_reason"
                                placeholder={
                                  status === "returned"
                                    ? "e.g. Defective seal, damaged in transit, customer refused delivery..."
                                    : "e.g. Customer changed mind, stock out, duplicate order..."
                                }
                                value={field.state.value}
                                onChange={(e) => field.handleChange(e.target.value)}
                                onBlur={field.handleBlur}
                                rows={2}
                                className="text-xs bg-background"
                              />
                              <FormFieldError errors={field.state.meta.errors} />
                            </FormFieldItem>
                          )}
                        </form.Field>
                      </div>
                    );
                  }}
                </form.Subscribe>
              </div>

              {/* 2. ORDER ITEMS SECTION (FULL WIDTH) */}
              <div className="p-4 sm:p-5 rounded-xl bg-card border shadow-xs space-y-4">
                <form.Subscribe selector={(state) => state.values.items}>
                  {(items) => {
                    const itemsSubtotal = items.reduce((sum, it) => sum + it.line_total, 0);

                    return (
                      <>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
                              <PackageCheck className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-semibold text-foreground">Purchased Order Items</h3>
                                <Badge variant="secondary" className="font-mono text-xs font-semibold px-2 py-0">
                                  {items.length} item{items.length !== 1 ? "s" : ""}
                                </Badge>
                                <form.Subscribe selector={(state) => state.values.status}>
                                  {(currStatus) =>
                                    isFieldRequiredForStatus("items", currStatus) ? (
                                      <span className="text-destructive font-bold text-sm" title="Required for confirmed orders">*</span>
                                    ) : null
                                  }
                                </form.Subscribe>
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                Products, variations, custom unit pricing, and item quantities
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-xs text-muted-foreground hidden sm:block">
                              Items Subtotal:{" "}
                              <span className="font-mono font-bold text-foreground">
                                ৳ {itemsSubtotal.toLocaleString()}
                              </span>
                            </div>
                            <Button
                              id={mode === "edit" ? "btn-open-product-modal-edit" : "btn-open-product-modal-create"}
                              type="button"
                              size="sm"
                              onClick={handleOpenProductModal}
                              className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8 cursor-pointer shadow-xs"
                            >
                              <Plus className="h-3.5 w-3.5 mr-1" />
                              Browse & Add Products
                            </Button>
                          </div>
                        </div>

                        {items.length === 0 ? (
                          <div className="p-8 text-center border-2 border-dashed rounded-xl bg-muted/20 space-y-3">
                            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center mx-auto text-amber-600">
                              <PackagePlus className="h-6 w-6" />
                            </div>
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-foreground">No Products Added Yet</p>
                              <form.Subscribe selector={(state) => state.values.status}>
                                {(currStatus) => (
                                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                                    {currStatus === "incomplete_order" || currStatus === "pending"
                                      ? "Items are optional for incomplete and pending orders. Add products now or later."
                                      : "Please select at least one product from the catalog to place or update this order."}
                                  </p>
                                )}
                              </form.Subscribe>
                            </div>
                            <Button
                              id="btn-browse-select-products"
                              type="button"
                              size="sm"
                              onClick={handleOpenProductModal}
                              className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8 cursor-pointer"
                            >
                              <Plus className="h-3.5 w-3.5 mr-1" />
                              Browse Catalog Products
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="overflow-x-auto rounded-lg border">
                              <table className="w-full text-left text-sm">
                                <thead className="bg-muted/60 text-muted-foreground uppercase text-xs font-semibold tracking-wider border-b">
                                  <tr>
                                    <th className="py-2.5 px-3">Product</th>
                                    <th className="py-2.5 px-3 w-32">Package Type</th>
                                    <th className="py-2.5 px-3 w-32">Unit Price (BDT)</th>
                                    <th className="py-2.5 px-3 w-36 text-center">Quantity</th>
                                    <th className="py-2.5 px-3 w-32 text-right">Line Total</th>
                                    <th className="py-2.5 px-3 w-14 text-center">Action</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                  {items.map((item) => {
                                    const catalogProd = availableCatalogProducts.find(
                                      (p) => p.sku === item.sku || p.variant_id === item.variant_id
                                    );
                                    const imgUrl = catalogProd?.image;

                                    return (
                                      <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                                        <td className="py-2.5 px-3">
                                          <div className="flex items-center gap-3">
                                            {imgUrl ? (
                                              <img
                                                src={imgUrl}
                                                alt={item.product_name}
                                                className="h-9 w-9 rounded-md object-cover border shrink-0 bg-muted"
                                              />
                                            ) : (
                                              <div className="h-9 w-9 rounded-md border flex items-center justify-center bg-muted/60 shrink-0 text-muted-foreground">
                                                <PackageCheck className="h-4 w-4" />
                                              </div>
                                            )}
                                            <div className="min-w-0">
                                              <p className="font-medium text-foreground text-sm truncate max-w-sm sm:max-w-md">
                                                {item.product_name}
                                              </p>
                                              <div className="flex items-center gap-1.5 mt-0.5">
                                                {item.variant_name && (
                                                  <Badge
                                                    variant="outline"
                                                    className="text-xs py-0.5 px-2 border-amber-600/30 text-amber-700 dark:text-amber-400 font-medium"
                                                  >
                                                    {item.variant_name}
                                                  </Badge>
                                                )}
                                                <span className="text-xs font-mono text-muted-foreground">
                                                  SKU: {item.sku}
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                        </td>
                                        <td className="py-2.5 px-3">
                                          <Select
                                            value={item.package_type || detectItemPackageType(item.variant_name)}
                                            onValueChange={(val) => {
                                              if (val) handleUpdateItemPackageType(item.id, val);
                                            }}
                                          >
                                            <SelectTrigger
                                              id={`select-item-package-type-${item.id}`}
                                              className="h-8 w-28 text-xs bg-background font-medium"
                                              title="Package Type"
                                            >
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="z-[70]">
                                              {PACKAGE_TYPES.map((pt) => (
                                                <SelectItem key={pt} value={pt}>
                                                  {pt}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </td>
                                        <td className="py-2.5 px-3">
                                          <div className="relative">
                                            <span className="absolute left-2.5 top-2 text-xs text-muted-foreground font-mono">
                                              ৳
                                            </span>
                                            <Input
                                              type="number"
                                              min="0"
                                              value={item.unit_price}
                                              onChange={(e) =>
                                                handleUpdateItemPrice(item.id, Number(e.target.value) || 0)
                                              }
                                              className="h-8 w-28 pl-5 text-sm font-mono font-medium"
                                              title="Editable unit price"
                                            />
                                          </div>
                                        </td>
                                        <td className="py-2.5 px-3">
                                          <div className="flex items-center justify-center gap-1.5">
                                            <Button
                                              id={`btn-item-qty-minus-${item.sku}`}
                                              type="button"
                                              variant="outline"
                                              size="icon-xs"
                                              className="h-6 w-6 cursor-pointer"
                                              onClick={() => handleUpdateItemQty(item.id, item.quantity - 1)}
                                              disabled={item.quantity <= 1}
                                            >
                                              <Minus className="h-3 w-3" />
                                            </Button>
                                            <span id={`item-qty-val-${item.sku}`} className="w-8 text-center font-bold font-mono text-sm">
                                              {item.quantity}
                                            </span>
                                            <Button
                                              id={`btn-item-qty-plus-${item.sku}`}
                                              type="button"
                                              variant="outline"
                                              size="icon-xs"
                                              className="h-6 w-6 cursor-pointer"
                                              onClick={() => handleUpdateItemQty(item.id, item.quantity + 1)}
                                            >
                                              <Plus className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        </td>
                                        <td className="py-2.5 px-3 text-right">
                                          <span className="font-mono font-semibold text-foreground text-sm">
                                            ৳ {item.line_total.toLocaleString()}
                                          </span>
                                        </td>
                                        <td className="py-2.5 px-3 text-center">
                                          <Button
                                            id={`btn-item-remove-${item.sku}`}
                                            type="button"
                                            variant="ghost"
                                            size="icon-xs"
                                            className="h-7 w-7 text-destructive hover:bg-destructive/10 cursor-pointer mx-auto"
                                            onClick={() => handleRemoveItem(item.id)}
                                            title="Remove item"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </Button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>

                            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 px-1">
                              <span>Total {items.length} product line{items.length !== 1 ? "s" : ""}</span>
                              <span>
                                Items Subtotal:{" "}
                                <strong className="text-foreground font-mono">
                                  ৳ {itemsSubtotal.toLocaleString()}
                                </strong>
                              </span>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  }}
                </form.Subscribe>
              </div>

              {/* 3. 2-COLUMN GRID BELOW ORDER ITEMS */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* LEFT COLUMN: Delivery Related Fields & Order Notes */}
                <div className="space-y-6 min-w-0">
                  {/* 3A. Delivery Related Fields Card */}
                  <div className="p-4 sm:p-5 rounded-xl bg-card border shadow-xs space-y-4">
                    <div className="flex items-center gap-2 border-b pb-2.5">
                      <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
                        <Truck className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">Delivery & Logistics</h3>
                        <p className="text-[11px] text-muted-foreground">
                          Courier service partner, fulfillment state, and delivery instructions
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3.5">
                      {/* Courier Service Partner */}
                      <form.Subscribe selector={(state) => state.values.status}>
                        {(status) => {
                          const needsCourier =
                            status === "processing" ||
                            status === "shipped" ||
                            status === "delivered" ||
                            status === "partially_delivered";

                          return (
                            <form.Field
                              name="courier_name"
                              validators={{
                                onChangeListenTo: ["status"],
                                onBlurListenTo: ["status"],
                                onChange: ({ value }) => {
                                  const curStatus = form.getFieldValue("status");
                                  if (
                                    isFieldRequiredForStatus("courier_name", curStatus) &&
                                    (!value || value.trim().length < 2)
                                  ) {
                                    return "Courier service name is required for processing or dispatched orders";
                                  }
                                  return undefined;
                                },
                                onBlur: ({ value }) => {
                                  const curStatus = form.getFieldValue("status");
                                  if (
                                    isFieldRequiredForStatus("courier_name", curStatus) &&
                                    (!value || value.trim().length < 2)
                                  ) {
                                    return "Courier service name is required for processing or dispatched orders";
                                  }
                                  return undefined;
                                },
                                onSubmit: ({ value }) => {
                                  const curStatus = form.getFieldValue("status");
                                  if (
                                    isFieldRequiredForStatus("courier_name", curStatus) &&
                                    (!value || value.trim().length < 2)
                                  ) {
                                    return "Courier service name is required for processing or dispatched orders";
                                  }
                                  return undefined;
                                },
                              }}
                            >
                              {(field) => {
                                const currentValue = field.state.value || "";
                                const isPreset = (BANGLADESH_COURIERS as readonly string[]).includes(currentValue);

                                return (
                                  <FormFieldItem>
                                    <div className="flex items-center justify-between">
                                      <FormFieldLabel
                                        htmlFor="order_form_courier_name"
                                        required={isFieldRequiredForStatus("courier_name", status)}
                                        className="flex items-center gap-1.5"
                                      >
                                        <Truck className="h-3.5 w-3.5 text-amber-600" />
                                        Courier / Logistics Partner
                                      </FormFieldLabel>
                                      {needsCourier && (
                                        <Badge
                                          variant="outline"
                                          className="text-[10px] font-semibold border-amber-500 text-amber-700 dark:text-amber-300"
                                        >
                                          Required for {status.replace("_", " ")}
                                        </Badge>
                                      )}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {/* Dropdown Preset Selector */}
                                      <Select
                                        value={isPreset ? currentValue : currentValue ? "other" : "none"}
                                        onValueChange={(val) => {
                                          if (!val || val === "none") {
                                            field.handleChange("");
                                          } else if (val !== "other") {
                                            field.handleChange(val);
                                          }
                                        }}
                                      >
                                        <SelectTrigger id="order_form_courier_select" className="w-full h-9 text-xs bg-background">
                                          <SelectValue placeholder="-- Choose Courier Service --" />
                                        </SelectTrigger>
                                        <SelectContent className="z-[70]">
                                          <SelectItem value="none">-- Choose Courier Service --</SelectItem>
                                          {BANGLADESH_COURIERS.map((c) => (
                                            <SelectItem key={c} value={c}>
                                              {c}
                                            </SelectItem>
                                          ))}
                                          <SelectItem value="other">Other / Custom Courier</SelectItem>
                                        </SelectContent>
                                      </Select>

                                      {/* Direct / Custom Input */}
                                      <Input
                                        id="order_form_courier_name"
                                        placeholder="Or type custom courier name..."
                                        value={field.state.value}
                                        onChange={(e) => field.handleChange(e.target.value)}
                                        onBlur={field.handleBlur}
                                        className="h-9 text-sm"
                                      />
                                    </div>

                                    {/* Preset Quick Buttons */}
                                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                                      {BANGLADESH_COURIERS.slice(0, 5).map((courierName) => (
                                        <button
                                          key={courierName}
                                          type="button"
                                          onClick={() => field.handleChange(courierName)}
                                          className={cn(
                                            "text-[11px] px-2 py-0.5 rounded-md border transition-colors cursor-pointer",
                                            currentValue === courierName
                                              ? "bg-amber-600 text-white border-amber-600 font-semibold"
                                              : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                                          )}
                                        >
                                          {courierName}
                                        </button>
                                      ))}
                                    </div>

                                    <FormFieldError errors={field.state.meta.errors} />
                                  </FormFieldItem>
                                );
                              }}
                            </form.Field>
                          );
                        }}
                      </form.Subscribe>

                      {/* Fulfillment Status */}
                      <form.Field name="fulfillment">
                        {(field) => (
                          <FormFieldItem>
                            <FormFieldLabel htmlFor="order_form_fulfillment">Fulfillment Status</FormFieldLabel>
                            <Select
                              value={field.state.value}
                              onValueChange={(val) => {
                                if (val) field.handleChange(val as Order["fulfillment"]);
                              }}
                            >
                              <SelectTrigger id="order_form_fulfillment" className="w-full h-9 text-xs bg-background">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="z-[70]">
                                <SelectItem value="unfulfilled">Unfulfilled</SelectItem>
                                <SelectItem value="partial">Partial Fulfillment</SelectItem>
                                <SelectItem value="fulfilled">Fulfilled</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormFieldItem>
                        )}
                      </form.Field>

                      {/* Delivery Instructions Note */}
                      <form.Field name="delivery_note">
                        {(field) => (
                          <FormFieldItem>
                            <FormFieldLabel htmlFor="order_form_delivery_note" className="flex items-center gap-1.5">
                              <Truck className="h-3.5 w-3.5 text-amber-600" />
                              Delivery Instructions for Courier / Dispatcher
                            </FormFieldLabel>
                            <Textarea
                              id="order_form_delivery_note"
                              placeholder="e.g. Call before delivery, gate passcode, delivery after 4 PM, floor instructions..."
                              value={field.state.value}
                              onChange={(e) => field.handleChange(e.target.value)}
                              onBlur={field.handleBlur}
                              rows={2}
                              className="text-xs bg-background"
                            />
                          </FormFieldItem>
                        )}
                      </form.Field>
                    </div>
                  </div>

                  {/* 3B. Order Notes Card: Previous Notes & Add New Note Option */}
                  <div className="p-4 sm:p-5 rounded-xl bg-card border shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b pb-2.5">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
                          <MessageSquare className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">Order Notes & History</h3>
                          <p className="text-[11px] text-muted-foreground">
                            Manage order notes: edit, delete, or record new notes
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {notesList.length} Note{notesList.length !== 1 ? "s" : ""}
                      </Badge>
                    </div>

                    {/* Notes List View */}
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-amber-600" />
                        Recorded Notes Timeline
                      </Label>

                      {notesList.length === 0 ? (
                        <div className="p-3.5 rounded-lg border border-dashed bg-muted/20 text-center text-xs text-muted-foreground">
                          No notes recorded for this order yet.
                        </div>
                      ) : (
                        <div className="max-h-56 overflow-y-auto space-y-2 pr-1 rounded-lg border p-2 bg-muted/10">
                          {notesList.map((n) => {
                            const isEditing = editingNoteId === n.id;

                            if (isEditing) {
                              return (
                                <OrderEditNoteItem
                                  key={n.id}
                                  note={n}
                                  onSave={handleSaveEditNote}
                                  onCancel={handleCancelEditNote}
                                  isUpdating={isUpdatingNote}
                                />
                              );
                            }

                            return (
                              <div
                                key={n.id}
                                className="group p-2.5 rounded-lg bg-card border text-xs space-y-1.5 hover:border-muted-foreground/30 transition-colors"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                                    {n.author}
                                  </span>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {n.type === "delivery" || n.type === "delivery_note" ? (
                                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-indigo-400 text-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-300">
                                        Delivery
                                      </Badge>
                                    ) : n.type === "packaging" || n.type === "packaging_note" ? (
                                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-emerald-400 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300">
                                        Packaging
                                      </Badge>
                                    ) : n.type === "system" || n.type === "system_note" ? (
                                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-sky-400 text-sky-700 bg-sky-50 dark:bg-sky-950/40 dark:text-sky-300">
                                        System
                                      </Badge>
                                    ) : n.type === "customer" ? (
                                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-blue-400 text-blue-700 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-300">
                                        Customer
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300">
                                        Staff
                                      </Badge>
                                    )}
                                    <span className="text-[10px] text-muted-foreground font-mono">{formatDateTime(n.created_at)}</span>

                                    {/* Edit and Delete Actions */}
                                    <div className="flex items-center gap-0.5 ml-1">
                                      <Button
                                        id={`btn-edit-note-${n.id}`}
                                        type="button"
                                        variant="ghost"
                                        size="icon-xs"
                                        className="h-6 w-6 text-muted-foreground hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50 cursor-pointer"
                                        onClick={() => handleStartEditNote(n)}
                                        title="Edit note"
                                      >
                                        <Edit className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        id={`btn-delete-note-${n.id}`}
                                        type="button"
                                        variant="ghost"
                                        size="icon-xs"
                                        className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                                        onClick={() => handleDeleteNote(n.id)}
                                        title="Delete note"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                                <p className="text-muted-foreground text-xs whitespace-pre-wrap">{n.text}</p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Add New Note Option Composer (isolated state to prevent re-rendering the whole dialog on typing) */}
                    <OrderNewNoteComposer
                      onAddNote={handleAddNote}
                      pendingNoteRef={pendingNoteRef}
                    />
                  </div>
                </div>

                {/* RIGHT COLUMN: Financial Related Fields & Final Calculation */}
                <div className="space-y-6 min-w-0">
                  {/* 3C. Financial Related Fields Card */}
                  <div className="p-4 sm:p-5 rounded-xl bg-card border shadow-xs space-y-4">
                    <div className="flex items-center gap-2 border-b pb-2.5">
                      <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
                        <CreditCard className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">Financial & Payment</h3>
                        <p className="text-[11px] text-muted-foreground">
                          Payment method, payment status, delivery charge, and discount
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <form.Field name="method">
                        {(field) => (
                          <FormFieldItem>
                            <form.Subscribe selector={(state) => state.values.status}>
                              {(currentStatus) => (
                                <FormFieldLabel
                                  htmlFor="order_form_method"
                                  required={isFieldRequiredForStatus("method", currentStatus)}
                                >
                                  Payment Method
                                </FormFieldLabel>
                              )}
                            </form.Subscribe>
                            <Select
                              value={field.state.value}
                              onValueChange={(val) => {
                                if (val) field.handleChange(val as Order["method"]);
                              }}
                            >
                              <SelectTrigger id="order_form_method" className="w-full h-9 text-xs bg-background">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="z-[70]">
                                <SelectItem value="cod">Cash on Delivery (COD)</SelectItem>
                                <SelectItem value="bkash">bKash</SelectItem>
                                <SelectItem value="nagad">Nagad</SelectItem>
                                <SelectItem value="rocket">Rocket</SelectItem>
                                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                <SelectItem value="cash">Cash</SelectItem>
                                <SelectItem value="card">Credit / Debit Card</SelectItem>
                                <SelectItem value="credit_terms">Credit Terms (Business)</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormFieldItem>
                        )}
                      </form.Field>

                      <form.Field name="payment">
                        {(field) => (
                          <FormFieldItem>
                            <FormFieldLabel htmlFor="order_form_payment">Payment Status</FormFieldLabel>
                            <Select
                              value={field.state.value}
                              onValueChange={(val) => {
                                if (!val) return;
                                const newPayment = val as Order["payment"];
                                field.handleChange(newPayment);

                                const items = form.state.values.items || [];
                                const subtotal = items.reduce((sum, it) => sum + it.line_total, 0);
                                const shipping = Number(form.state.values.shipping_total) || 0;
                                const discount = Number(form.state.values.discount_total) || 0;
                                const grandTotal = Math.max(0, subtotal - discount + shipping);

                                if (newPayment === "paid") {
                                  form.setFieldValue("amount_paid", grandTotal);
                                } else if (newPayment === "unpaid") {
                                  form.setFieldValue("amount_paid", 0);
                                } else if (newPayment === "partially_paid") {
                                  const curr = Number(form.state.values.amount_paid) || 0;
                                  if (curr <= 0 || curr >= grandTotal) {
                                    const half = Math.round(grandTotal / 2);
                                    form.setFieldValue("amount_paid", half > 0 ? half : 500);
                                  }
                                }
                              }}
                            >
                              <SelectTrigger id="order_form_payment" className="w-full h-9 text-xs bg-background">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="z-[70]">
                                <SelectItem value="unpaid">Unpaid</SelectItem>
                                <SelectItem value="partially_paid">Partially Paid</SelectItem>
                                <SelectItem value="paid">Paid</SelectItem>
                                <SelectItem value="refunded">Refunded</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormFieldItem>
                        )}
                      </form.Field>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <form.Field
                        name="shipping_total"
                        validators={{
                          onChangeListenTo: ["status"],
                          onBlurListenTo: ["status"],
                          onChange: ({ value }) => {
                            const status = form.getFieldValue("status");
                            if (!isFieldRequiredForStatus("shipping_total", status) && (value === undefined || value === null || isNaN(value))) {
                              return undefined;
                            }
                            return validateWithZod(orderShippingTotalSchema)({ value });
                          },
                          onBlur: ({ value }) => {
                            const status = form.getFieldValue("status");
                            if (!isFieldRequiredForStatus("shipping_total", status) && (value === undefined || value === null || isNaN(value))) {
                              return undefined;
                            }
                            return validateWithZod(orderShippingTotalSchema)({ value });
                          },
                          onSubmit: ({ value }) => {
                            const status = form.getFieldValue("status");
                            if (!isFieldRequiredForStatus("shipping_total", status) && (value === undefined || value === null || isNaN(value))) {
                              return undefined;
                            }
                            return validateWithZod(orderShippingTotalSchema)({ value });
                          },
                        }}
                      >
                        {(field) => (
                          <FormFieldItem>
                            <form.Subscribe selector={(state) => state.values.status}>
                              {(currentStatus) => (
                                <FormFieldLabel
                                  htmlFor="order_form_shipping_total"
                                  required={isFieldRequiredForStatus("shipping_total", currentStatus)}
                                >
                                  Delivery Charge (BDT)
                                </FormFieldLabel>
                              )}
                            </form.Subscribe>
                            <div className="relative">
                              <span className="absolute left-3 top-2 text-xs text-muted-foreground font-mono">
                                ৳
                              </span>
                              <Input
                                id="order_form_shipping_total"
                                type="number"
                                min="0"
                                value={field.state.value}
                                onChange={(e) => field.handleChange(Number(e.target.value) || 0)}
                                onBlur={field.handleBlur}
                                className="pl-7 font-mono font-medium h-9"
                              />
                            </div>
                            <FormFieldError errors={field.state.meta.errors} />
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              {[
                                { label: "Depot (৳0)", val: 0 },
                                { label: "Dhaka (৳120)", val: 120 },
                                { label: "Outside (৳200)", val: 200 },
                                { label: "Bulk (৳1,500)", val: 1500 },
                              ].map((preset) => (
                                <button
                                  key={preset.label}
                                  type="button"
                                  onClick={() => field.handleChange(preset.val)}
                                  className="text-[10px] px-1.5 py-0.5 rounded-md border bg-card hover:bg-muted transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
                                >
                                  {preset.label}
                                </button>
                              ))}
                            </div>
                          </FormFieldItem>
                        )}
                      </form.Field>

                      <form.Field
                        name="discount_total"
                        validators={{
                          onChange: validateWithZod(orderDiscountTotalSchema),
                          onBlur: validateWithZod(orderDiscountTotalSchema),
                        }}
                      >
                        {(field) => (
                          <FormFieldItem>
                            <FormFieldLabel htmlFor="order_form_discount_total">
                              Discount (BDT)
                            </FormFieldLabel>
                            <div className="relative">
                              <span className="absolute left-3 top-2 text-xs text-muted-foreground font-mono">
                                ৳
                              </span>
                              <Input
                                id="order_form_discount_total"
                                type="number"
                                min="0"
                                value={field.state.value}
                                onChange={(e) => field.handleChange(Number(e.target.value) || 0)}
                                onBlur={field.handleBlur}
                                className="pl-7 font-mono h-9"
                              />
                            </div>
                            <FormFieldError errors={field.state.meta.errors} />
                          </FormFieldItem>
                        )}
                      </form.Field>
                    </div>

                    {/* Partial Advance Payment (when partially_paid) */}
                    <form.Subscribe selector={partialPaymentSelector}>
                      {({ payment, items, shipping_total, discount_total }) => {
                        if (payment !== "partially_paid") return null;

                        const subtotal = items.reduce((sum, it) => sum + it.line_total, 0);
                        const shipping = Number(shipping_total) || 0;
                        const discount = Number(discount_total) || 0;
                        const grandTotal = Math.max(0, subtotal - discount + shipping);

                        return (
                          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                            <div className="flex items-center justify-between">
                              <FormFieldLabel htmlFor="order_form_amount_paid" className="text-amber-800 dark:text-amber-300 font-semibold flex items-center gap-1.5 normal-case tracking-normal">
                                <CreditCard className="h-4 w-4 text-amber-600" />
                                Partial Payment (Advance Received)
                              </FormFieldLabel>
                              <span className="text-xs font-mono font-medium text-amber-900 dark:text-amber-200">
                                Total: ৳ {grandTotal.toLocaleString()}
                              </span>
                            </div>

                            <form.Field
                              name="amount_paid"
                              validators={{
                                onChange: validateWithZod(orderAmountPaidSchema),
                                onBlur: validateWithZod(orderAmountPaidSchema),
                              }}
                            >
                              {(field) => {
                                const currentPaid = Number(field.state.value) || 0;
                                const due = Math.max(0, grandTotal - currentPaid);

                                return (
                                  <div className="space-y-2">
                                    <div className="relative">
                                      <span className="absolute left-3 top-2.5 text-sm font-bold text-muted-foreground font-mono">
                                        ৳
                                      </span>
                                      <Input
                                        id="order_form_amount_paid"
                                        type="number"
                                        min="0"
                                        max={grandTotal}
                                        value={field.state.value === 0 ? "" : field.state.value}
                                        onChange={(e) => {
                                          const val = e.target.value === "" ? 0 : Number(e.target.value);
                                          field.handleChange(val);
                                        }}
                                        onBlur={field.handleBlur}
                                        placeholder="Enter partial amount received..."
                                        className="pl-7 font-mono font-bold text-base h-10 bg-background"
                                      />
                                    </div>
                                    <FormFieldError errors={field.state.meta.errors} />

                                    {/* Preset Quick Fill Buttons */}
                                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                      <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mr-1">
                                        Quick Fill:
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => field.handleChange(500)}
                                        className="px-2 py-0.5 rounded-md border text-xs font-mono bg-background hover:bg-muted font-medium transition-colors cursor-pointer"
                                      >
                                        ৳ 500
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => field.handleChange(1000)}
                                        className="px-2 py-0.5 rounded-md border text-xs font-mono bg-background hover:bg-muted font-medium transition-colors cursor-pointer"
                                      >
                                        ৳ 1,000
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => field.handleChange(Math.round(grandTotal * 0.5))}
                                        className="px-2 py-0.5 rounded-md border text-xs font-mono bg-background hover:bg-muted font-medium transition-colors cursor-pointer"
                                      >
                                        50% (৳ {Math.round(grandTotal * 0.5).toLocaleString()})
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => field.handleChange(Math.round(grandTotal * 0.25))}
                                        className="px-2 py-0.5 rounded-md border text-xs font-mono bg-background hover:bg-muted font-medium transition-colors cursor-pointer"
                                      >
                                        25% (৳ {Math.round(grandTotal * 0.25).toLocaleString()})
                                      </button>
                                    </div>

                                    {/* Breakdown Badges */}
                                    <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                                      <div className="p-2.5 rounded-lg bg-background/90 border border-emerald-500/20 space-y-0.5">
                                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                                          Paid Now
                                        </span>
                                        <p className="font-mono font-bold text-sm text-emerald-600">
                                          ৳ {currentPaid.toLocaleString()}
                                        </p>
                                      </div>
                                      <div className="p-2.5 rounded-lg bg-background/90 border border-rose-500/20 space-y-0.5">
                                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                                          Remaining Due (COD)
                                        </span>
                                        <p className={`font-mono font-bold text-sm ${due > 0 ? "text-rose-600" : "text-muted-foreground"}`}>
                                          ৳ {due.toLocaleString()}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                );
                              }}
                            </form.Field>
                          </div>
                        );
                      }}
                    </form.Subscribe>
                  </div>

                  {/* 3D. Final Calculation Summary Card */}
                  <div className="p-4 sm:p-5 rounded-xl bg-card border shadow-xs space-y-3">
                    <div className="flex items-center justify-between border-b pb-2.5">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
                          <Receipt className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">Final Calculation</h3>
                          <p className="text-[11px] text-muted-foreground">Live order summary and payable balance</p>
                        </div>
                      </div>
                    </div>

                    <form.Subscribe selector={orderSummarySelector}>
                      {({ items, shipping_total, discount_total, payment, amount_paid }) => {
                        const subtotal = items.reduce((sum, it) => sum + it.line_total, 0);
                        const shipping = Number(shipping_total) || 0;
                        const discount = Number(discount_total) || 0;
                        const grandTotal = Math.max(0, subtotal - discount + shipping);
                        const paid = Number(amount_paid) || 0;
                        const due = Math.max(0, grandTotal - paid);

                        return (
                          <div className="space-y-2 text-xs pt-1">
                            <div className="flex justify-between text-muted-foreground">
                              <span>Items Subtotal ({items.length} item{items.length !== 1 ? "s" : ""})</span>
                              <span className="font-mono font-medium text-foreground">৳ {subtotal.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground">
                              <span>Delivery Charge</span>
                              <span className="font-mono font-medium text-foreground">+ ৳ {shipping.toLocaleString()}</span>
                            </div>
                            {discount > 0 && (
                              <div className="flex justify-between text-emerald-600 font-medium">
                                <span>Discount Applied</span>
                                <span className="font-mono">- ৳ {discount.toLocaleString()}</span>
                              </div>
                            )}

                            <div className="border-t pt-2.5 mt-2 flex justify-between items-baseline font-bold text-base text-foreground">
                              <span>Net Total Payable</span>
                              <span className="font-mono text-lg text-amber-600 dark:text-amber-400">
                                ৳ {grandTotal.toLocaleString()}
                              </span>
                            </div>

                            {payment === "partially_paid" ? (
                              <div className="pt-2 border-t border-dashed space-y-1.5">
                                <div className="flex justify-between text-emerald-600 font-medium">
                                  <span>Advance Paid:</span>
                                  <span className="font-mono font-semibold">৳ {paid.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-rose-600 font-bold">
                                  <span>Due on Delivery (COD):</span>
                                  <span className="font-mono font-bold">৳ {due.toLocaleString()}</span>
                                </div>
                              </div>
                            ) : payment === "paid" ? (
                              <div className="pt-2 border-t border-dashed flex justify-between items-center text-emerald-600 font-semibold text-xs">
                                <span>Payment Status:</span>
                                <Badge variant="outline" className="border-emerald-500 text-emerald-600 bg-emerald-500/10 font-mono text-[11px]">
                                  Fully Paid (৳ 0 Due)
                                </Badge>
                              </div>
                            ) : (
                              <div className="pt-2 border-t border-dashed flex justify-between items-center text-muted-foreground text-xs">
                                <span>Payment Status:</span>
                                <span className="font-mono font-semibold text-foreground">Due on Delivery (৳ {grandTotal.toLocaleString()})</span>
                              </div>
                            )}
                          </div>
                        );
                      }}
                    </form.Subscribe>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-4 border-t sticky bottom-0 bg-popover/95 backdrop-blur-xs z-20 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 pb-4 sm:pb-5 mt-6 flex items-center justify-between sm:justify-between">
              <form.Subscribe selector={footerPayableSelector}>
                {({ items, shipping_total, discount_total }) => {
                  const subtotal = items.reduce((sum, it) => sum + it.line_total, 0);
                  const shipping = Number(shipping_total) || 0;
                  const discount = Number(discount_total) || 0;
                  const grandTotal = Math.max(0, subtotal - discount + shipping);
                  return (
                    <div className="text-left hidden sm:block">
                      <span className="text-[11px] text-muted-foreground block">Net Payable</span>
                      <span className="font-mono font-bold text-sm sm:text-base text-amber-600 dark:text-amber-400">
                        ৳ {grandTotal.toLocaleString()}
                      </span>
                    </div>
                  );
                }}
              </form.Subscribe>

              <div className="flex items-center gap-2 ml-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  id="btn-submit-order-form"
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
                >
                  {isSubmitting
                    ? (mode === "edit" ? "Saving..." : "Placing Order...")
                    : mode === "edit"
                      ? "Save Changes"
                      : "Place Order"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* PRODUCT SELECTION MODAL (SHARED FOR CATALOG BROWSING) */}
      <Dialog open={isProductModalOpen} onOpenChange={setIsProductModalOpen}>
        <DialogContent
          id="dialog-content-product-selection"
          overlayClassName="z-[55]"
          className="z-[60] w-screen h-[100dvh] max-w-none max-h-none rounded-none md:rounded-xl md:w-[70vw] md:max-w-[70vw] md:h-[95vh] md:max-h-[95vh] lg:w-[80vw] lg:max-w-[80vw] lg:h-[95vh] lg:max-h-[95vh] overflow-hidden flex flex-col p-3 sm:p-4 md:p-6"
        >
          {(() => {
            const selectedEntries = Object.entries(selectedModalProducts).filter(
              ([, cfg]) => cfg.quantity > 0
            );
            const selectedCount = selectedEntries.length;
            const totalUnits = selectedEntries.reduce((sum, [, cfg]) => sum + cfg.quantity, 0);
            const combinedTotal = selectedEntries.reduce(
              (sum, [, cfg]) => sum + cfg.quantity * cfg.unit_price,
              0
            );

            return (
              <>
                <DialogHeader className="border-b pb-3 shrink-0">
                  <div className="flex items-center justify-between">
                    <DialogTitle className="flex items-center gap-2 text-lg">
                      <PackageCheck className="h-5 w-5 text-amber-600" />
                      Select Products & Quantities
                    </DialogTitle>
                    {selectedCount > 0 && (
                      <Badge className="bg-amber-600 text-white font-mono text-xs">
                        {selectedCount} selected ({totalUnits} units)
                      </Badge>
                    )}
                  </div>
                  <DialogDescription>
                    Browse products, select variations, adjust unit prices and quantities for this order. Setting quantity or price automatically selects the variation.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-3 flex-1 overflow-hidden flex flex-col min-h-0">
                  {/* Search and Bulk Selection Controls */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
                    <div className="relative flex-1 min-w-0">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="product-search-input"
                        placeholder="Search products by name, variant, category, or SKU..."
                        value={productSearchQuery}
                        onChange={(e) => setProductSearchQuery(e.target.value)}
                        className="pl-8 h-9 text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Select
                        value={packageTypeFilter}
                        onValueChange={(val) => {
                          if (val) setPackageTypeFilter(val);
                        }}
                      >
                        <SelectTrigger id="modal-package-type-filter" className="h-9 text-xs font-medium w-32 bg-background">
                          <SelectValue placeholder="All Packaging" />
                        </SelectTrigger>
                        <SelectContent className="z-[70]">
                          <SelectItem value="all">All Packaging</SelectItem>
                          <SelectItem value="jar">Jar</SelectItem>
                          <SelectItem value="foil">Foil</SelectItem>
                          <SelectItem value="bottle">Bottle</SelectItem>
                          <SelectItem value="box">Box</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        id="btn-modal-select-all"
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleSelectAllFiltered}
                        className="h-9 text-xs cursor-pointer"
                      >
                        <CheckSquare className="h-3.5 w-3.5 mr-1 text-amber-600" />
                        Select All Filtered
                      </Button>
                      {selectedCount > 0 && (
                        <Button
                          id="btn-modal-clear"
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleClearSelection}
                          className="h-9 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          Clear All
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Header labels */}
                  <div className="hidden sm:flex items-center justify-between text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-3 shrink-0">
                    <div className="flex-1">Product Details & Stock</div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="w-28 text-right">Price</span>
                      <span className="w-28 text-center">Quantity</span>
                      <span className="w-20 text-right">Subtotal</span>
                    </div>
                  </div>

                  {/* Grouped Product Cards List */}
                  <div className="flex-1 overflow-y-auto pr-1 space-y-3 min-h-0 pb-4">
                    {filteredGroupedProducts.length === 0 ? (
                      <div className="p-8 text-center border border-dashed rounded-xl bg-muted/20 space-y-2">
                        <PackageCheck className="h-8 w-8 text-muted-foreground mx-auto" />
                        <p className="text-sm font-medium text-foreground">No Products Found</p>
                        <p className="text-xs text-muted-foreground">
                          No catalog products match your search query &quot;{productSearchQuery}&quot;.
                        </p>
                      </div>
                    ) : (
                      filteredGroupedProducts.map((group) => {
                        const groupSelectedVariants = group.variants.filter(
                          (v) => (selectedModalProducts[v.sku]?.quantity ?? 0) > 0
                        );
                        const groupSelectedCount = groupSelectedVariants.length;

                        return (
                          <div
                            key={group.product_id}
                            className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-2xs transition-all"
                          >
                            {/* Parent Product Header: Image BEFORE Product Name, Category & Variant Count */}
                            <div className="flex items-center justify-between gap-3 p-2.5 sm:p-3 bg-muted/30 border-b border-border/60">
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="relative w-11 h-11 sm:w-13 sm:h-13 rounded-lg overflow-hidden border bg-background shrink-0 shadow-xs">
                                  <img
                                    src={group.image}
                                    alt={group.product_name}
                                    className="w-full h-full object-cover object-center"
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = "none";
                                    }}
                                  />
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                    <h4 className="font-semibold text-sm sm:text-base text-foreground leading-tight">
                                      {group.product_name}
                                    </h4>
                                    <Badge
                                      variant="secondary"
                                      className="text-[10px] py-0 px-1.5 h-4.5 font-medium shrink-0"
                                    >
                                      {group.category}
                                    </Badge>
                                    {groupSelectedCount > 0 && (
                                      <Badge
                                        className="bg-amber-600/90 text-white text-[10px] py-0 px-1.5 h-4.5 font-mono shrink-0"
                                      >
                                        {groupSelectedCount} {groupSelectedCount === 1 ? "variant" : "variants"} selected
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-muted-foreground mt-0.5">
                                    {group.variants.length} {group.variants.length === 1 ? "variation" : "variations"}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Variations List Nested Underneath */}
                            <div className="divide-y divide-border/40">
                              {group.variants.map((variant) => {
                                const selectedConfig = selectedModalProducts[variant.sku];
                                const isSelected = Boolean(selectedConfig && selectedConfig.quantity > 0);
                                const currentQty = selectedConfig?.quantity ?? 0;
                                const currentPrice = selectedConfig?.unit_price ?? variant.unit_price;
                                const lineTotal = currentQty * currentPrice;

                                return (
                                  <div
                                    key={variant.sku}
                                    id={`catalog-product-row-${variant.sku}`}
                                    className={cn(
                                      "flex flex-col sm:flex-row items-start sm:items-center justify-between p-2.5 sm:px-3.5 sm:py-2.5 transition-colors gap-2.5 sm:gap-3",
                                      isSelected
                                        ? "bg-amber-500/10 dark:bg-amber-500/15"
                                        : "hover:bg-muted/30"
                                    )}
                                  >
                                    {/* Left: Checkbox + Variant info */}
                                    <div className="flex items-center gap-2.5 min-w-0 flex-1 w-full sm:w-auto">
                                      <Button
                                        type="button"
                                        id={`btn-select-product-${variant.sku}`}
                                        variant={isSelected ? "default" : "outline"}
                                        size="icon-xs"
                                        onClick={() => handleToggleProductSelection(variant.sku)}
                                        className={cn(
                                          "w-6 h-6 sm:w-7 sm:h-7 rounded-lg shrink-0 transition-all cursor-pointer",
                                          isSelected
                                            ? "bg-amber-600 hover:bg-amber-700 text-white shadow-xs border-amber-600"
                                            : "hover:border-amber-500 hover:bg-amber-500/10 text-muted-foreground border-border/80"
                                        )}
                                        title={isSelected ? "Deselect variation (sets qty to 0)" : "Select variation (sets qty to 1)"}
                                      >
                                        {isSelected ? (
                                          <Check className="h-3.5 w-3.5 stroke-[3]" />
                                        ) : (
                                          <Square className="h-3 w-3 text-muted-foreground/60" />
                                        )}
                                      </Button>

                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                          <span className="font-semibold text-xs sm:text-sm text-foreground">
                                            {variant.variant_name}
                                          </span>
                                          <span className="font-mono text-[11px] text-muted-foreground/80">SKU: {variant.sku}</span>
                                          <Badge
                                            variant="outline"
                                            className="text-[10px] h-4 py-0 px-1.5 font-medium bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                                          >
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                                            {variant.stock}
                                          </Badge>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Right: Unit Price (Always Editable) + Qty Stepper + Line Subtotal */}
                                    <div className="flex items-center justify-between sm:justify-end gap-2.5 sm:gap-3 w-full sm:w-auto shrink-0 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-border/40">
                                      <div className="text-left sm:text-right min-w-[105px]">
                                        <div className="flex items-center sm:justify-end gap-1">
                                          <span className="text-[11px] text-muted-foreground">Price:</span>
                                          <div className="flex items-center gap-0.5">
                                            <span className="font-mono font-bold text-xs text-amber-700 dark:text-amber-400">৳</span>
                                            <Input
                                              id={`input-product-price-${variant.sku}`}
                                              type="number"
                                              min="0"
                                              value={currentPrice}
                                              onChange={(e) =>
                                                handleUpdateModalProductPrice(variant.sku, Math.max(0, Number(e.target.value) || 0))
                                              }
                                              className="h-7 w-20 text-xs px-1.5 py-0 font-mono font-semibold"
                                              title="Adjust unit price for this order"
                                            />
                                          </div>
                                        </div>
                                        {currentPrice !== variant.unit_price && (
                                          <button
                                            type="button"
                                            onClick={() => handleUpdateModalProductPrice(variant.sku, variant.unit_price)}
                                            className="text-[10px] text-amber-600 hover:underline block sm:text-right mt-0.5 cursor-pointer"
                                          >
                                            Reset (৳ {variant.unit_price.toLocaleString()})
                                          </button>
                                        )}
                                      </div>

                                      {/* Quantity Stepper */}
                                      <div className="flex items-center gap-0.5 sm:gap-1 shrink-0 bg-background/80 p-0.5 sm:p-1 rounded-lg border">
                                        <Button
                                          type="button"
                                          id={`btn-qty-minus-${variant.sku}`}
                                          variant="ghost"
                                          size="icon-xs"
                                          className="h-6.5 w-6.5 sm:h-7 sm:w-7 text-muted-foreground hover:text-foreground cursor-pointer"
                                          onClick={() => handleSetModalProductQty(variant.sku, currentQty - 1)}
                                          disabled={currentQty === 0}
                                          title={currentQty === 1 ? "Reduce to 0 (deselects variant)" : "Decrease quantity"}
                                        >
                                          <Minus className="h-3.5 w-3.5" />
                                        </Button>

                                        <Input
                                          id={`input-product-qty-${variant.sku}`}
                                          type="number"
                                          min="0"
                                          value={currentQty === 0 ? "0" : currentQty}
                                          onChange={(e) => {
                                            const val = Number(e.target.value);
                                            handleSetModalProductQty(variant.sku, isNaN(val) ? 0 : Math.max(0, val));
                                          }}
                                          className={cn(
                                            "h-6.5 w-11 sm:h-7 sm:w-12 text-center font-bold font-mono text-xs px-1 border-0 focus-visible:ring-1",
                                            isSelected ? "text-foreground font-black" : "text-muted-foreground"
                                          )}
                                        />

                                        <Button
                                          type="button"
                                          id={`btn-qty-plus-${variant.sku}`}
                                          variant="ghost"
                                          size="icon-xs"
                                          className="h-6.5 w-6.5 sm:h-7 sm:w-7 text-muted-foreground hover:text-amber-600 cursor-pointer"
                                          onClick={() => handleSetModalProductQty(variant.sku, currentQty + 1)}
                                          title={currentQty === 0 ? "Add 1 (selects variant)" : "Increase quantity"}
                                        >
                                          <Plus className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>

                                      {/* Subtotal */}
                                      <div className="w-18 sm:w-20 text-right font-mono font-bold text-xs shrink-0">
                                        {isSelected ? (
                                          <span className="text-amber-700 dark:text-amber-400">
                                            ৳ {lineTotal.toLocaleString()}
                                          </span>
                                        ) : (
                                          <span className="text-muted-foreground/40">—</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <DialogFooter className="pt-4 pb-2 sm:pb-3 border-t shrink-0 flex flex-row items-center justify-between gap-2">
                  <div className="text-left text-xs text-muted-foreground">
                    {selectedCount > 0 ? (
                      <span>
                        Total: <strong className="font-mono text-foreground font-bold">৳ {combinedTotal.toLocaleString()}</strong> ({selectedCount} variations, {totalUnits} units)
                      </span>
                    ) : (
                      <span>Select products or set quantity to add</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsProductModalOpen(false)}
                      className="cursor-pointer"
                    >
                      Cancel
                    </Button>
                    <Button
                      id="btn-confirm-add-product"
                      type="button"
                      size="sm"
                      onClick={handleConfirmAddProducts}
                      disabled={selectedCount === 0}
                      className="bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
                    >
                      <Plus className="h-4 w-4 mr-1.5" />
                      Add to Order ({selectedCount})
                    </Button>
                  </div>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
}
