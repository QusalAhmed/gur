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
  X,
} from "lucide-react";
import {
  DbGeoDivision,
  DbGeoDistrict,
  updateOrderNoteInDb,
  deleteOrderNoteInDb,
  addOrderNoteInDb,
} from "@/lib/supabase";
import { DistrictCombobox } from "@/components/admin/district-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
} from "@/components/ui/tanstack-form";
import { cn } from "@/lib/utils";
import { Order, OrderItem, OrderEvent, OrderNote, OrderNoteType, CatalogProduct } from "@/types/order";
import {
  orderFormSchema,
  orderCustomerSchema,
  orderPhoneSchema,
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
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  // Product Selection Modal state (internal to this dialog)
  const [isProductModalOpen, setIsProductModalOpen] = React.useState(false);
  const [selectedModalProducts, setSelectedModalProducts] = React.useState<
    Record<string, { quantity: number; unit_price: number }>
  >({});
  const [productSearchQuery, setProductSearchQuery] = React.useState("");
  const [newNoteType, setNewNoteType] = React.useState<"internal" | "packaging" | "customer" | "delivery">("internal");
  const [newNoteText, setNewNoteText] = React.useState("");
  const [notesList, setNotesList] = React.useState<OrderNote[]>([]);
  const [editingNoteId, setEditingNoteId] = React.useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = React.useState("");
  const [editingNoteType, setEditingNoteType] = React.useState<OrderNoteType>("internal");
  const [isUpdatingNote, setIsUpdatingNote] = React.useState(false);

  // Helper: Add note to list and optionally sync if in edit mode
  const handleAddNote = async () => {
    const text = newNoteText.trim();
    if (!text) {
      if (showToast) showToast("Please enter note text first.", "info");
      return;
    }

    const nowStr = new Date().toISOString().replace("T", " ").slice(0, 16);
    const newNoteId = `note-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newNote: OrderNote = {
      id: newNoteId,
      author: "Admin Staff",
      text,
      type: newNoteType,
      created_at: nowStr,
    };

    setNotesList((prev) => [newNote, ...prev]);
    setNewNoteText("");

    if (newNoteType === "customer") {
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
    setEditingNoteText(n.text);
    const mappedType =
      n.type === "delivery_note"
        ? "delivery"
        : n.type === "packaging_note"
        ? "packaging"
        : n.type === "internal_staff_note"
        ? "internal"
        : (n.type as OrderNoteType);
    setEditingNoteType(mappedType);
  };

  // Helper: Cancel editing
  const handleCancelEditNote = () => {
    setEditingNoteId(null);
    setEditingNoteText("");
  };

  // Helper: Save edited note
  const handleSaveEditNote = async (noteId: string) => {
    const text = editingNoteText.trim();
    if (!text) {
      if (showToast) showToast("Note content cannot be empty.", "destructive");
      return;
    }

    setIsUpdatingNote(true);
    try {
      const updated = notesList.map((n) =>
        n.id === noteId ? { ...n, text, type: editingNoteType } : n
      );
      setNotesList(updated);

      if (editingNoteType === "customer" || noteId === "customer_note") {
        form.setFieldValue("customer_note", text);
      }

      if (mode === "edit" && order?.id) {
        try {
          await updateOrderNoteInDb(order.id, noteId, text, editingNoteType, order);
          if (showToast) showToast("Note updated successfully.", "success");
        } catch (err: any) {
          console.warn("Could not immediately sync note update to DB:", err);
          if (showToast) showToast("Note updated. Click 'Save Changes' to finalize.", "info");
        }
      } else {
        if (showToast) showToast("Note updated.", "success");
      }

      setEditingNoteId(null);
      setEditingNoteText("");
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
      setEditingNoteText("");
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

  // TanStack Form instance
  const form = useForm({
    canSubmitWhenInvalid: true,
    defaultValues: {
      customer: (mode === "edit" && order?.customer ? order.customer : "") || "",
      phone: (mode === "edit" && order?.phone ? order.phone : "") || "",
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

        const newNoteClean = newNoteText.trim();
        let extraStaffNote = valid.staff_note || "";
        let extraPackagingNote = valid.packaging_note || "";
        let extraCustomerNote = valid.customer_note || "";

        if (newNoteClean) {
          if (newNoteType === "internal") {
            extraStaffNote = extraStaffNote ? `${extraStaffNote}\n${newNoteClean}` : newNoteClean;
          } else if (newNoteType === "packaging") {
            extraPackagingNote = extraPackagingNote ? `${extraPackagingNote}\n${newNoteClean}` : newNoteClean;
          } else if (newNoteType === "customer") {
            extraCustomerNote = extraCustomerNote ? `${extraCustomerNote}\n${newNoteClean}` : newNoteClean;
          }
        }

        if (mode === "create") {
          const newId = `MOL-2610-0${1085 + ordersCount}`;
          const createdOrder: Order = {
            id: newId,
            customer: valid.customer.trim(),
            phone: valid.phone,
            email: valid.email || "",
            address: {
              division: valid.division || "",
              district: valid.district || "",
              address_line: valid.address_line || "",
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
            currency: "BDT",
            date: nowStr,
            customer_note: (() => {
              const custNoteInList = notesList.find((n) => n.type === "customer");
              if (custNoteInList) return custNoteInList.text.trim();
              if (newNoteClean && newNoteType === "customer") return newNoteClean;
              return extraCustomerNote || valid.customer_note || "";
            })(),
            courier_name: valid.courier_name || "",
            cancel_reason: valid.cancel_reason || "",
            items: valid.items as OrderItem[],
            notes: (() => {
              const finalNotes: OrderNote[] = notesList.filter((n) => n.type !== "customer");
              if (newNoteClean && newNoteType !== "customer") {
                finalNotes.unshift({
                  id: `note-${Date.now()}`,
                  author: "Admin Staff",
                  text: newNoteClean,
                  type: newNoteType,
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
          if (newNoteClean && newNoteType !== "customer") {
            updatedNotes.unshift({
              id: `note-${Date.now()}`,
              author: "Admin Staff",
              text: newNoteClean,
              type: newNoteType,
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
            : newNoteClean && newNoteType === "customer"
            ? newNoteClean
            : valid.customer_note || "";

          const updatedOrder: Order = {
            ...order,
            customer: valid.customer.trim(),
            phone: valid.phone,
            email: valid.email || "",
            address: {
              division: valid.division || "",
              district: valid.district || "",
              address_line: valid.address_line || "",
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
            courier_name: valid.courier_name || "",
            cancel_reason: valid.cancel_reason || "",
            items: valid.items as OrderItem[],
            notes: updatedNotes,
            events: [editEvent, ...(order.events || [])],
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
      setNewNoteText("");
      setNewNoteType("internal");
      setEditingNoteId(null);
      setEditingNoteText("");

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

        form.reset({
          customer: order.customer || "",
          phone: order.phone || "",
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
          items: order.items ? order.items.map((it) => ({ ...it })) : [],
        });
      } else {
        setNotesList([]);
        form.reset({
          customer: "",
          phone: "",
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
    if (!productSearchQuery.trim()) return groupedCatalogProducts;
    const q = productSearchQuery.toLowerCase().trim();

    const results: typeof groupedCatalogProducts = [];

    groupedCatalogProducts.forEach((group) => {
      const productNameMatch = group.product_name.toLowerCase().includes(q);
      const categoryMatch = group.category.toLowerCase().includes(q);

      if (productNameMatch || categoryMatch) {
        // Parent matches -> show all variants
        results.push(group);
      } else {
        // Check if any variant or SKU matches
        const matchingVariants = group.variants.filter(
          (v) =>
            v.variant_name.toLowerCase().includes(q) ||
            v.sku.toLowerCase().includes(q)
        );
        if (matchingVariants.length > 0) {
          results.push({
            ...group,
            variants: matchingVariants,
          });
        }
      }
    });

    return results;
  }, [groupedCatalogProducts, productSearchQuery]);

  // Flat list of currently visible/filtered variants for bulk selection
  const filteredCatalogProducts = React.useMemo(() => {
    return filteredGroupedProducts.flatMap((g) => g.variants);
  }, [filteredGroupedProducts]);

  // Open Product Selection Modal
  const handleOpenProductModal = () => {
    setSelectedModalProducts({});
    setProductSearchQuery("");
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
        quantity,
        unit_price,
        line_total: quantity * unit_price,
        variant_id: prod.variant_id,
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

                {/* Row 1: Customer Name & Phone Number */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                        <select
                          id="order_form_division"
                          value={field.state.value}
                          onChange={(e) => {
                            const newDiv = e.target.value;
                            field.handleChange(newDiv);
                            form.setFieldValue("district", "");
                          }}
                          className="w-full h-9 rounded-lg border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                        >
                          <option value="" className="bg-popover text-muted-foreground">Select Division</option>
                          {geoDivisions.map((div) => (
                            <option
                              key={div.id}
                              value={div.name}
                              className="bg-popover text-popover-foreground"
                            >
                              {div.name} {div.name_bn ? `(${div.name_bn})` : ""}
                            </option>
                          ))}
                        </select>
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
              </div>

              {/* ORDER STATUS & CHANNEL SECTION (BELOW CUSTOMER & DESTINATION DETAILS) */}
              <div className="p-4 sm:p-5 rounded-xl bg-card border shadow-xs space-y-4">
                <div className="flex items-center gap-2 border-b pb-2.5">
                  <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
                    <RefreshCw className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Order Status & Channel</h3>
                    <p className="text-[11px] text-muted-foreground">
                      Current workflow processing status and incoming order sales channel
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
                  <form.Field name="status">
                    {(field) => (
                      <FormFieldItem>
                        <FormFieldLabel htmlFor="order_form_status">Order Status</FormFieldLabel>
                        <select
                          id="order_form_status"
                          value={field.state.value}
                          onChange={(e) => {
                            const newStatus = e.target.value as Order["status"];
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
                          className="w-full h-9 rounded-lg border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                        >
                          <option value="incomplete_order" className="bg-popover">Incomplete Order</option>
                          <option value="pending" className="bg-popover">Pending</option>
                          <option value="confirmed" className="bg-popover">Confirmed</option>
                          <option value="processing" className="bg-popover">Processing</option>
                          <option value="shipped" className="bg-popover">Shipped</option>
                          <option value="delivered" className="bg-popover">Delivered</option>
                          <option value="partially_delivered" className="bg-popover">Partially Delivered</option>
                          <option value="cancelled" className="bg-popover">Cancelled</option>
                          <option value="returned" className="bg-popover">Returned</option>
                        </select>
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
                        <select
                          id="order_form_channel"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value as Order["channel"])}
                          className="w-full h-9 rounded-lg border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                        >
                          <option value="phone" className="bg-popover">Phone Call</option>
                          <option value="whatsapp" className="bg-popover">WhatsApp</option>
                          <option value="walk_in" className="bg-popover">Walk-in Depot</option>
                          <option value="admin" className="bg-popover">Admin Desk</option>
                          <option value="web" className="bg-popover">Web Storefront</option>
                          <option value="facebook" className="bg-popover">Facebook Page</option>
                        </select>
                      </FormFieldItem>
                    )}
                  </form.Field>
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
                <form.Subscribe selector={(state) => ({ items: state.values.items })}>
                  {({ items }) => {
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
                              <table className="w-full text-left text-xs">
                                <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] font-semibold tracking-wider border-b">
                                  <tr>
                                    <th className="py-2.5 px-3">Product</th>
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
                                              <p className="font-medium text-foreground text-xs truncate max-w-sm sm:max-w-md">
                                                {item.product_name}
                                              </p>
                                              <div className="flex items-center gap-1.5 mt-0.5">
                                                {item.variant_name && (
                                                  <Badge
                                                    variant="outline"
                                                    className="text-[10px] py-0 px-1.5 h-4 border-amber-600/30 text-amber-700 dark:text-amber-400 font-medium"
                                                  >
                                                    {item.variant_name}
                                                  </Badge>
                                                )}
                                                <span className="text-[10px] font-mono text-muted-foreground">
                                                  SKU: {item.sku}
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                        </td>
                                        <td className="py-2.5 px-3">
                                          <div className="relative">
                                            <span className="absolute left-2.5 top-1.5 text-xs text-muted-foreground font-mono">
                                              ৳
                                            </span>
                                            <Input
                                              type="number"
                                              min="0"
                                              value={item.unit_price}
                                              onChange={(e) =>
                                                handleUpdateItemPrice(item.id, Number(e.target.value) || 0)
                                              }
                                              className="h-7 w-28 pl-5 text-xs font-mono font-medium"
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
                                            <span id={`item-qty-val-${item.sku}`} className="w-8 text-center font-bold font-mono text-xs">
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
                                          <span className="font-mono font-semibold text-foreground text-xs">
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
                                      <select
                                        id="order_form_courier_select"
                                        value={isPreset ? currentValue : currentValue ? "other" : ""}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          if (val !== "other") {
                                            field.handleChange(val);
                                          }
                                        }}
                                        className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                                      >
                                        <option value="">-- Choose Courier Service --</option>
                                        {BANGLADESH_COURIERS.map((c) => (
                                          <option key={c} value={c}>
                                            {c}
                                          </option>
                                        ))}
                                        <option value="other">Other / Custom Courier</option>
                                      </select>

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
                            <select
                              id="order_form_fulfillment"
                              value={field.state.value}
                              onChange={(e) => field.handleChange(e.target.value as Order["fulfillment"])}
                              className="w-full h-9 rounded-lg border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                            >
                              <option value="unfulfilled" className="bg-popover">Unfulfilled</option>
                              <option value="partial" className="bg-popover">Partial Fulfillment</option>
                              <option value="fulfilled" className="bg-popover">Fulfilled</option>
                            </select>
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
                                <div
                                  key={n.id}
                                  className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs space-y-2.5"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-1.5 text-xs">
                                      <Edit className="h-3.5 w-3.5 text-amber-600" />
                                      Editing Note ({n.author})
                                    </span>
                                    <select
                                      value={editingNoteType}
                                      onChange={(e) => setEditingNoteType(e.target.value as OrderNoteType)}
                                      className="h-7 rounded-md border border-input bg-background px-2 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer font-medium"
                                    >
                                      <option value="internal" className="bg-popover">Internal Staff Note</option>
                                      <option value="packaging" className="bg-popover">Packaging Note</option>
                                      <option value="delivery" className="bg-popover">Delivery Note</option>
                                      <option value="customer" className="bg-popover">Customer Instruction</option>
                                    </select>
                                  </div>

                                  <Textarea
                                    value={editingNoteText}
                                    onChange={(e) => setEditingNoteText(e.target.value)}
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
                                      onClick={handleCancelEditNote}
                                      className="h-7 text-xs px-2.5 cursor-pointer"
                                      disabled={isUpdatingNote}
                                    >
                                      <X className="h-3 w-3 mr-1" />
                                      Cancel
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={() => handleSaveEditNote(n.id)}
                                      className="bg-amber-600 hover:bg-amber-700 text-white h-7 text-xs px-2.5 cursor-pointer"
                                      disabled={isUpdatingNote}
                                    >
                                      <Check className="h-3 w-3 mr-1" />
                                      {isUpdatingNote ? "Saving..." : "Save Note"}
                                    </Button>
                                  </div>
                                </div>
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
                                    ) : n.type === "customer" ? (
                                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-blue-400 text-blue-700 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-300">
                                        Customer
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300">
                                        Staff
                                      </Badge>
                                    )}
                                    <span className="text-[10px] text-muted-foreground font-mono">{n.created_at}</span>

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

                    {/* Add New Note Option Composer */}
                    <div className="space-y-2.5 pt-3 border-t">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <MessageSquare className="h-3.5 w-3.5 text-amber-600" />
                          Add New Note
                        </Label>
                        <select
                          id="order_form_new_note_type"
                          value={newNoteType}
                          onChange={(e) => setNewNoteType(e.target.value as any)}
                          className="h-7 rounded-md border border-input bg-transparent px-2 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer font-medium"
                        >
                          <option value="internal" className="bg-popover">Internal Staff Note</option>
                          <option value="packaging" className="bg-popover">Packaging Note</option>
                          <option value="delivery" className="bg-popover">Delivery Note</option>
                          <option value="customer" className="bg-popover">Customer Instruction</option>
                        </select>
                      </div>

                      <Textarea
                        id="order_form_new_note_text"
                        placeholder={
                          newNoteType === "packaging"
                            ? "e.g. Double bubble wrap glass jars, inspect seals, affix fragile label..."
                            : newNoteType === "delivery"
                              ? "e.g. Call before delivery, gate code, delivery after 4 PM..."
                              : newNoteType === "customer"
                                ? "e.g. Special customer request or customization instructions..."
                                : "e.g. Phone verification note, manager approved adjustment, staff remarks..."
                        }
                        value={newNoteText}
                        onChange={(e) => setNewNoteText(e.target.value)}
                        rows={2}
                        className="text-xs bg-background"
                      />
                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <p className="text-[10px] text-muted-foreground">
                          {newNoteType === "internal"
                            ? "Internal notes visible to staff only."
                            : newNoteType === "packaging"
                              ? "Packaging notes appear on packing lists."
                              : newNoteType === "delivery"
                                ? "Delivery notes provide instructions to couriers."
                                : "Customer requests recorded against this order."}
                        </p>
                        <Button
                          id="btn-add-order-note"
                          type="button"
                          size="sm"
                          onClick={handleAddNote}
                          disabled={!newNoteText.trim()}
                          className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-7 px-2.5 shrink-0 cursor-pointer shadow-xs disabled:opacity-50"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add Note
                        </Button>
                      </div>
                    </div>
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
                            <select
                              id="order_form_method"
                              value={field.state.value}
                              onChange={(e) => field.handleChange(e.target.value as Order["method"])}
                              className="w-full h-9 rounded-lg border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                            >
                              <option value="cod" className="bg-popover">Cash on Delivery (COD)</option>
                              <option value="bkash" className="bg-popover">bKash</option>
                              <option value="nagad" className="bg-popover">Nagad</option>
                              <option value="rocket" className="bg-popover">Rocket</option>
                              <option value="bank_transfer" className="bg-popover">Bank Transfer</option>
                              <option value="cash" className="bg-popover">Cash</option>
                              <option value="card" className="bg-popover">Credit / Debit Card</option>
                              <option value="credit_terms" className="bg-popover">Credit Terms (Business)</option>
                            </select>
                          </FormFieldItem>
                        )}
                      </form.Field>

                      <form.Field name="payment">
                        {(field) => (
                          <FormFieldItem>
                            <FormFieldLabel htmlFor="order_form_payment">Payment Status</FormFieldLabel>
                            <select
                              id="order_form_payment"
                              value={field.state.value}
                              onChange={(e) => {
                                const newPayment = e.target.value as Order["payment"];
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
                              className="w-full h-9 rounded-lg border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                            >
                              <option value="unpaid" className="bg-popover">Unpaid</option>
                              <option value="partially_paid" className="bg-popover">Partially Paid</option>
                              <option value="paid" className="bg-popover">Paid</option>
                              <option value="refunded" className="bg-popover">Refunded</option>
                            </select>
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
                    <form.Subscribe
                      selector={(state) => ({
                        payment: state.values.payment,
                        items: state.values.items,
                        shipping_total: state.values.shipping_total,
                        discount_total: state.values.discount_total,
                      })}
                    >
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

                    <form.Subscribe
                      selector={(state) => ({
                        items: state.values.items,
                        shipping_total: state.values.shipping_total,
                        discount_total: state.values.discount_total,
                        payment: state.values.payment,
                        amount_paid: state.values.amount_paid,
                      })}
                    >
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

            <DialogFooter className="pt-4 border-t sticky bottom-0 bg-popover/95 backdrop-blur-xs z-20 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 pb-2 mt-4 flex items-center justify-between sm:justify-between">
              <form.Subscribe
                selector={(state) => ({
                  items: state.values.items,
                  shipping_total: state.values.shipping_total,
                  discount_total: state.values.discount_total,
                })}
              >
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
                  <div className="flex-1 overflow-y-auto pr-1 space-y-3 min-h-0">
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

                <DialogFooter className="pt-3 border-t shrink-0 flex flex-row items-center justify-between gap-2">
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
