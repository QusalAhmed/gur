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
} from "lucide-react";
import { DbGeoDivision, DbGeoDistrict } from "@/lib/supabase";
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
import { Order, OrderItem, OrderEvent, CatalogProduct } from "@/types/order";
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

  // TanStack Form instance
  const form = useForm({
    canSubmitWhenInvalid: true,
    defaultValues: {
      customer: "",
      phone: "",
      email: "",
      division: "",
      district: "",
      address_line: "",
      channel: "phone" as Order["channel"],
      method: "cod" as Order["method"],
      status: (defaultStatus || "confirmed") as Order["status"],
      payment: "unpaid" as Order["payment"],
      fulfillment: "unfulfilled" as Order["fulfillment"],
      shipping_total: 120,
      discount_total: 0,
      amount_paid: 0,
      customer_note: "",
      staff_note: "",
      courier_name: "",
      cancel_reason: "",
      items: [] as OrderItem[],
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
            customer_note: valid.customer_note || "",
            courier_name: valid.courier_name || "",
            cancel_reason: valid.cancel_reason || "",
            items: valid.items as OrderItem[],
            notes: (() => {
              const initialNotes: any[] = [];
              if (valid.customer_note && valid.customer_note.trim()) {
                initialNotes.push({
                  id: `note-cust-${Date.now()}`,
                  author: valid.customer ? valid.customer.trim() : "Customer",
                  text: valid.customer_note.trim(),
                  type: "customer",
                  created_at: nowStr,
                });
              }
              if (valid.staff_note && valid.staff_note.trim()) {
                initialNotes.push({
                  id: `note-staff-${Date.now()}`,
                  author: "Admin Staff",
                  text: valid.staff_note.trim(),
                  type: "internal",
                  created_at: nowStr,
                });
              }
              initialNotes.push({
                id: `note-${Date.now()}`,
                author: "Admin Staff",
                text: valid.items.length > 0
                  ? `Manual order created with ${valid.items.length} product(s) via ${valid.channel.toUpperCase()} channel.${valid.payment === "partially_paid" ? ` Partial advance payment: ৳ ${finalAmountPaid.toLocaleString()} recorded.` : ""}${valid.courier_name ? ` Assigned courier: ${valid.courier_name}.` : ""}`
                  : `Draft ${valid.status === "incomplete_order" ? "incomplete" : "pending"} order created without product items via ${valid.channel.toUpperCase()} channel.`,
                type: "internal",
                created_at: nowStr,
              });
              return initialNotes;
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

          let updatedNotes = order.notes ? [...order.notes] : [];
          if (valid.staff_note && valid.staff_note.trim()) {
            updatedNotes.unshift({
              id: `note-staff-${Date.now()}`,
              author: "Admin Staff",
              text: valid.staff_note.trim(),
              type: "internal",
              created_at: nowStr,
            });
          }
          if (valid.customer_note && valid.customer_note.trim()) {
            const custIdx = updatedNotes.findIndex((n) => n.type === "customer");
            if (custIdx >= 0) {
              updatedNotes[custIdx] = {
                ...updatedNotes[custIdx],
                text: valid.customer_note.trim(),
                created_at: nowStr,
              };
            } else {
              updatedNotes.unshift({
                id: `note-cust-${Date.now()}`,
                author: valid.customer ? valid.customer.trim() : "Customer",
                text: valid.customer_note.trim(),
                type: "customer",
                created_at: nowStr,
              });
            }
          } else {
            updatedNotes = updatedNotes.filter((n) => n.type !== "customer");
          }

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
            customer_note: valid.customer_note,
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
      if (mode === "edit" && order) {
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
          courier_name: order.courier_name || "",
          cancel_reason: order.cancel_reason || "",
          items: order.items ? order.items.map((it) => ({ ...it })) : [],
        });
      } else {
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
          courier_name: "",
          cancel_reason: "",
          items: [],
        });
      }
    }
  }, [open, mode, order, defaultStatus, form]);

  // Filtered catalog products for product selection modal
  const filteredCatalogProducts = React.useMemo(() => {
    if (!productSearchQuery.trim()) return availableCatalogProducts;
    const q = productSearchQuery.toLowerCase();
    return availableCatalogProducts.filter(
      (p) =>
        p.product_name.toLowerCase().includes(q) ||
        p.variant_name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }, [availableCatalogProducts, productSearchQuery]);

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

  // Update unit price in modal
  const handleUpdateModalProductPrice = (sku: string, newPrice: number) => {
    const price = Math.max(0, newPrice);
    setSelectedModalProducts((prev) => {
      if (!prev[sku]) return prev;
      return {
        ...prev,
        [sku]: { ...prev[sku], unit_price: price },
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
          className="w-full md:w-[70%] lg:w-[80%] max-w-none max-h-[90vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8"
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
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Customer, Geo Delivery, Channel/Payment & Workflow */}
              <div className="lg:col-span-6 space-y-4 min-w-0">
                {/* 1. Customer Information Card */}
                <div className="p-4 rounded-xl bg-muted/40 border space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-amber-600" />
                    Customer Information
                  </p>
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
                            placeholder="e.g. Modern Bakery Ltd"
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

                  <form.Field
                    name="email"
                    validators={{
                      onChange: validateWithZod(orderEmailSchema),
                      onBlur: validateWithZod(orderEmailSchema),
                    }}
                  >
                    {(field) => (
                      <FormFieldItem>
                        <FormFieldLabel htmlFor="order_form_customer_email">Email Address</FormFieldLabel>
                        <Input
                          id="order_form_customer_email"
                          type="email"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                          placeholder="email@example.com (optional)"
                        />
                        <FormFieldError errors={field.state.meta.errors} />
                      </FormFieldItem>
                    )}
                  </form.Field>
                </div>

                {/* 2. Channel & Payment Method Card */}
                <div className="p-4 rounded-xl bg-muted/40 border space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Building className="h-3.5 w-3.5 text-amber-600" />
                    Channel & Payment Method
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                            <option value="bank_transfer" className="bg-popover">Bank Transfer</option>
                            <option value="cash" className="bg-popover">Cash</option>
                            <option value="card" className="bg-popover">Credit / Debit Card</option>
                          </select>
                        </FormFieldItem>
                      )}
                    </form.Field>
                  </div>
                </div>

                {/* 3. Delivery Destination & Geo Location Card */}
                <div className="p-4 rounded-xl bg-muted/40 border space-y-3">
                  <div className="flex items-center justify-between pb-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-amber-600" />
                      Delivery Destination & Geo Location
                    </p>
                    <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
                      <Database className="h-3 w-3 text-emerald-600" />
                      {geoDivisions.length} Divisions • {geoDistricts.length} Districts (DB)
                    </span>
                  </div>

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
                          placeholder="House/Plot, Road number, Area or Landmark"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                        />
                        <FormFieldError errors={field.state.meta.errors} />
                      </FormFieldItem>
                    )}
                  </form.Field>
                </div>

                {/* 4. Workflow Statuses Card */}
                <div className="p-4 rounded-xl bg-muted/40 border space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5 text-amber-600" />
                    Workflow Statuses
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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


                    <form.Field name="payment">
                      {(field) => (
                        <FormFieldItem>
                          <FormFieldLabel htmlFor="order_form_payment">Payment</FormFieldLabel>
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

                    <form.Field name="fulfillment">
                      {(field) => (
                        <FormFieldItem>
                          <FormFieldLabel htmlFor="order_form_fulfillment">Fulfillment</FormFieldLabel>
                          <select
                            id="order_form_fulfillment"
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value as Order["fulfillment"])}
                            className="w-full h-9 rounded-lg border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                          >
                            <option value="unfulfilled" className="bg-popover">Unfulfilled</option>
                            <option value="partial" className="bg-popover">Partial</option>
                            <option value="fulfilled" className="bg-popover">Fulfilled</option>
                          </select>
                        </FormFieldItem>
                      )}
                    </form.Field>

                    {/* Courier Service & Logistics Selection */}
                    <form.Subscribe selector={(state) => state.values.status}>
                      {(status) => {
                        const needsCourier =
                          status === "processing" ||
                          status === "shipped" ||
                          status === "delivered" ||
                          status === "partially_delivered";

                        return (
                          <div
                            className={cn(
                              "col-span-1 sm:col-span-3 p-3.5 rounded-xl border space-y-2.5 transition-colors",
                              needsCourier
                                ? "bg-amber-500/10 border-amber-500/40"
                                : "bg-card/50 border-border"
                            )}
                          >
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
                                        <Truck className="h-4 w-4 text-amber-600" />
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
                                    <div className="flex flex-wrap gap-1.5 pt-1">
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
                          </div>
                        );
                      }}
                    </form.Subscribe>

                    {/* Cancellation / Return Reason */}
                    <form.Subscribe selector={(state) => state.values.status}>
                      {(status) => {
                        if (status !== "cancelled" && status !== "returned") return null;

                        return (
                          <div className="col-span-1 sm:col-span-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-2">
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

                    {/* Partial Payment Amount Option */}
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
                          <div className="col-span-1 sm:col-span-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                            <div className="flex items-center justify-between">
                              <FormFieldLabel htmlFor="order_form_amount_paid" className="text-amber-800 dark:text-amber-300 font-semibold flex items-center gap-1.5 normal-case tracking-normal">
                                <CreditCard className="h-4 w-4 text-amber-600" />
                                Partial Payment Amount (Advance Received)
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
                                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                      <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mr-1">
                                        Quick Fill:
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => field.handleChange(500)}
                                        className="px-2.5 py-1 rounded-md border text-xs font-mono bg-background hover:bg-muted font-medium transition-colors cursor-pointer"
                                      >
                                        ৳ 500
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => field.handleChange(1000)}
                                        className="px-2.5 py-1 rounded-md border text-xs font-mono bg-background hover:bg-muted font-medium transition-colors cursor-pointer"
                                      >
                                        ৳ 1,000
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => field.handleChange(Math.round(grandTotal * 0.5))}
                                        className="px-2.5 py-1 rounded-md border text-xs font-mono bg-background hover:bg-muted font-medium transition-colors cursor-pointer"
                                      >
                                        50% (৳ {Math.round(grandTotal * 0.5).toLocaleString()})
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => field.handleChange(Math.round(grandTotal * 0.25))}
                                        className="px-2.5 py-1 rounded-md border text-xs font-mono bg-background hover:bg-muted font-medium transition-colors cursor-pointer"
                                      >
                                        25% (৳ {Math.round(grandTotal * 0.25).toLocaleString()})
                                      </button>
                                    </div>

                                    {/* Live Breakdown Badges */}
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
                </div>

                {/* 5. Special Note / Instructions */}
                <form.Field
                  name="customer_note"
                  validators={{
                    onChange: validateWithZod(orderCustomerNoteSchema),
                    onBlur: validateWithZod(orderCustomerNoteSchema),
                  }}
                >
                  {(field) => (
                    <FormFieldItem>
                      <FormFieldLabel htmlFor="order_form_customer_note" className="flex items-center gap-1.5 text-xs font-semibold text-blue-900 dark:text-blue-300">
                        <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
                        <span>Customer Note / Delivery Instructions</span>
                        <span className="text-[10px] text-muted-foreground font-normal">(Visible to customer)</span>
                      </FormFieldLabel>
                      <Textarea
                        id="order_form_customer_note"
                        placeholder="Any special handling or customer notes..."
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        rows={2}
                      />
                      <FormFieldError errors={field.state.meta.errors} />
                    </FormFieldItem>
                  )}
                </form.Field>

                {/* 6. Internal Staff Note (Private to Staff) */}
                <form.Field name="staff_note">
                  {(field) => (
                    <FormFieldItem className="pt-1">
                      <FormFieldLabel htmlFor="order_form_staff_note" className="flex items-center gap-1.5 text-xs font-semibold text-amber-900 dark:text-amber-300">
                        <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />
                        <span>Internal Staff Note</span>
                        <span className="text-[10px] text-muted-foreground font-normal">(Private to staff only)</span>
                      </FormFieldLabel>
                      <Textarea
                        id="order_form_staff_note"
                        placeholder="Internal comments for warehouse or administration (e.g. Address verified via phone, wrap in bubble cushion)..."
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        rows={2}
                        className="text-xs bg-amber-500/[0.03] border-amber-200 dark:border-amber-900/40"
                      />
                      {mode === "edit" && order && (order.notes || []).filter((n) => n.type === "internal").length > 0 && (
                        <div className="mt-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] space-y-1">
                          <span className="font-semibold text-amber-900 dark:text-amber-300 flex items-center gap-1">
                            <ShieldCheck className="h-3 w-3 text-amber-600" />
                            Previous Staff Notes ({(order.notes || []).filter((n) => n.type === "internal").length}):
                          </span>
                          <div className="max-h-20 overflow-y-auto space-y-0.5 pr-1">
                            {(order.notes || []).filter((n) => n.type === "internal").map((n) => (
                              <p key={n.id} className="text-amber-950 dark:text-amber-100 line-clamp-1">
                                • {n.text} <span className="text-[10px] text-muted-foreground">({n.created_at})</span>
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                    </FormFieldItem>
                  )}
                </form.Field>
              </div>

              {/* Right Column: Purchased Products & Financial Adjustments */}
              <div className="lg:col-span-6 space-y-4 min-w-0">
                {/* 1. Purchased Products Card */}
                <div className="space-y-2.5 p-4 rounded-xl bg-muted/40 border">
                  <form.Subscribe selector={(state) => ({ items: state.values.items })}>
                    {({ items }) => {
                      const itemsSubtotal = items.reduce((sum, it) => sum + it.line_total, 0);
                      return (
                        <>
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                              <PackageCheck className="h-3.5 w-3.5 text-amber-600" />
                              Purchased Items ({items.length})
                              <form.Subscribe selector={(state) => state.values.status}>
                                {(currStatus) =>
                                  isFieldRequiredForStatus("items", currStatus) ? (
                                    <span className="text-destructive font-bold text-sm">*</span>
                                  ) : null
                                }
                              </form.Subscribe>
                            </Label>
                            <div className="text-xs text-muted-foreground">
                              Items Subtotal:{" "}
                              <span className="font-mono font-bold text-foreground">
                                ৳ {itemsSubtotal.toLocaleString()}
                              </span>
                            </div>
                          </div>

                          {items.length === 0 ? (
                            <div className="p-6 text-center border-2 border-dashed rounded-xl bg-card/60 space-y-2.5">
                              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center mx-auto text-amber-600">
                                <PackagePlus className="h-5 w-5" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs font-semibold text-foreground">No Products Added</p>
                                <form.Subscribe selector={(state) => state.values.status}>
                                  {(currStatus) => (
                                    <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                                      {currStatus === "incomplete_order" || currStatus === "pending"
                                        ? "Items are optional for incomplete and pending orders. Products can be added now or later."
                                        : "No items currently in this order. Choose single or multiple products from the catalog to continue."}
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
                                Browse & Select Products
                              </Button>
                            </div>
                          ) : (
                            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                              {items.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex items-center justify-between gap-2 p-3 rounded-lg bg-card border text-xs"
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <p className="font-medium text-foreground truncate">
                                        {item.product_name}
                                      </p>
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] py-0 px-1.5 h-4 border-amber-600/30 text-amber-700 dark:text-amber-400"
                                      >
                                        {item.variant_name}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                      <div className="flex items-center gap-1">
                                        <span className="text-[11px] text-muted-foreground">Price: ৳</span>
                                        <Input
                                          type="number"
                                          min="0"
                                          value={item.unit_price}
                                          onChange={(e) =>
                                            handleUpdateItemPrice(item.id, Number(e.target.value) || 0)
                                          }
                                          className="h-6 w-24 text-xs px-1.5 py-0 font-mono font-medium"
                                          title="Change unit price for this product"
                                        />
                                      </div>
                                      <span className="text-[11px] text-muted-foreground font-mono">
                                        Total:{" "}
                                        <strong className="text-foreground">
                                          ৳ {item.line_total.toLocaleString()}
                                        </strong>
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
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
                                    <span id={`item-qty-val-${item.sku}`} className="w-6 text-center font-bold font-mono">
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

                                    <Button
                                      id={`btn-item-remove-${item.sku}`}
                                      type="button"
                                      variant="ghost"
                                      size="icon-xs"
                                      className="h-6 w-6 text-destructive hover:bg-destructive/10 ml-1 cursor-pointer"
                                      onClick={() => handleRemoveItem(item.id)}
                                      title="Remove Item"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      );
                    }}
                  </form.Subscribe>

                  {/* Add Product Button (Opens Product Modal) */}
                  <div className="pt-2 border-t">
                    <Button
                      id={mode === "edit" ? "btn-open-product-modal-edit" : "btn-open-product-modal-create"}
                      type="button"
                      variant="outline"
                      onClick={handleOpenProductModal}
                      className="w-full border-dashed border-amber-600/50 hover:border-amber-600 text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20 text-xs font-medium h-9 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      Select Product & Quantity (Open Modal)
                    </Button>
                  </div>
                </div>

                {/* 2. Financial Adjustments & Recalculation Card */}
                <div className="p-4 rounded-xl bg-muted/40 border space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Truck className="h-3.5 w-3.5 text-amber-600" />
                    Delivery Charge & Financial Adjustments
                  </p>
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
                            <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-mono">
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
                              { label: "Depot Pickup (৳ 0)", val: 0 },
                              { label: "Dhaka City (৳ 120)", val: 120 },
                              { label: "Outside Dhaka (৳ 200)", val: 200 },
                              { label: "Bulk Freight (৳ 1,500)", val: 1500 },
                            ].map((preset) => (
                              <button
                                key={preset.label}
                                type="button"
                                onClick={() => field.handleChange(preset.val)}
                                className="text-[11px] px-2 py-0.5 rounded-md border bg-card hover:bg-muted transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
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
                          <Input
                            id="order_form_discount_total"
                            type="number"
                            min="0"
                            value={field.state.value}
                            onChange={(e) => field.handleChange(Number(e.target.value) || 0)}
                            onBlur={field.handleBlur}
                            className="font-mono h-9"
                          />
                          <FormFieldError errors={field.state.meta.errors} />
                        </FormFieldItem>
                      )}
                    </form.Field>
                  </div>

                  {/* Financial Summary */}
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
                        <div className="pt-3 border-t space-y-1.5 text-xs">
                          <div className="flex justify-between text-muted-foreground">
                            <span>Items Subtotal ({items.length} item{items.length !== 1 ? "s" : ""})</span>
                            <span className="font-mono font-medium text-foreground">
                              ৳ {subtotal.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between text-muted-foreground">
                            <span>Delivery Charge</span>
                            <span className="font-mono">+ ৳ {shipping.toLocaleString()}</span>
                          </div>
                          {discount > 0 && (
                            <div className="flex justify-between text-emerald-600">
                              <span>Discount</span>
                              <span className="font-mono">- ৳ {discount.toLocaleString()}</span>
                            </div>
                          )}
                          <div className="border-t pt-2 flex justify-between font-bold text-sm text-foreground">
                            <span>Net Total Payable</span>
                            <span className="font-mono text-amber-700 dark:text-amber-400">
                              ৳ {grandTotal.toLocaleString()}
                            </span>
                          </div>

                          {payment === "partially_paid" && (
                            <div className="pt-2 border-t border-dashed space-y-1">
                              <div className="flex justify-between text-emerald-600 font-medium">
                                <span>Partial Advance Paid:</span>
                                <span className="font-mono">৳ {paid.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between text-rose-600 font-bold">
                                <span>Due on Delivery (COD):</span>
                                <span className="font-mono">৳ {due.toLocaleString()}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    }}
                  </form.Subscribe>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-4 border-t">
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
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* PRODUCT SELECTION MODAL (SHARED FOR CATALOG BROWSING) */}
      <Dialog open={isProductModalOpen} onOpenChange={setIsProductModalOpen}>
        <DialogContent
          id="dialog-content-product-selection"
          overlayClassName="z-[55]"
          className="z-[60] w-full sm:max-w-3xl md:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-4 sm:p-6"
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
                    Browse products, toggle selection, and adjust order quantities directly in each row. Setting quantity automatically selects the product.
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
                      <span className="w-24 text-right">Price</span>
                      <span className="w-28 text-center">Quantity</span>
                      <span className="w-20 text-right">Subtotal</span>
                    </div>
                  </div>

                  {/* Product Rows List */}
                  <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 min-h-0 max-h-[58vh]">
                    {filteredCatalogProducts.length === 0 ? (
                      <div className="p-8 text-center border border-dashed rounded-xl bg-muted/20 space-y-2">
                        <PackageCheck className="h-8 w-8 text-muted-foreground mx-auto" />
                        <p className="text-sm font-medium text-foreground">No Products Found</p>
                        <p className="text-xs text-muted-foreground">
                          No catalog products match your search query &quot;{productSearchQuery}&quot;.
                        </p>
                      </div>
                    ) : (
                      filteredCatalogProducts.map((prod) => {
                        const selectedConfig = selectedModalProducts[prod.sku];
                        const isSelected = Boolean(selectedConfig && selectedConfig.quantity > 0);
                        const currentQty = selectedConfig?.quantity ?? 0;
                        const currentPrice = selectedConfig?.unit_price ?? prod.unit_price;
                        const lineTotal = currentQty * currentPrice;

                        return (
                          <div
                            key={prod.sku}
                            id={`catalog-product-row-${prod.sku}`}
                            className={cn(
                              "group flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-3.5 rounded-xl border transition-all gap-3 select-none",
                              isSelected
                                ? "border-amber-500 bg-amber-500/10 dark:bg-amber-500/15 ring-1 ring-amber-500 shadow-xs"
                                : "hover:border-amber-300 dark:hover:border-amber-800 bg-card border-border/80 hover:bg-muted/30"
                            )}
                          >
                            {/* Left section: Selection button + Product Picture + Name, SKU & Stock */}
                            <div className="flex items-center gap-3 min-w-0 flex-1 w-full sm:w-auto">
                              <Button
                                type="button"
                                id={`btn-select-product-${prod.sku}`}
                                variant={isSelected ? "default" : "outline"}
                                size="icon-xs"
                                onClick={() => handleToggleProductSelection(prod.sku)}
                                className={cn(
                                  "w-7 h-7 rounded-lg shrink-0 transition-all cursor-pointer",
                                  isSelected
                                    ? "bg-amber-600 hover:bg-amber-700 text-white shadow-xs border-amber-600"
                                    : "hover:border-amber-500 hover:bg-amber-500/10 text-muted-foreground border-border/80"
                                )}
                                title={isSelected ? "Deselect product (sets qty to 0)" : "Select product (sets qty to 1)"}
                              >
                                {isSelected ? (
                                  <Check className="h-4 w-4 stroke-[3]" />
                                ) : (
                                  <Square className="h-3.5 w-3.5 text-muted-foreground/60" />
                                )}
                              </Button>

                              <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden border bg-muted/40 shrink-0 shadow-xs">
                                <img
                                  src={prod.image}
                                  alt={prod.product_name}
                                  className="w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = "none";
                                  }}
                                />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-semibold text-sm text-foreground leading-tight">
                                    {prod.product_name}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] py-0 px-1.5 h-4 border-amber-600/30 text-amber-700 dark:text-amber-400 font-normal shrink-0"
                                  >
                                    {prod.variant_name}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                                  <span className="font-mono text-[11px] text-muted-foreground/80">SKU: {prod.sku}</span>
                                  <span>•</span>
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] h-4 py-0 px-1.5 font-medium bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                                    {prod.stock}
                                  </Badge>
                                </div>
                              </div>
                            </div>

                            {/* Right section: Price + Quantity Stepper + Line Total */}
                            <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
                              <div className="text-left sm:text-right min-w-[90px]">
                                <div className="flex items-center sm:justify-end gap-1">
                                  <span className="text-[11px] text-muted-foreground">Price:</span>
                                  {isSelected ? (
                                    <div className="flex items-center gap-1">
                                      <span className="font-mono font-bold text-xs text-amber-700 dark:text-amber-400">৳</span>
                                      <Input
                                        id={`input-product-price-${prod.sku}`}
                                        type="number"
                                        min="0"
                                        value={currentPrice}
                                        onChange={(e) =>
                                          handleUpdateModalProductPrice(prod.sku, Math.max(0, Number(e.target.value) || 0))
                                        }
                                        className="h-7 w-20 text-xs px-1.5 py-0 font-mono font-semibold"
                                        title="Adjust unit price"
                                      />
                                    </div>
                                  ) : (
                                    <span className="font-mono font-bold text-xs text-foreground">
                                      ৳ {prod.unit_price.toLocaleString()}
                                    </span>
                                  )}
                                </div>
                                {isSelected && currentPrice !== prod.unit_price && (
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateModalProductPrice(prod.sku, prod.unit_price)}
                                    className="text-[10px] text-amber-600 hover:underline block text-right mt-0.5 cursor-pointer"
                                  >
                                    Reset (৳ {prod.unit_price.toLocaleString()})
                                  </button>
                                )}
                              </div>

                              <div className="flex items-center gap-1 shrink-0 bg-background/80 p-1 rounded-lg border">
                                <Button
                                  type="button"
                                  id={`btn-qty-minus-${prod.sku}`}
                                  variant="ghost"
                                  size="icon-xs"
                                  className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
                                  onClick={() => handleSetModalProductQty(prod.sku, currentQty - 1)}
                                  disabled={currentQty === 0}
                                  title={currentQty === 1 ? "Reduce to 0 (deselects product)" : "Decrease quantity"}
                                >
                                  <Minus className="h-3.5 w-3.5" />
                                </Button>

                                <Input
                                  id={`input-product-qty-${prod.sku}`}
                                  type="number"
                                  min="0"
                                  value={currentQty === 0 ? "0" : currentQty}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    handleSetModalProductQty(prod.sku, isNaN(val) ? 0 : Math.max(0, val));
                                  }}
                                  className={cn(
                                    "h-7 w-12 text-center font-bold font-mono text-xs px-1 border-0 focus-visible:ring-1",
                                    isSelected ? "text-foreground font-black" : "text-muted-foreground"
                                  )}
                                />

                                <Button
                                  type="button"
                                  id={`btn-qty-plus-${prod.sku}`}
                                  variant="ghost"
                                  size="icon-xs"
                                  className="h-7 w-7 text-muted-foreground hover:text-amber-600 cursor-pointer"
                                  onClick={() => handleSetModalProductQty(prod.sku, currentQty + 1)}
                                  title={currentQty === 0 ? "Add 1 (selects product)" : "Increase quantity"}
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </Button>
                              </div>

                              <div className="w-20 text-right font-mono font-bold text-xs shrink-0">
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
                      })
                    )}
                  </div>
                </div>

                <DialogFooter className="pt-3 border-t shrink-0 flex flex-row items-center justify-between gap-2">
                  <div className="text-left text-xs text-muted-foreground">
                    {selectedCount > 0 ? (
                      <span>
                        Total: <strong className="font-mono text-foreground font-bold">৳ {combinedTotal.toLocaleString()}</strong> ({selectedCount} products, {totalUnits} units)
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
