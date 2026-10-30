"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import {
  useToast,
  ToastNotificationPortal,
  type ToastData,
  type ToastType,
} from "@/components/ui/toast-notification";
import {
  Plus,
  Search,
  Download,
  Eye,
  MoreHorizontal,
  Edit,
  Trash2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  MessageSquare,
  Truck,
  User,
  MapPin,
  Phone,
  Mail,
  FileText,
  Send,
  ArrowRight,
  RefreshCw,
  PackageCheck,
  Building,
  RotateCcw,
  Check,
  Minus,
  PackagePlus,
  CheckSquare,
  Square,
  X,
  ShoppingCart,
  Loader2,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronsUpDown,
  Copy,
  AlertCircle,
  ShieldCheck,
  Printer,
  Package,
  XCircle,
} from "lucide-react";
import {
  supabase,
  fetchGeoDivisionsAndDistricts,
  fetchGeoDistricts,
  fetchOrdersFromDb,
  createOrderInDb,
  updateOrderInDb,
  updateOrderStatusInDb,
  addOrderNoteInDb,
  updateOrderNoteInDb,
  deleteOrderNoteInDb,
  updateCustomerNoteInDb,
  deleteOrderInDb,
  recordOrderPaymentInDb,
  fetchCatalogProductsFromDb,
  bulkUpdateOrderStatusInDb,
  bulkAssignCourierInDb,
  bulkDeleteOrdersInDb,
  DbGeoDivision,
  DbGeoDistrict,
  fallbackDivisions,
  fallbackDistricts,
  parseDatabaseError,
  validateOrderStatusTransition,
  type ParsedDatabaseError,
  type BulkStatusUpdateResult,
  type BulkCourierUpdateResult,
  type BulkDeleteResult,
} from "@/lib/supabase";
import { DistrictCombobox } from "@/components/admin/district-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
  FormFieldDescription,
} from "@/components/ui/tanstack-form";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { ColumnDef, PaginationState, SortingState } from "@tanstack/react-table";
import { getOrdersAction } from "@/actions/orders";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import { Checkbox } from "@/components/ui/checkbox";
import { OrderFormDialog } from "@/components/admin/order-form-dialog";
import { OrderDetailsSheet } from "@/components/admin/order-details-sheet";
import { useSiteSettings } from "@/hooks/use-site-settings";
import {
  orderNoteFormSchema,
  orderNoteTextSchema,
  orderNoteTypeSchema,
  updateOrderNoteFormSchema,
  recordPaymentFormSchema,
  orderAmountPaidSchema,
  BANGLADESH_COURIERS,
  isFieldRequiredForStatus,
  validateWithZod,
} from "@/lib/validations/order";
import type { OrderItem, OrderNote, OrderEvent, Order, CatalogProduct, OrderNoteType } from "@/types/order";
export type { OrderItem, OrderNote, OrderEvent, Order, CatalogProduct, OrderNoteType } from "@/types/order";

const availableCatalogProducts: CatalogProduct[] = [
  {
    sku: "MOL-CAN-DRUM-200L",
    product_name: "Raw Sugarcane Molasses (ঝোলা গুড়)",
    variant_name: "200L Industrial Steel Drum",
    category: "Industrial Molasses",
    unit_price: 12000,
    stock: "38 Drums in stock",
    image: "/images/products/raw-sugarcane-drum.jpg",
  },
  {
    sku: "GUR-DAT-PAT-1KG",
    product_name: "Pure Date Palm Patali Gur (খাঁটি খেজুর পাটালি গুড়)",
    variant_name: "1 kg Food-Grade Vacuum Pouch",
    category: "Specialty Gur",
    unit_price: 620,
    stock: "450 Pouches in stock",
    image: "/images/products/date-palm-patali.jpg",
  },
  {
    sku: "GUR-DAT-LIQ-5L",
    product_name: "Liquid Date Palm Molasses (খেজুরের ঝোলা গুড়)",
    variant_name: "5L Food-grade Jerrycan",
    category: "Specialty Gur",
    unit_price: 1700,
    stock: "120 Jerrycans in stock",
    image: "/images/products/date-palm-liquid.jpg",
  },
  {
    sku: "MOL-BLK-DRUM-200L",
    product_name: "Blackstrap Industrial Molasses (ব্ল্যাকস্ট্র্যাপ গুড়)",
    variant_name: "200L Heavy IBC/Steel Drum",
    category: "Feed & Industrial",
    unit_price: 11000,
    stock: "15 Drums in stock",
    image: "/images/products/blackstrap-drum.jpg",
  },
  {
    sku: "MOL-ORG-CAN-50KG",
    product_name: "Organic Sugarcane Molasses (অর্গানিক মোলাসেস)",
    variant_name: "50 kg Food-Grade Drum",
    category: "Organic Food Grade",
    unit_price: 4800,
    stock: "60 Drums in stock",
    image: "/images/products/organic-sugarcane.jpg",
  },
  {
    sku: "GUR-JHA-NAT-500G",
    product_name: "Organic Nolen Gur (নলেন গুড়)",
    variant_name: "500g Glass Jar",
    category: "Specialty Gur",
    unit_price: 420,
    stock: "25 Jars in stock",
    image: "/images/products/nolen-gur-jar.jpg",
  },
];

const statusStyles: Record<string, string> = {
  incomplete_order: "bg-slate-100 text-slate-800 dark:bg-slate-800/60 dark:text-slate-300 border border-slate-300 dark:border-slate-700/60",
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-700/50",
  confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-300 dark:border-blue-700/50",
  processing: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700/50",
  shipped: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-300 dark:border-purple-700/50",
  delivered: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/50",
  partially_delivered: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 border border-teal-300 dark:border-teal-700/50",
  cancelled: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-300 dark:border-rose-700/50",
  returned: "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300 border border-orange-300 dark:border-orange-700/50",
};

const validStatusTabs = [
  "all",
  "incomplete_order",
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "partially_delivered",
  "cancelled",
  "returned",
];

const paymentStyles: Record<string, string> = {
  unpaid: "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800",
  partially_paid: "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
  paid: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
  partially_refunded: "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
  refunded: "bg-gray-100 text-gray-700 border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
};

export function OrdersClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusParam = searchParams.get("status");
  const queryClient = useQueryClient();
  const { currency, currencySymbol } = useSiteSettings();

  // Toast notification context & local fallback (always portaled to document.body at z-[99999])
  const toastContext = useToast();
  const [localToast, setLocalToast] = React.useState<ToastData | null>(null);

  const showToast = React.useCallback(
    (message: string, type: ToastType = "success", options?: { title?: string; duration?: number }) => {
      if (toastContext.isAvailable) {
        toastContext.showToast(message, type, options);
      } else {
        setLocalToast({ message, type, title: options?.title, duration: options?.duration });
      }
    },
    [toastContext]
  );

  // ─── URL-DRIVEN SERVER-SIDE PAGINATION & FILTER STATE ────────────────────────
  const pageParam = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSizeParam = Number(searchParams.get("pageSize")) || 10;
  const searchParam = searchParams.get("search") || "";
  const channelParam = searchParams.get("channel") || "all";
  const paymentParam = searchParams.get("payment") || "all";
  const sortByParam = searchParams.get("sortBy") || "placed_at";
  const sortOrderParam = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

  const [page, setPage] = React.useState<number>(pageParam);
  const [pageSize, setPageSize] = React.useState<number>(pageSizeParam);
  const [searchQuery, setSearchQuery] = React.useState<string>(searchParam);
  const [debouncedSearch, setDebouncedSearch] = React.useState<string>(searchParam);
  const [selectedTab, setSelectedTab] = React.useState<string>(() => {
    if (statusParam && validStatusTabs.includes(statusParam)) {
      return statusParam;
    }
    return "all";
  });
  const [channelFilter, setChannelFilter] = React.useState<string>(channelParam);
  const [paymentFilter, setPaymentFilter] = React.useState<string>(paymentParam);
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: sortByParam, desc: sortOrderParam === "desc" },
  ]);

  // Debounce search query by 300ms
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Helper to sync state changes to URL query parameters
  const updateUrl = React.useCallback(
    (updates: {
      page?: number;
      pageSize?: number;
      status?: string;
      channel?: string;
      payment?: string;
      search?: string;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
    }) => {
      const params = new URLSearchParams(searchParams.toString());

      const newPage = updates.page !== undefined ? updates.page : page;
      if (newPage > 1) params.set("page", String(newPage));
      else params.delete("page");

      const newPageSize = updates.pageSize !== undefined ? updates.pageSize : pageSize;
      if (newPageSize !== 10) params.set("pageSize", String(newPageSize));
      else params.delete("pageSize");

      const newStatus = updates.status !== undefined ? updates.status : selectedTab;
      if (newStatus && newStatus !== "all") params.set("status", newStatus);
      else params.delete("status");

      const newChannel = updates.channel !== undefined ? updates.channel : channelFilter;
      if (newChannel && newChannel !== "all") params.set("channel", newChannel);
      else params.delete("channel");

      const newPayment = updates.payment !== undefined ? updates.payment : paymentFilter;
      if (newPayment && newPayment !== "all") params.set("payment", newPayment);
      else params.delete("payment");

      const newSearch = updates.search !== undefined ? updates.search : debouncedSearch;
      if (newSearch) params.set("search", newSearch);
      else params.delete("search");

      const currentSort = sorting[0];
      const newSortBy = updates.sortBy !== undefined ? updates.sortBy : currentSort?.id;
      const newSortOrder =
        updates.sortOrder !== undefined ? updates.sortOrder : currentSort?.desc ? "desc" : "asc";
      if (newSortBy && (newSortBy !== "placed_at" || newSortOrder !== "desc")) {
        params.set("sortBy", newSortBy);
        params.set("sortOrder", newSortOrder);
      } else {
        params.delete("sortBy");
        params.delete("sortOrder");
      }

      const queryString = params.toString();
      router.push(`/admin/orders${queryString ? `?${queryString}` : ""}`, { scroll: false });
    },
    [searchParams, page, pageSize, selectedTab, channelFilter, paymentFilter, debouncedSearch, sorting, router]
  );

  // Sync state when browser back/forward buttons are pressed
  React.useEffect(() => {
    const p = Math.max(1, Number(searchParams.get("page")) || 1);
    const ps = Number(searchParams.get("pageSize")) || 10;
    const st = searchParams.get("status") || "all";
    const ch = searchParams.get("channel") || "all";
    const pay = searchParams.get("payment") || "all";
    const s = searchParams.get("search") || "";
    const sb = searchParams.get("sortBy") || "placed_at";
    const so = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    setPage(p);
    setPageSize(ps);
    if (validStatusTabs.includes(st)) {
      setSelectedTab(st);
    }
    setChannelFilter(ch);
    setPaymentFilter(pay);
    setSearchQuery((prev) => (prev === debouncedSearch ? s : prev));
    setDebouncedSearch(s);
    setSorting([{ id: sb, desc: so === "desc" }]);
  }, [searchParams]);

  // When debounced search query changes and differs from URL, reset page to 1 and update URL
  React.useEffect(() => {
    const currentUrlSearch = searchParams.get("search") || "";
    if (debouncedSearch !== currentUrlSearch) {
      setPage(1);
      updateUrl({ search: debouncedSearch, page: 1 });
    }
  }, [debouncedSearch, searchParams, updateUrl]);

  const currentSort = sorting[0];
  const activeSortBy = currentSort?.id || "placed_at";
  const activeSortOrder: "asc" | "desc" = currentSort?.desc ? "desc" : "asc";

  // ─── TANSTACK QUERY: SERVER ACTION SSR HYDRATED QUERY ───────────────────────
  const {
    data: ordersResult,
    isLoading: isOrdersLoading,
    isFetching: isOrdersFetching,
    refetch: refetchOrders,
  } = useQuery({
    queryKey: [
      "admin",
      "orders",
      {
        page,
        pageSize,
        status: selectedTab,
        channel: channelFilter,
        payment: paymentFilter,
        search: debouncedSearch,
        sortBy: activeSortBy,
        sortOrder: activeSortOrder,
      },
    ],
    queryFn: () =>
      getOrdersAction({
        page,
        pageSize,
        status: selectedTab,
        channel: channelFilter,
        payment: paymentFilter,
        search: debouncedSearch,
        sortBy: activeSortBy,
        sortOrder: activeSortOrder,
      }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const orders = ordersResult?.orders || [];
  const totalCount = ordersResult?.totalCount ?? 0;
  const pageCount = ordersResult?.pageCount ?? 1;
  const counts = ordersResult?.statusCounts || {
    all: 0,
    incomplete_order: 0,
    pending: 0,
    confirmed: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    partially_delivered: 0,
    cancelled: 0,
    returned: 0,
  };
  const totalRevenue = ordersResult?.totalRevenue ?? 0;
  const filteredOrders = orders;

  // Intelligent Background Prefetching (0ms perceived latency for Next/Prev page)
  React.useEffect(() => {
    if (ordersResult?.hasMore || page < pageCount) {
      queryClient.prefetchQuery({
        queryKey: [
          "admin",
          "orders",
          {
            page: page + 1,
            pageSize,
            status: selectedTab,
            channel: channelFilter,
            payment: paymentFilter,
            search: debouncedSearch,
            sortBy: activeSortBy,
            sortOrder: activeSortOrder,
          },
        ],
        queryFn: () =>
          getOrdersAction({
            page: page + 1,
            pageSize,
            status: selectedTab,
            channel: channelFilter,
            payment: paymentFilter,
            search: debouncedSearch,
            sortBy: activeSortBy,
            sortOrder: activeSortOrder,
          }),
      });
    }

    if (page > 1) {
      queryClient.prefetchQuery({
        queryKey: [
          "admin",
          "orders",
          {
            page: page - 1,
            pageSize,
            status: selectedTab,
            channel: channelFilter,
            payment: paymentFilter,
            search: debouncedSearch,
            sortBy: activeSortBy,
            sortOrder: activeSortOrder,
          },
        ],
        queryFn: () =>
          getOrdersAction({
            page: page - 1,
            pageSize,
            status: selectedTab,
            channel: channelFilter,
            payment: paymentFilter,
            search: debouncedSearch,
            sortBy: activeSortBy,
            sortOrder: activeSortOrder,
          }),
      });
    }
  }, [
    ordersResult,
    page,
    pageCount,
    pageSize,
    selectedTab,
    channelFilter,
    paymentFilter,
    debouncedSearch,
    activeSortBy,
    activeSortOrder,
    queryClient,
  ]);

  // TanStack Table Pagination & Sorting bindings
  const paginationState = React.useMemo<PaginationState>(
    () => ({
      pageIndex: page - 1,
      pageSize,
    }),
    [page, pageSize]
  );

  const handlePaginationChange = React.useCallback(
    (updaterOrValue: any) => {
      const nextPagination =
        typeof updaterOrValue === "function" ? updaterOrValue(paginationState) : updaterOrValue;

      const newPage = nextPagination.pageIndex + 1;
      const newPageSize = nextPagination.pageSize;

      setPage(newPage);
      setPageSize(newPageSize);

      updateUrl({
        page: newPage,
        pageSize: newPageSize,
      });
    },
    [paginationState, updateUrl]
  );

  const handleSortingChange = React.useCallback(
    (updaterOrValue: any) => {
      const nextSorting =
        typeof updaterOrValue === "function" ? updaterOrValue(sorting) : updaterOrValue;

      setSorting(nextSorting);
      setPage(1);

      const s = nextSorting[0];
      updateUrl({
        page: 1,
        sortBy: s?.id || "placed_at",
        sortOrder: s?.desc ? "desc" : "asc",
      });
    },
    [sorting, updateUrl]
  );

  const { data: catalogProducts = availableCatalogProducts } = useQuery({
    queryKey: ["admin", "catalog-products"],
    queryFn: fetchCatalogProductsFromDb,
  });

  const { data: geoData } = useQuery({
    queryKey: ["admin", "geo-data"],
    queryFn: async () => {
      const [geoAll, dbDistricts] = await Promise.all([
        fetchGeoDivisionsAndDistricts(),
        fetchGeoDistricts(),
      ]);
      return {
        divisions: geoAll.divisions && geoAll.divisions.length > 0 ? geoAll.divisions : fallbackDivisions,
        districts: dbDistricts && dbDistricts.length > 0 ? dbDistricts : fallbackDistricts,
      };
    },
  });

  const geoDivisions = geoData?.divisions || fallbackDivisions;
  const [geoDistricts, setGeoDistricts] = React.useState<DbGeoDistrict[]>(geoData?.districts || fallbackDistricts);

  React.useEffect(() => {
    if (geoData?.districts && geoData.districts.length > 0) {
      setGeoDistricts(geoData.districts);
    }
  }, [geoData]);

  // ─── TANSTACK QUERY: MUTATIONS ──────────────────────────────────────────────

  const createOrderMutation = useMutation({
    mutationFn: (newOrder: Order) => createOrderInDb(newOrder),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      showToast(`Order ${created.id} successfully created and synced to database!`, "success");
    },
    onError: (err: any) => {
      console.error("Order creation failed:", err);
      const parsed = parseDatabaseError(err);
      showToast(parsed.message, "destructive", { title: parsed.title, duration: 8000 });
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: (updated: Order) => updateOrderInDb(updated),
    onSuccess: (updated) => {
      // 1. Immediately update TanStack Query cache so all hooks and tables see fresh data without waiting for network refetch
      queryClient.setQueryData<Order[]>(["admin", "orders"], (old = []) =>
        old.map((o) => (o.id === updated.id ? updated : o))
      );
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });

      // 2. Synchronize all local modal states immediately
      if (selectedOrder?.id === updated.id) {
        setSelectedOrder(updated);
      }
      if (statusOrder?.id === updated.id) {
        setStatusOrder(updated);
      }
      if (noteOrder?.id === updated.id) {
        setNoteOrder(updated);
      }
      if (paymentOrder?.id === updated.id) {
        setPaymentOrder(updated);
      }
      setBulkSelectedOrders((prev) =>
        prev.map((o) => (o.id === updated.id ? updated : o))
      );

      // 3. Clear any stale error messages from previous attempts
      setStatusError(null);
      setBulkStatusError(null);

      showToast(`Order ${updated.id} successfully updated and synced!`, "success");
    },
    onError: (err: any) => {
      console.error("Order update failed:", err);
      const parsed = parseDatabaseError(err);
      showToast(parsed.message, "destructive", { title: parsed.title, duration: 8000 });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      orderId,
      newStatus,
      cancelReason,
      eventMsg,
      currentOrder,
      courierName,
    }: {
      orderId: string;
      newStatus: Order["status"];
      cancelReason?: string;
      eventMsg?: string;
      currentOrder?: Order;
      courierName?: string;
    }) => {
      return await updateOrderStatusInDb(orderId, newStatus, cancelReason, eventMsg, currentOrder, courierName);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<Order[]>(["admin", "orders"], (old = []) =>
        old.map((o) => (o.id === updated.id ? updated : o))
      );
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      if (selectedOrder?.id === updated.id) {
        setSelectedOrder(updated);
      }
      if (statusOrder?.id === updated.id) {
        setStatusOrder(updated);
      }
      setBulkSelectedOrders((prev) =>
        prev.map((o) => (o.id === updated.id ? updated : o))
      );
      setIsStatusOpen(false);
      setStatusError(null);
      showToast(`Order ${updated.id} status changed to ${updated.status.replace(/_/g, " ").toUpperCase()} and synced!`, "success");
    },
    onError: (err: any) => {
      console.error("Failed to update status:", err);
      const parsed = parseDatabaseError(err);
      setStatusError(parsed);
      showToast(
        parsed.message,
        "destructive",
        {
          title: parsed.title,
          duration: 9000,
        }
      );
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async ({
      orderId,
      note,
      currentOrder,
    }: {
      orderId: string;
      note: OrderNote;
      currentOrder?: Order;
    }) => {
      const resolvedOrder =
        currentOrder ||
        orders.find((o) => o.id === orderId) ||
        (selectedOrder?.id === orderId ? selectedOrder : undefined);
      return await addOrderNoteInDb(orderId, note, resolvedOrder);
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      if (selectedOrder?.id === updated.id) {
        setSelectedOrder(updated);
      }
      if (noteOrder?.id === updated.id) {
        setNoteOrder(updated);
      }
      showToast(`Note recorded and synced on ${updated.id}!`, "info");
    },
    onError: (err: any) => {
      console.error("Failed to add note:", err);
      showToast("Failed to sync note to database", "destructive");
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: async ({
      orderId,
      noteId,
      text,
      type,
      currentOrder,
    }: {
      orderId: string;
      noteId: string;
      text: string;
      type?: OrderNoteType;
      currentOrder?: Order;
    }) => {
      const resolvedOrder =
        currentOrder ||
        orders.find((o) => o.id === orderId) ||
        (selectedOrder?.id === orderId ? selectedOrder : undefined);
      return await updateOrderNoteInDb(orderId, noteId, text, type, resolvedOrder);
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      if (selectedOrder?.id === updated.id) {
        setSelectedOrder(updated);
      }
      if (noteOrder?.id === updated.id) {
        setNoteOrder(updated);
      }
      setIsEditNoteOpen(false);
      setEditingNote(null);
      showToast("Note updated and synced to database!", "success");
    },
    onError: (err: any) => {
      console.error("Failed to update note:", err);
      showToast("Failed to sync note update to database", "destructive");
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async ({
      orderId,
      noteId,
      currentOrder,
    }: {
      orderId: string;
      noteId: string;
      currentOrder?: Order;
    }) => {
      const resolvedOrder =
        currentOrder ||
        orders.find((o) => o.id === orderId) ||
        (selectedOrder?.id === orderId ? selectedOrder : undefined);
      return await deleteOrderNoteInDb(orderId, noteId, resolvedOrder);
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      if (selectedOrder?.id === updated.id) {
        setSelectedOrder(updated);
      }
      if (noteOrder?.id === updated.id) {
        setNoteOrder(updated);
      }
      setDeletingNoteTarget(null);
      setIsEditNoteOpen(false);
      setEditingNote(null);
      showToast("Note deleted and synced.", "info");
    },
    onError: (err: any) => {
      console.error("Failed to delete note:", err);
      showToast("Failed to sync note deletion to database", "destructive");
    },
  });

  const deleteOrderMutation = useMutation({
    mutationFn: (orderId: string) => deleteOrderInDb(orderId),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      if (selectedOrder?.id === deletedId) {
        setSelectedOrder(null);
        setIsViewOpen(false);
      }
      setIsDeleteOpen(false);
      showToast(`Order ${deletedId} permanently deleted and synced.`, "destructive");
    },
    onError: (err: any) => {
      console.error("Failed to delete order:", err);
      showToast("Failed to sync deletion to database", "destructive");
    },
  });

  const bulkStatusMutation = useMutation({
    mutationFn: async ({
      orderIds,
      targetStatus,
      batchNote,
      courierName,
    }: {
      orderIds: string[];
      targetStatus: Order["status"];
      batchNote?: string;
      courierName?: string;
    }): Promise<BulkStatusUpdateResult> => {
      return await bulkUpdateOrderStatusInDb(orderIds, targetStatus, batchNote, courierName);
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      setIsBulkStatusOpen(false);
      setBulkStatusError(null);
      if (clearSelectionFn) clearSelectionFn();

      if (result.skippedCount > 0 && result.updatedCount > 0) {
        showToast(
          `Updated ${result.updatedCount} order(s) to ${variables.targetStatus.replace(/_/g, " ")}. ${result.skippedCount} order(s) skipped (${result.skippedOrders.map((o) => o.id).join(", ")}) due to missing details or workflow rules.`,
          "warning",
          {
            title: "Partial Status Update Completed",
            duration: 10000,
          }
        );
      } else {
        showToast(
          `Updated status to ${variables.targetStatus.replace(/_/g, " ")} for all ${result.updatedCount} order(s).`,
          "success"
        );
      }
    },
    onError: (err: any) => {
      console.warn("Bulk status validation notice:", err?.message || err);
      const parsed = parseDatabaseError(err);
      setBulkStatusError(parsed);
      showToast(
        parsed.message,
        "destructive",
        {
          title: parsed.title,
          duration: 9000,
        }
      );
    },
  });

  const bulkCourierMutation = useMutation({
    mutationFn: async ({
      orderIds,
      courierName,
      batchNote,
    }: {
      orderIds: string[];
      courierName: string;
      batchNote?: string;
    }): Promise<BulkCourierUpdateResult> => {
      return await bulkAssignCourierInDb(orderIds, courierName, batchNote);
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      setIsBulkCourierOpen(false);
      setBulkCourierError(null);
      if (clearSelectionFn) clearSelectionFn();

      if (result.skippedCount > 0 && result.updatedCount > 0) {
        showToast(
          `Assigned ${variables.courierName} to ${result.updatedCount} order(s). ${result.skippedCount} order(s) skipped (${result.skippedOrders.map((o) => o.id).join(", ")}) because they are cancelled, returned, or delivered.`,
          "warning",
          {
            title: "Partial Courier Assignment",
            duration: 10000,
          }
        );
      } else {
        showToast(
          `Assigned ${variables.courierName} to all ${result.updatedCount} order(s).`,
          "success"
        );
      }
    },
    onError: (err: any) => {
      console.error("Bulk courier error:", err);
      const parsed = parseDatabaseError(err);
      setBulkCourierError(parsed);
      showToast(parsed.message, "destructive", {
        title: parsed.title,
        duration: 9000,
      });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (orderIds: string[]): Promise<BulkDeleteResult> => {
      return await bulkDeleteOrdersInDb(orderIds);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      setIsBulkDeleteOpen(false);
      setBulkDeleteError(null);
      if (clearSelectionFn) clearSelectionFn();

      if (result.skippedCount > 0 && result.deletedCount > 0) {
        showToast(
          `Deleted ${result.deletedCount} order(s). ${result.skippedCount} order(s) skipped (${result.skippedOrders.map((o) => o.id).join(", ")}) because they are already shipped or delivered.`,
          "warning",
          {
            title: "Partial Deletion Completed",
            duration: 10000,
          }
        );
      } else {
        showToast(`Deleted ${result.deletedCount} order(s).`, "destructive");
      }
    },
    onError: (err: any) => {
      console.error("Bulk delete error:", err);
      const parsed = parseDatabaseError(err);
      setBulkDeleteError(parsed);
      showToast(parsed.message, "destructive", {
        title: parsed.title,
        duration: 9000,
      });
    },
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async ({
      orderId,
      amountPaid,
      paymentStatus,
      paymentMethod,
      transactionRef,
      noteText,
      currentOrder,
    }: {
      orderId: string;
      amountPaid: number;
      paymentStatus: Order["payment"];
      paymentMethod?: Order["method"];
      transactionRef?: string;
      noteText?: string;
      currentOrder?: Order;
    }) => {
      return await recordOrderPaymentInDb(
        orderId,
        amountPaid,
        paymentStatus,
        paymentMethod,
        transactionRef,
        noteText,
        currentOrder
      );
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      if (selectedOrder?.id === updated.id) {
        setSelectedOrder(updated);
      }
      setIsPaymentOpen(false);
      showToast(
        `Payment recorded for ${updated.id}: ৳ ${updated.amount_paid.toLocaleString()} (${updated.payment.replace(/_/g, " ")}).`,
        "success"
      );
    },
    onError: (err: any) => {
      console.error("Payment recording error:", err);
      showToast(err?.message || "Failed to record payment", "destructive");
    },
  });

  // ─── FILTER & TAB STATE ──────────────────────────────────────────────────────

  const handleTabChange = (val: string) => {
    setSelectedTab(val);
    setPage(1);
    updateUrl({ status: val, page: 1 });
  };

  // Horizontally scrollable status tabs ref & overflow indicators
  const tabsContainerRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);

  const checkScrollPosition = React.useCallback(() => {
    const el = tabsContainerRef.current;
    if (!el) return;
    const hasOverflow = el.scrollWidth > el.clientWidth;
    setCanScrollLeft(hasOverflow && el.scrollLeft > 6);
    setCanScrollRight(hasOverflow && el.scrollLeft < el.scrollWidth - el.clientWidth - 6);
  }, []);

  React.useEffect(() => {
    const el = tabsContainerRef.current;
    if (!el) return;
    checkScrollPosition();
    el.addEventListener("scroll", checkScrollPosition, { passive: true });
    window.addEventListener("resize", checkScrollPosition);
    return () => {
      el.removeEventListener("scroll", checkScrollPosition);
      window.removeEventListener("resize", checkScrollPosition);
    };
  }, [checkScrollPosition]);

  // Smoothly center active tab when selected or when URL parameter loads
  React.useEffect(() => {
    if (!tabsContainerRef.current) return;
    const timer = setTimeout(() => {
      const activeEl = tabsContainerRef.current?.querySelector<HTMLElement>(
        `[data-active], [data-state="active"], [aria-selected="true"]`
      );
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
      checkScrollPosition();
    }, 80);
    return () => clearTimeout(timer);
  }, [selectedTab, checkScrollPosition]);

  // Support natural horizontal scroll with standard mouse wheel
  const handleTabsWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (tabsContainerRef.current && e.deltaY !== 0 && !e.shiftKey) {
      tabsContainerRef.current.scrollLeft += e.deltaY;
    }
  };

  const scrollTabsBy = (offset: number) => {
    if (tabsContainerRef.current) {
      tabsContainerRef.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  };

  // Dialog & Sheet States
  const [selectedOrder, setSelectedOrder] = React.useState<Order | null>(null);
  const [isViewOpen, setIsViewOpen] = React.useState(false);

  // Unified Order Dialog State (for creating and editing)
  const [orderModalState, setOrderModalState] = React.useState<{
    open: boolean;
    mode: "create" | "edit";
    order?: Order | null;
  }>({
    open: false,
    mode: "create",
    order: null,
  });

  const [statusOrder, setStatusOrder] = React.useState<Order | null>(null);
  const [newStatus, setNewStatus] = React.useState<Order["status"]>("pending");
  const [cancelReason, setCancelReason] = React.useState("");
  const [selectedCourier, setSelectedCourier] = React.useState("");
  const [notifyCustomer, setNotifyCustomer] = React.useState(true);
  const [isStatusOpen, setIsStatusOpen] = React.useState(false);
  const [statusError, setStatusError] = React.useState<ParsedDatabaseError | null>(null);

  const [paymentOrder, setPaymentOrder] = React.useState<Order | null>(null);
  const [isPaymentOpen, setIsPaymentOpen] = React.useState(false);

  const [noteOrder, setNoteOrder] = React.useState<Order | null>(null);
  const [isNoteOpen, setIsNoteOpen] = React.useState(false);
  const [editingNote, setEditingNote] = React.useState<{
    id: string;
    text: string;
    type: OrderNoteType;
    orderId: string;
    author?: string;
  } | null>(null);
  const [isEditNoteOpen, setIsEditNoteOpen] = React.useState(false);
  const [noteFilterType, setNoteFilterType] = React.useState<"all" | OrderNoteType>("all");

  const [deletingOrder, setDeletingOrder] = React.useState<Order | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);

  const [deletingNoteTarget, setDeletingNoteTarget] = React.useState<{
    orderId: string;
    noteId: string;
    text: string;
    type: OrderNoteType;
    currentOrder?: Order;
  } | null>(null);

  // Bulk Operations State & Handlers
  const [bulkSelectedOrders, setBulkSelectedOrders] = React.useState<Order[]>([]);
  const [clearSelectionFn, setClearSelectionFn] = React.useState<(() => void) | null>(null);

  const [isBulkStatusOpen, setIsBulkStatusOpen] = React.useState(false);
  const [bulkTargetStatus, setBulkTargetStatus] = React.useState<Order["status"]>("confirmed");
  const [bulkTargetCourierForStatus, setBulkTargetCourierForStatus] = React.useState("Steadfast Courier");
  const [bulkStatusNote, setBulkStatusNote] = React.useState("");
  const [bulkStatusError, setBulkStatusError] = React.useState<ParsedDatabaseError | null>(null);

  const [isBulkCourierOpen, setIsBulkCourierOpen] = React.useState(false);
  const [bulkTargetCourier, setBulkTargetCourier] = React.useState("Steadfast Courier");
  const [bulkCourierNote, setBulkCourierNote] = React.useState("");
  const [bulkCourierError, setBulkCourierError] = React.useState<ParsedDatabaseError | null>(null);

  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = React.useState(false);
  const [bulkDeleteError, setBulkDeleteError] = React.useState<ParsedDatabaseError | null>(null);

  // Derive live, up-to-date versions of statusOrder and bulkSelectedOrders from TanStack Query orders
  const effectiveStatusOrder = React.useMemo(() => {
    if (!statusOrder) return null;
    return orders.find((o) => o.id === statusOrder.id) || statusOrder;
  }, [orders, statusOrder]);

  const effectiveBulkSelectedOrders = React.useMemo(() => {
    return bulkSelectedOrders.map((bo) => orders.find((o) => o.id === bo.id) || bo);
  }, [orders, bulkSelectedOrders]);

  // Synchronize modal states whenever orders cache updates
  React.useEffect(() => {
    if (statusOrder) {
      const fresh = orders.find((o) => o.id === statusOrder.id);
      if (fresh && fresh !== statusOrder) {
        setStatusOrder(fresh);
      }
    }
  }, [orders, statusOrder]);

  React.useEffect(() => {
    if (selectedOrder) {
      const fresh = orders.find((o) => o.id === selectedOrder.id);
      if (fresh && fresh !== selectedOrder) {
        setSelectedOrder(fresh);
      }
    }
  }, [orders, selectedOrder]);

  React.useEffect(() => {
    if (bulkSelectedOrders.length > 0) {
      const freshList = bulkSelectedOrders.map((bo) => orders.find((o) => o.id === bo.id) || bo);
      const hasChanged = freshList.some((fresh, idx) => fresh !== bulkSelectedOrders[idx]);
      if (hasChanged) {
        setBulkSelectedOrders(freshList);
      }
    }
  }, [orders, bulkSelectedOrders]);

  // Single Order Status Pre-validation Eligibility
  const singleStatusEligibility = React.useMemo(() => {
    if (!isStatusOpen || !effectiveStatusOrder) {
      return { valid: true, reason: undefined, code: undefined };
    }
    return validateOrderStatusTransition(
      effectiveStatusOrder.status,
      newStatus,
      effectiveStatusOrder.customer,
      effectiveStatusOrder.phone,
      effectiveStatusOrder.address?.address_line,
      effectiveStatusOrder.items?.length,
      selectedCourier || effectiveStatusOrder.courier_name,
      cancelReason
    );
  }, [isStatusOpen, effectiveStatusOrder, newStatus, selectedCourier, cancelReason]);

  // Auto-clear stale status error if the order was updated and now satisfies eligibility
  React.useEffect(() => {
    if (statusError && singleStatusEligibility.valid) {
      if (
        statusError.code === "CUSTOMER_NAME_REQUIRED" ||
        statusError.code === "CUSTOMER_PHONE_REQUIRED" ||
        statusError.code === "CUSTOMER_ADDRESS_REQUIRED" ||
        statusError.code === "ORDER_ITEMS_REQUIRED" ||
        statusError.code === "COURIER_REQUIRED" ||
        statusError.code === "CANCEL_REASON_REQUIRED" ||
        statusError.message.includes("Customer name") ||
        statusError.message.includes("mobile number") ||
        statusError.message.includes("product item") ||
        statusError.message.includes("address") ||
        statusError.message.includes("Courier")
      ) {
        setStatusError(null);
      }
    }
  }, [singleStatusEligibility, statusError]);

  const handleOpenBulkStatus = (ordersList: Order[], status: Order["status"], clearFn: () => void) => {
    const freshOrders = ordersList.map((o) => orders.find((fresh) => fresh.id === o.id) || o);
    setBulkSelectedOrders(freshOrders);
    setBulkTargetStatus(status);
    setBulkStatusNote("");
    setBulkStatusError(null);
    const existingCourier = freshOrders.find((o) => o.courier_name)?.courier_name || "Steadfast Courier";
    setBulkTargetCourierForStatus(existingCourier);
    setClearSelectionFn(() => clearFn);
    setIsBulkStatusOpen(true);
  };

  const bulkEligibility = React.useMemo(() => {
    if (!isBulkStatusOpen || effectiveBulkSelectedOrders.length === 0) {
      return { eligible: [] as Order[], ineligible: [] as { order: Order; reason: string }[] };
    }
    const eligible: Order[] = [];
    const ineligible: { order: Order; reason: string }[] = [];
    const isAdvancingToDispatch =
      bulkTargetStatus === "processing" ||
      bulkTargetStatus === "shipped" ||
      bulkTargetStatus === "delivered" ||
      bulkTargetStatus === "partially_delivered";

    for (const o of effectiveBulkSelectedOrders) {
      const effectiveCourier = isAdvancingToDispatch
        ? (bulkTargetCourierForStatus || o.courier_name)
        : o.courier_name;

      const val = validateOrderStatusTransition(
        o.status,
        bulkTargetStatus,
        o.customer,
        o.phone,
        o.address?.address_line,
        o.items?.length,
        effectiveCourier,
        bulkTargetStatus === "cancelled" || bulkTargetStatus === "returned" ? bulkStatusNote : undefined
      );
      if (val.valid) {
        eligible.push(o);
      } else {
        ineligible.push({ order: o, reason: val.reason || "Ineligible for status transition" });
      }
    }
    return { eligible, ineligible };
  }, [isBulkStatusOpen, effectiveBulkSelectedOrders, bulkTargetStatus, bulkTargetCourierForStatus, bulkStatusNote]);

  const handleConfirmBulkStatus = () => {
    if (bulkEligibility.eligible.length === 0) return;
    const isAdvancingToDispatch =
      bulkTargetStatus === "processing" ||
      bulkTargetStatus === "shipped" ||
      bulkTargetStatus === "delivered" ||
      bulkTargetStatus === "partially_delivered";

    bulkStatusMutation.mutate({
      orderIds: effectiveBulkSelectedOrders.map((o) => o.id),
      targetStatus: bulkTargetStatus,
      batchNote: bulkStatusNote,
      courierName: isAdvancingToDispatch ? bulkTargetCourierForStatus : undefined,
    });
  };

  // Auto-clear stale bulk status error if all selected orders now satisfy eligibility
  React.useEffect(() => {
    if (bulkStatusError && bulkEligibility.ineligible.length === 0) {
      setBulkStatusError(null);
    }
  }, [bulkEligibility, bulkStatusError]);

  const handleOpenBulkCourier = (ordersList: Order[], courier: string, clearFn: () => void) => {
    const freshOrders = ordersList.map((o) => orders.find((fresh) => fresh.id === o.id) || o);
    setBulkSelectedOrders(freshOrders);
    setBulkTargetCourier(courier);
    setBulkCourierNote("");
    setBulkCourierError(null);
    setClearSelectionFn(() => clearFn);
    setIsBulkCourierOpen(true);
  };

  const bulkCourierEligibility = React.useMemo(() => {
    if (!isBulkCourierOpen || effectiveBulkSelectedOrders.length === 0) {
      return { eligible: [] as Order[], ineligible: [] as { order: Order; reason: string }[] };
    }
    const eligible: Order[] = [];
    const ineligible: { order: Order; reason: string }[] = [];

    for (const o of effectiveBulkSelectedOrders) {
      if (o.status === "cancelled" || o.status === "returned") {
        ineligible.push({
          order: o,
          reason: `Order is already ${o.status.replace(/_/g, " ")} and cannot be assigned a courier`,
        });
      } else if (o.status === "delivered") {
        ineligible.push({
          order: o,
          reason: "Order is already delivered and courier partner cannot be reassigned",
        });
      } else {
        eligible.push(o);
      }
    }
    return { eligible, ineligible };
  }, [isBulkCourierOpen, effectiveBulkSelectedOrders]);

  const handleConfirmBulkCourier = () => {
    if (bulkCourierEligibility.eligible.length === 0) return;
    bulkCourierMutation.mutate({
      orderIds: effectiveBulkSelectedOrders.map((o) => o.id),
      courierName: bulkTargetCourier,
      batchNote: bulkCourierNote,
    });
  };

  const handleOpenBulkDelete = (ordersList: Order[], clearFn: () => void) => {
    const freshOrders = ordersList.map((o) => orders.find((fresh) => fresh.id === o.id) || o);
    setBulkSelectedOrders(freshOrders);
    setBulkDeleteError(null);
    setClearSelectionFn(() => clearFn);
    setIsBulkDeleteOpen(true);
  };

  const bulkDeleteEligibility = React.useMemo(() => {
    if (!isBulkDeleteOpen || effectiveBulkSelectedOrders.length === 0) {
      return { eligible: [] as Order[], ineligible: [] as { order: Order; reason: string }[] };
    }
    const eligible: Order[] = [];
    const ineligible: { order: Order; reason: string }[] = [];

    for (const o of effectiveBulkSelectedOrders) {
      if (o.status === "shipped" || o.status === "delivered") {
        ineligible.push({
          order: o,
          reason: `Dispatched order (${o.status.replace(/_/g, " ")}) cannot be deleted`,
        });
      } else {
        eligible.push(o);
      }
    }
    return { eligible, ineligible };
  }, [isBulkDeleteOpen, effectiveBulkSelectedOrders]);

  const handleConfirmBulkDelete = () => {
    if (bulkDeleteEligibility.eligible.length === 0) return;
    bulkDeleteMutation.mutate(effectiveBulkSelectedOrders.map((o) => o.id));
  };

  const handleBulkPrintInvoices = (orders: Order[]) => {
    if (orders.length === 0) return;
    const ids = orders.map((o) => o.id).join(",");
    window.open(`/admin/orders/print?ids=${encodeURIComponent(ids)}&format=58mm`, "_blank");
  };

  const handleOpenPayment = (order: Order) => {
    setPaymentOrder(order);
    setIsPaymentOpen(true);
  };

  // TanStack Form for Add Note Dialog
  const addNoteForm = useForm({
    defaultValues: {
      text: "",
      type: "internal" as OrderNoteType,
    },
    onSubmit: async ({ value }) => {
      const validation = orderNoteFormSchema.safeParse(value);
      if (!validation.success) {
        showToast(validation.error.issues[0]?.message || "Invalid note details", "destructive");
        return;
      }
      if (!noteOrder) return;

      const isCustomer = validation.data.type === "customer";
      const newNoteObj: OrderNote = {
        id: `note-${Date.now()}`,
        author: isCustomer ? (noteOrder.customer ? `${noteOrder.customer} (Customer)` : "Customer") : "Admin Staff",
        text: validation.data.text.trim(),
        type: validation.data.type,
        created_at: new Date().toISOString().replace("T", " ").slice(0, 16),
      };

      addNoteMutation.mutate({
        orderId: noteOrder.id,
        note: newNoteObj,
        currentOrder: noteOrder,
      });

      setIsNoteOpen(false);
      addNoteForm.reset();
    },
  });


  // TanStack Form for Edit Note Dialog
  const editNoteForm = useForm({
    defaultValues: {
      text: "",
      type: "internal" as OrderNoteType,
    },
    onSubmit: async ({ value }) => {
      const validation = orderNoteFormSchema.safeParse(value);
      if (!validation.success) {
        showToast(validation.error.issues[0]?.message || "Invalid note details", "destructive");
        return;
      }
      if (!editingNote) return;

      updateNoteMutation.mutate({
        orderId: editingNote.orderId,
        noteId: editingNote.id,
        text: validation.data.text.trim(),
        type: value.type,
        currentOrder:
          selectedOrder?.id === editingNote.orderId
            ? selectedOrder
            : noteOrder?.id === editingNote.orderId
            ? noteOrder
            : orders.find((o) => o.id === editingNote.orderId),
      });
    },
  });

  // TanStack Form for Record / Update Payment Dialog
  const recordPaymentForm = useForm({
    defaultValues: {
      payment: "partially_paid" as Order["payment"],
      method: "bkash" as Order["method"],
      amount_paid: 0,
      transaction_ref: "",
      note: "",
    },
    onSubmit: async ({ value }) => {
      if (!paymentOrder) return;
      const valid = recordPaymentFormSchema.safeParse(value);
      if (!valid.success) {
        showToast(valid.error.issues[0]?.message || "Invalid payment details", "destructive");
        return;
      }
      recordPaymentMutation.mutate({
        orderId: paymentOrder.id,
        amountPaid: valid.data.amount_paid,
        paymentStatus: valid.data.payment,
        paymentMethod: valid.data.method,
        transactionRef: valid.data.transaction_ref,
        noteText: valid.data.note,
        currentOrder: paymentOrder,
      });
    },
  });

  React.useEffect(() => {
    if (isPaymentOpen && paymentOrder) {
      recordPaymentForm.reset({
        payment: paymentOrder.payment || "partially_paid",
        method: paymentOrder.method || "bkash",
        amount_paid: paymentOrder.amount_paid || 0,
        transaction_ref: "",
        note: "",
      });
    }
  }, [isPaymentOpen, paymentOrder, recordPaymentForm]);

  // ─── ROW EXPANSION & COPY HELPERS ─────────────────────────────────────────
  const [expandedRows, setExpandedRows] = React.useState<Record<string, boolean>>({});

  const toggleRowExpanded = React.useCallback((orderId: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  }, []);

  const allExpanded = React.useMemo(() => {
    if (filteredOrders.length === 0) return false;
    return filteredOrders.every((o) => !!expandedRows[o.id]);
  }, [filteredOrders, expandedRows]);

  const toggleExpandAll = React.useCallback(() => {
    if (allExpanded) {
      setExpandedRows({});
    } else {
      const next: Record<string, boolean> = {};
      filteredOrders.forEach((o) => {
        next[o.id] = true;
      });
      setExpandedRows(next);
    }
  }, [allExpanded, filteredOrders]);

  const copyToClipboard = React.useCallback((text: string, label: string) => {
    if (!text) return;
    try {
      navigator.clipboard?.writeText(text);
      showToast(`Copied ${label} to clipboard`, "info");
    } catch {
      // ignore
    }
  }, [showToast]);

  // Open Details Sheet
  const handleOpenView = (order: Order) => {
    const freshOrder = orders.find((o) => o.id === order.id) || order;
    setSelectedOrder(freshOrder);
    setIsViewOpen(true);
  };

  // Open Edit Dialog (Unified form)
  const handleOpenEdit = (order: Order) => {
    setIsViewOpen(false);
    const freshOrder = orders.find((o) => o.id === order.id) || order;
    setOrderModalState({
      open: true,
      mode: "edit",
      order: freshOrder,
    });
  };

  // Open Create Dialog (Unified form)
  const handleOpenCreate = () => {
    setOrderModalState({
      open: true,
      mode: "create",
      order: null,
    });
  };

  // Save handler for unified form
  const handleSaveOrder = async (savedOrder: Order, mode: "create" | "edit") => {
    if (mode === "create") {
      await createOrderMutation.mutateAsync(savedOrder);
    } else {
      await updateOrderMutation.mutateAsync(savedOrder);
    }
  };

  // Next status determination
  const getNextStatus = (current: Order["status"]): Order["status"] | null => {
    switch (current) {
      case "incomplete_order":
        return "pending";
      case "pending":
        return "confirmed";
      case "confirmed":
        return "processing";
      case "processing":
        return "shipped";
      case "shipped":
        return "delivered";
      case "delivered":
        return "partially_delivered";
      default:
        return null;
    }
  };

  // Quick advance status
  const handleQuickAdvanceStatus = (order: Order) => {
    const freshOrder = orders.find((o) => o.id === order.id) || order;
    const next = getNextStatus(freshOrder.status);
    if (!next) return;

    // Check if advancing to confirmed or higher requires missing details
    if (next !== "incomplete_order" && next !== "pending") {
      if (
        !freshOrder.customer ||
        freshOrder.customer.trim().length < 2 ||
        !freshOrder.items ||
        freshOrder.items.length === 0 ||
        !freshOrder.address?.address_line ||
        freshOrder.address.address_line.trim().length < 3
      ) {
        showToast(
          "Please edit order to fill required customer, products, or delivery address before advancing.",
          "destructive"
        );
        handleOpenEdit(freshOrder);
        return;
      }
    }

    // If advancing to processing or dispatched, ensure courier is assigned
    const requiresCourier =
      next === "processing" ||
      next === "shipped" ||
      next === "delivered" ||
      next === "partially_delivered";

    if (requiresCourier && (!freshOrder.courier_name || freshOrder.courier_name.trim().length < 2)) {
      handleOpenStatus(freshOrder, next);
      showToast(
        `Please assign a Courier Service before moving to ${next.replace(/_/g, " ").toUpperCase()}`,
        "info"
      );
      return;
    }

    const eventMsg = `Workflow advanced from ${freshOrder.status.replace(/_/g, " ").toUpperCase()} to ${next.replace(/_/g, " ").toUpperCase()}`;
    updateStatusMutation.mutate({
      orderId: freshOrder.id,
      newStatus: next,
      eventMsg,
      currentOrder: freshOrder,
      courierName: freshOrder.courier_name,
    });
  };

  // Open Status Dialog
  const handleOpenStatus = (order: Order, targetStatus?: Order["status"]) => {
    const freshOrder = orders.find((o) => o.id === order.id) || order;
    setStatusOrder(freshOrder);
    setNewStatus(targetStatus || freshOrder.status);
    setCancelReason(freshOrder.cancel_reason || "");
    setSelectedCourier(freshOrder.courier_name || "");
    setStatusError(null);
    setIsStatusOpen(true);
  };

  // Save Status Update
  const handleSaveStatus = () => {
    const targetOrder = effectiveStatusOrder;
    if (!targetOrder) return;

    const fromStatus = targetOrder.status;
    const updatedStatus = newStatus;

    // 1. Validation for confirmed and higher
    const isDraft = updatedStatus === "incomplete_order" || updatedStatus === "pending";
    const isTerminated = updatedStatus === "cancelled" || updatedStatus === "returned";
    const requiresCourier =
      updatedStatus === "processing" ||
      updatedStatus === "shipped" ||
      updatedStatus === "delivered" ||
      updatedStatus === "partially_delivered";

    if (!isDraft && !isTerminated) {
      if (!targetOrder.customer || targetOrder.customer.trim().length < 2) {
        showToast(
          "Customer name is required before setting status to Confirmed. Please edit the order.",
          "destructive"
        );
        return;
      }
      if (!targetOrder.items || targetOrder.items.length === 0) {
        showToast(
          "At least one product item is required before setting status to Confirmed. Please edit the order.",
          "destructive"
        );
        return;
      }
      if (!targetOrder.address?.address_line || targetOrder.address.address_line.trim().length < 3) {
        showToast(
          "Street delivery address is required before setting status to Confirmed. Please edit the order.",
          "destructive"
        );
        return;
      }
    }

    if (requiresCourier && (!selectedCourier || selectedCourier.trim().length < 2)) {
      showToast("Courier Service is required for processing or dispatched orders.", "destructive");
      return;
    }

    if (isTerminated && (!cancelReason || cancelReason.trim().length < 3)) {
      showToast(
        `Please provide a reason for marking order as ${updatedStatus.replace(/_/g, " ")}.`,
        "destructive"
      );
      return;
    }

    const eventMsg = `Status changed from ${fromStatus.replace(/_/g, " ")} to ${updatedStatus.replace(/_/g, " ")}${
      isTerminated && cancelReason ? `: ${cancelReason}` : ""
    }${requiresCourier && selectedCourier ? ` (Courier: ${selectedCourier})` : ""}${
      notifyCustomer ? " (Customer notified via SMS)" : ""
    }`;

    updateStatusMutation.mutate({
      orderId: targetOrder.id,
      newStatus: updatedStatus,
      cancelReason,
      eventMsg,
      currentOrder: targetOrder,
      courierName: selectedCourier,
    });
  };

  // Open Add Note Dialog
  const handleOpenNote = (order: Order, defaultType: OrderNoteType = "internal") => {
    setNoteOrder(order);
    addNoteForm.setFieldValue("text", "");
    addNoteForm.setFieldValue("type", defaultType);
    setIsNoteOpen(true);
  };

  // Open Edit Note Dialog (for notes in notes table)
  const handleOpenEditNote = (note: OrderNote, orderId: string) => {
    setEditingNote({
      id: note.id,
      text: note.text,
      type: note.type,
      orderId,
      author: note.author,
    });
    editNoteForm.setFieldValue("text", note.text);
    editNoteForm.setFieldValue("type", note.type);
    setIsEditNoteOpen(true);
  };

  // Open Edit Note Dialog specifically for customer note
  const handleOpenEditCustomerNote = (order: Order) => {
    setEditingNote({
      id: "customer_note",
      text: order.customer_note || "",
      type: "customer",
      orderId: order.id,
      author: order.customer ? `${order.customer} (Customer)` : "Customer",
    });
    editNoteForm.setFieldValue("text", order.customer_note || "");
    editNoteForm.setFieldValue("type", "customer");
    setIsEditNoteOpen(true);
  };

  // Keep Edit Note Form synchronized with editingNote
  React.useEffect(() => {
    if (editingNote && isEditNoteOpen) {
      editNoteForm.setFieldValue("text", editingNote.text);
      editNoteForm.setFieldValue("type", editingNote.type);
    }
  }, [editingNote, isEditNoteOpen]);

  // Open Delete Note Confirmation Modal
  const handleOpenDeleteNote = (
    noteId: string,
    orderId: string,
    text: string,
    type: OrderNoteType,
    currentOrder?: Order
  ) => {
    setDeletingNoteTarget({
      orderId,
      noteId,
      text,
      type,
      currentOrder,
    });
  };

  // Confirm Delete Note
  const handleConfirmDeleteNote = () => {
    if (!deletingNoteTarget) return;
    deleteNoteMutation.mutate({
      orderId: deletingNoteTarget.orderId,
      noteId: deletingNoteTarget.noteId,
      currentOrder: deletingNoteTarget.currentOrder,
    });
  };

  // Clear customer note
  const handleClearCustomerNote = (order: Order) => {
    handleOpenDeleteNote(
      "customer_note",
      order.id,
      order.customer_note || "",
      "customer",
      order
    );
  };

  // Open Delete Confirmation
  const handleOpenDelete = (order: Order) => {
    setDeletingOrder(order);
    setIsDeleteOpen(true);
  };

  // Confirm Delete
  const handleConfirmDelete = () => {
    if (!deletingOrder) return;
    deleteOrderMutation.mutate(deletingOrder.id);
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      "Order ID",
      "Customer",
      "Phone",
      "District",
      "Address",
      "Items Count",
      "Products",
      "Status",
      "Payment",
      "Method",
      "Channel",
      "Courier",
      "Grand Total (BDT)",
      "Amount Paid",
      "Due Balance",
      "Date & Time",
      "Customer Note (for seller)",
      "Delivery Notes (for delivery man)",
      "Packaging Notes (for packaging)",
      "Internal Staff Notes",
    ];
    const rows = filteredOrders.map((o) => {
      const delivNotes = (o.notes || []).filter((n) => n.type === "delivery").map((n) => n.text).join(" | ");
      const packNotes = (o.notes || []).filter((n) => n.type === "packaging").map((n) => n.text).join(" | ");
      const staffNotes = (o.notes || []).filter((n) => n.type === "internal").map((n) => n.text).join(" | ");
      return [
        o.id,
        `"${o.customer || ""}"`,
        `"${o.phone || ""}"`,
        `"${o.address?.district || ""}"`,
        `"${(o.address?.address_line || "").replace(/"/g, '""')}"`,
        (o.items || []).length,
        `"${(o.items || []).map((i) => `${i.quantity}x ${i.product_name}`).join("; ")}"`,
        o.status,
        o.payment,
        o.method,
        o.channel,
        `"${o.courier_name || "Unassigned"}"`,
        o.grand_total,
        o.amount_paid,
        Math.max(0, o.grand_total - o.amount_paid),
        formatDateTime(o.date),
        `"${(o.customer_note || "").replace(/"/g, '""')}"`,
        `"${delivNotes.replace(/"/g, '""')}"`,
        `"${packNotes.replace(/"/g, '""')}"`,
        `"${staffNotes.replace(/"/g, '""')}"`,
      ];
    });
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `gur_orders_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${filteredOrders.length} orders to CSV`, "info");
  };

  const channelBadgeColors: Record<string, string> = {
    web: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    phone: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800",
    whatsapp: "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300 border-green-200 dark:border-green-800",
    admin: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    facebook: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
    walk_in: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  };

  const orderColumns: ColumnDef<Order>[] = React.useMemo(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <div className="flex items-center gap-1">
            <Checkbox
              checked={
                table.getIsAllPageRowsSelected() ||
                (table.getIsSomePageRowsSelected() && "indeterminate")
              }
              onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
              aria-label="Select all"
              className="translate-y-[2px]"
            />
          </div>
        ),
        cell: ({ row }) => {
          const order = row.original;
          const isExpanded = !!expandedRows[order.id];
          return (
            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => toggleRowExpanded(order.id)}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title={isExpanded ? "Collapse item breakdown" : "Expand item breakdown"}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-amber-600" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
              <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={(value) => row.toggleSelected(!!value)}
                aria-label="Select row"
                className="translate-y-[2px]"
              />
            </div>
          );
        },
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "id",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Order & Date" />,
        cell: ({ row }) => {
          const order = row.original;
          const itemCount = (order.items || []).length;
          return (
            <div className="space-y-1 min-w-[120px]" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => handleOpenView(order)}
                  className="text-left font-mono text-xs font-bold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
                >
                  {order.id}
                </button>
                <span className="text-[10px] text-muted-foreground font-mono">
                  ({itemCount} {itemCount === 1 ? "item" : "items"})
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-mono uppercase px-1.5 py-0 font-bold",
                    channelBadgeColors[order.channel] || "bg-muted text-muted-foreground"
                  )}
                >
                  {order.channel}
                </Badge>
                <span className="text-[11px] font-medium text-foreground/80 whitespace-nowrap">
                  {formatDateTime(order.date)}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "customer",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Customer & Delivery" />,
        cell: ({ row }) => {
          const order = row.original;
          const district = order.address?.district;
          const addressLine = order.address?.address_line;

          return (
            <div className="space-y-1 min-w-[140px] max-w-[220px]">
              {/* Customer Name */}
              <p className="text-xs font-bold text-foreground leading-tight truncate">
                {order.customer || <span className="text-muted-foreground font-normal italic">Guest Customer</span>}
              </p>

              {/* Phone with click-to-call and 1-click copy */}
              {order.phone && (
                <div className="flex items-center gap-1 text-xs">
                  <a
                    href={`tel:${order.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-mono text-xs font-medium text-foreground/90 hover:text-amber-600 flex items-center gap-1 transition-colors"
                  >
                    <Phone className="h-3 w-3 text-amber-600 shrink-0" />
                    <span>{order.phone}</span>
                  </a>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(order.phone, "Phone number");
                    }}
                    className="text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
                    title="Copy phone"
                  >
                    <Copy className="h-2.5 w-2.5" />
                  </button>
                </div>
              )}

              {/* Destination: District Badge + Address Line */}
              <div className="space-y-0.5">
                {district && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50">
                    <MapPin className="h-2.5 w-2.5 text-rose-500 shrink-0" />
                    {district}
                  </span>
                )}
                {addressLine && (
                  <p className="text-[11px] text-muted-foreground truncate leading-normal" title={addressLine}>
                    {addressLine}
                  </p>
                )}
              </div>

              {/* Customer Checkout Delivery Instruction - Full Note Display */}
              {order.customer_note && (
                <div
                  className="p-2 rounded-lg bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 text-[11px] text-blue-950 dark:text-blue-100 space-y-0.5 mt-1"
                >
                  <div className="flex items-center gap-1 font-bold text-[10px] text-blue-800 dark:text-blue-300 uppercase tracking-wider">
                    <MessageSquare className="h-3 w-3 text-blue-600 shrink-0" />
                    <span>Customer Note:</span>
                  </div>
                  <p className="whitespace-pre-wrap leading-relaxed italic break-words">
                    &quot;{order.customer_note}&quot;
                  </p>
                </div>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status & Courier" />,
        cell: ({ row }) => {
          const order = row.original;
          return (
            <div className="space-y-1.5 min-w-[115px] max-w-[155px]">
              {/* Order Status Badge */}
              <div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenStatus(order);
                  }}
                  title="Click to update order status"
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold capitalize transition-all hover:ring-1 hover:ring-current cursor-pointer",
                    statusStyles[order.status] || "bg-muted text-muted-foreground"
                  )}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {order.status.replace(/_/g, " ")}
                </button>
              </div>

              {/* Fulfillment Status */}
              <div>
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-[10px] font-medium capitalize px-1.5 py-0.5",
                    order.fulfillment === "fulfilled"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : order.fulfillment === "partial"
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                      : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  )}
                >
                  <Truck className="h-3 w-3 mr-1" />
                  {order.fulfillment}
                </Badge>
              </div>

              {/* Courier Service & Tracking */}
              {order.courier_name ? (
                <div className="flex items-center gap-1 text-[11px] text-foreground font-medium">
                  <span className="inline-flex items-center gap-1 font-semibold text-blue-700 dark:text-blue-300 bg-blue-500/10 px-1.5 py-0.5 rounded text-[10px]">
                    <Truck className="h-2.5 w-2.5 text-blue-600" />
                    {order.courier_name}
                  </span>
                </div>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground italic">
                  No courier
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "grand_total",
        header: ({ column }) => (
          <div className="text-right">
            <DataTableColumnHeader column={column} title="Payment & Due" className="justify-end" />
          </div>
        ),
        cell: ({ row }) => {
          const order = row.original;
          const due = Math.max(0, order.grand_total - order.amount_paid);
          const percentPaid =
            order.grand_total > 0
              ? Math.min(100, Math.round((order.amount_paid / order.grand_total) * 100))
              : 0;

          return (
            <div className="text-right space-y-1 min-w-[105px] max-w-[135px]">
              {/* Grand Total */}
              <p className="font-bold text-sm font-mono text-foreground">
                ৳ {order.grand_total.toLocaleString()}
              </p>

              {/* Payment Status + Method Pill */}
              <div className="flex items-center justify-end gap-1 flex-wrap">
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenPayment(order);
                  }}
                  title="Click to record or update payment"
                  className={cn(
                    "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold capitalize cursor-pointer hover:ring-1 hover:ring-current",
                    paymentStyles[order.payment]
                  )}
                >
                  {order.payment.replace(/_/g, " ")}
                </span>
                <Badge variant="outline" className="text-[10px] font-mono uppercase px-1 py-0 font-normal">
                  {order.method.replace("_", " ")}
                </Badge>
              </div>

              {/* Financial Balance Summary - Highly Visible Due Balance */}
              {order.payment === "unpaid" && (
                <p className="text-[11px] font-mono font-bold text-rose-600 dark:text-rose-400">
                  Due ৳ {order.grand_total.toLocaleString()}
                </p>
              )}

              {order.payment === "partially_paid" && (
                <div className="space-y-0.5">
                  <div className="flex items-center justify-end gap-1 text-[10px] font-mono">
                    <span className="text-emerald-600 font-semibold">Paid ৳{order.amount_paid.toLocaleString()}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-rose-600 font-bold">Due ৳{due.toLocaleString()}</span>
                  </div>
                  <div className="w-20 ml-auto h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{ width: `${percentPaid}%` }}
                    />
                  </div>
                </div>
              )}

              {order.payment === "paid" && (
                <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Paid in Full
                </p>
              )}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: ({ column }) => (
          <div className="text-right pr-2">
            <DataTableColumnHeader column={column} title="Actions" className="justify-end" />
          </div>
        ),
        cell: ({ row }) => {
          const order = row.original;
          const internalNotes = (order.notes || []).filter((n) => n.type === "internal");
          const hasInternalNotes = internalNotes.length > 0;

          return (
            <div onClick={(e) => e.stopPropagation()} className="text-right space-y-2 min-w-[140px] max-w-[220px] ml-auto">
              {/* Action Buttons Row */}
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="View Order Details"
                  onClick={() => handleOpenView(order)}
                  className="cursor-pointer h-7 w-7 text-muted-foreground hover:text-foreground"
                >
                  <Eye className="h-4 w-4" />
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" className="cursor-pointer h-7 w-7 text-muted-foreground hover:text-foreground">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel>Order {order.id}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleOpenView(order)}>
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleOpenEdit(order)}>
                      <Edit className="h-4 w-4 mr-2 text-blue-600" />
                      Edit Order
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleOpenStatus(order)}>
                      <RefreshCw className="h-4 w-4 mr-2 text-amber-600" />
                      Update Status
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleOpenPayment(order)}>
                      <CreditCard className="h-4 w-4 mr-2 text-emerald-600" />
                      Record / Edit Payment
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleOpenNote(order)}>
                      <ShieldCheck className="h-4 w-4 mr-2 text-amber-600" />
                      Add Staff Note
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkPrintInvoices([order])}>
                      <Printer className="h-4 w-4 mr-2 text-amber-600" />
                      Print
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleOpenDelete(order)}
                      className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Order
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Only show full staff notes below action button */}
              <div className="space-y-1.5 w-full text-left max-h-52 overflow-y-auto pr-0.5">
                {hasInternalNotes ? (
                  <>
                    {internalNotes.map((note) => (
                      <div
                        key={note.id}
                        onClick={() => handleOpenNote(order)}
                        className="p-2 rounded-lg bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 text-[11px] text-amber-950 dark:text-amber-100 space-y-1 hover:bg-amber-500/20 transition-colors cursor-pointer"
                        title="Click to manage staff notes"
                      >
                        <div className="flex items-center justify-between gap-1 text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                          <span className="flex items-center gap-1">
                            <ShieldCheck className="h-3 w-3 text-amber-600 shrink-0" />
                            <span>Staff Note</span>
                          </span>
                          <span className="text-[9px] font-normal text-muted-foreground/80">
                            {note.created_at}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap leading-relaxed break-words font-medium">
                          {note.text}
                        </p>
                      </div>
                    ))}
                    <div className="text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenNote(order)}
                        className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
                        title="Add another staff note"
                      >
                        <Plus className="h-2.5 w-2.5" />
                        <span>Add Note</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => handleOpenNote(order)}
                      className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/50 hover:text-amber-600 hover:underline cursor-pointer transition-colors"
                      title="Add staff note"
                    >
                      <Plus className="h-2.5 w-2.5" />
                      <span>Staff Note</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        },
        enableSorting: false,
        enableHiding: false,
      },
    ],
    [expandedRows, toggleRowExpanded, copyToClipboard]
  );

  const renderOrderDetailsSubRow = (order: Order) => {
    const dueAmount = Math.max(0, order.grand_total - order.amount_paid);

    return (
      <div className="px-4 py-3.5 sm:px-6 bg-gradient-to-r from-amber-500/[0.03] via-background to-muted/20 border-t border-dashed border-border/70 space-y-3">
        {/* Header strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border/50 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200">
              <PackageCheck className="h-4 w-4 text-amber-600 shrink-0" />
              Order Items ({order.items?.length || 0})
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">Currency: {order.currency}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => handleOpenNote(order)}
            >
              <MessageSquare className="h-3.5 w-3.5 mr-1 text-amber-600" />
              Add Note
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => handleOpenView(order)}
            >
              <Eye className="h-3.5 w-3.5 mr-1" />
              Open Drawer
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700"
              onClick={() => handleBulkPrintInvoices([order])}
              title="Print 58mm thermal sticker label"
            >
              <Printer className="h-3.5 w-3.5 mr-1 text-amber-600" />
              58mm Sticker
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => handleOpenEdit(order)}
            >
              <Edit className="h-3.5 w-3.5 mr-1 text-blue-600" />
              Edit
            </Button>
          </div>
        </div>

        {/* Product Items Table */}
        {!order.items || order.items.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-background/60 p-6 text-center space-y-2">
            <PackageCheck className="h-8 w-8 text-muted-foreground/40 mx-auto" />
            <p className="text-xs font-medium text-muted-foreground">
              No products added to this order yet (Lead / Incomplete order).
            </p>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7"
              onClick={() => handleOpenEdit(order)}
            >
              <Edit className="h-3.5 w-3.5 mr-1" />
              Add Products Now
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border bg-background/80 overflow-hidden shadow-2xs">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12 text-[11px] font-semibold">#</TableHead>
                  <TableHead className="text-[11px] font-semibold">SKU</TableHead>
                  <TableHead className="text-[11px] font-semibold">Product & Variant</TableHead>
                  <TableHead className="text-right text-[11px] font-semibold">Unit Price</TableHead>
                  <TableHead className="text-center text-[11px] font-semibold">Quantity</TableHead>
                  <TableHead className="text-right text-[11px] font-semibold">Line Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((item, idx) => (
                  <TableRow key={item.id} className="text-xs hover:bg-muted/30">
                    <TableCell className="font-mono text-muted-foreground text-[11px] py-2">
                      {idx + 1}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-amber-700 dark:text-amber-400 font-medium py-2">
                      {item.sku}
                    </TableCell>
                    <TableCell className="py-2">
                      <p className="font-medium text-foreground">{item.product_name}</p>
                      {item.variant_name && (
                        <p className="text-[11px] text-muted-foreground">{item.variant_name}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-[11px] py-2">
                      ৳ {item.unit_price.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center font-mono font-semibold py-2">
                      <span className="inline-block px-2 py-0.5 rounded bg-muted/60 text-foreground text-xs">
                        {item.quantity}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-foreground py-2">
                      ৳ {item.line_total.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Summary Footer */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1 text-xs">
          <div className="p-2.5 rounded-lg bg-background/60 border space-y-0.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Delivery Address</span>
            <p className="font-medium text-foreground truncate">
              {order.address?.district}, {order.address?.division}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">{order.address?.address_line}</p>
          </div>

          <div className="p-2.5 rounded-lg bg-background/60 border space-y-0.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Order Breakdown</span>
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Subtotal:</span>
              <span className="font-mono">৳ {order.subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Shipping Fee:</span>
              <span className="font-mono">৳ {order.shipping_total.toLocaleString()}</span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-background/60 border space-y-0.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Discounts & Net</span>
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Discount Total:</span>
              <span className="font-mono text-emerald-600">- ৳ {order.discount_total.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-[11px] font-bold text-foreground pt-0.5 border-t">
              <span>Grand Total:</span>
              <span className="font-mono text-amber-700 dark:text-amber-400">
                ৳ {order.grand_total.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-background/60 border space-y-0.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Payment Settlement</span>
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Amount Paid:</span>
              <span className="font-mono text-emerald-600 font-semibold">৳ {order.amount_paid.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-[11px] font-semibold text-foreground">
              <span>Due Balance:</span>
              <span className={`font-mono ${dueAmount > 0 ? "text-rose-600 font-bold" : "text-muted-foreground"}`}>
                ৳ {dueAmount.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Toast Notification: Rendered via Portal directly in document.body at z-[99999] (always above all modals) */}
      {!toastContext.isAvailable && (
        <ToastNotificationPortal
          toast={localToast}
          onDismiss={() => setLocalToast(null)}
        />
      )}

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 w-full">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Order Management</h1>
            {isOrdersFetching && (
              <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full font-medium">
                <Loader2 className="h-3 w-3 animate-spin" />
                Syncing with DB
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-sm">
            Monitor, edit, fulfill, and record notes on wholesale & retail molasses orders with SSR and TanStack Query
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchOrders()}
            disabled={isOrdersFetching}
            className="cursor-pointer"
            title="Refetch orders from database"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isOrdersFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="cursor-pointer">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button
            id="btn-open-create-order-dialog"
            size="sm"
            onClick={handleOpenCreate}
            className="bg-amber-600 hover:bg-amber-700 text-white font-medium cursor-pointer shrink-0"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Order
          </Button>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-amber-200/60 dark:border-amber-900/30">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Total Orders</p>
              <PackageCheck className="h-4 w-4 text-amber-600" />
            </div>
            <p className="text-2xl font-bold mt-1">{counts.all.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Database orders total</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Pending Action</p>
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-2xl font-bold mt-1 text-amber-600">{counts.pending + counts.confirmed}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {counts.pending} pending · {counts.confirmed} confirmed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">In Transit / Shipped</p>
              <Truck className="h-4 w-4 text-purple-600" />
            </div>
            <p className="text-2xl font-bold mt-1 text-purple-600">{counts.shipped + counts.processing}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Dispatched to courier or depot</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                BDT
              </span>
            </div>
            <p className="text-2xl font-bold mt-1 text-emerald-600">
              ৳ {totalRevenue.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Excluding incomplete, cancelled & returned</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Filter Tabs & Search Bar */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="w-full min-w-0 max-w-full overflow-hidden">
        <Tabs value={selectedTab} onValueChange={handleTabChange} className="w-full min-w-0 max-w-full">
          <div className="space-y-3 mb-4 w-full min-w-0 max-w-full">
            {/* Horizontally Scrollable Status Tabs with Left/Right Overflow Fade Masks & Navigation Buttons */}
            <div className="relative w-full min-w-0 max-w-full group">
              {/* Left Overflow Gradient Mask & Scroll Button */}
              <div
                className={`pointer-events-none absolute left-0 top-0 bottom-0 w-10 sm:w-14 bg-gradient-to-r from-background via-background/80 to-transparent z-10 transition-opacity duration-300 rounded-l-xl ${
                  canScrollLeft ? "opacity-100" : "opacity-0"
                }`}
                aria-hidden="true"
              />
              {canScrollLeft && (
                <button
                  type="button"
                  onClick={() => scrollTabsBy(-220)}
                  aria-label="Scroll status tabs left"
                  className="absolute left-1.5 top-1/2 -translate-y-1/2 z-20 h-7 w-7 rounded-full bg-background/95 hover:bg-background shadow-xs border border-border/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all cursor-pointer backdrop-blur-xs"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}

              {/* Scrollable Container */}
              <div
                ref={tabsContainerRef}
                onWheel={handleTabsWheel}
                className="w-full min-w-0 max-w-full overflow-x-auto no-scrollbar scroll-smooth p-0.5"
              >
                <TabsList className="inline-flex w-max min-w-full items-center gap-1.5 p-1.5 bg-muted/70 rounded-xl border border-border/60 h-auto">
                  <TabsTrigger
                    value="all"
                    className="shrink-0 h-9 px-3.5 text-xs font-semibold rounded-lg inline-flex items-center justify-center whitespace-nowrap transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs data-[state=active]:border-border/60 cursor-pointer"
                  >
                    <span>All Orders</span>
                    <span className="ml-1.5 rounded-full bg-muted-foreground/15 px-1.5 py-0.5 text-[10px] font-bold text-foreground shrink-0">
                      {counts.all}
                    </span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="incomplete_order"
                    className="shrink-0 h-9 px-3.5 text-xs font-semibold rounded-lg inline-flex items-center justify-center whitespace-nowrap transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs data-[state=active]:border-border/60 cursor-pointer"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-500 mr-1.5 shrink-0" />
                    <span>Incomplete Order</span>
                    <span className="ml-1.5 rounded-full bg-slate-500/20 text-slate-800 dark:text-slate-300 px-1.5 py-0.5 text-[10px] font-bold shrink-0">
                      {counts.incomplete_order}
                    </span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="pending"
                    className="shrink-0 h-9 px-3.5 text-xs font-semibold rounded-lg inline-flex items-center justify-center whitespace-nowrap transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs data-[state=active]:border-border/60 cursor-pointer"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 mr-1.5 shrink-0" />
                    <span>Pending</span>
                    <span className="ml-1.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 text-[10px] font-bold shrink-0">
                      {counts.pending}
                    </span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="confirmed"
                    className="shrink-0 h-9 px-3.5 text-xs font-semibold rounded-lg inline-flex items-center justify-center whitespace-nowrap transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs data-[state=active]:border-border/60 cursor-pointer"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500 mr-1.5 shrink-0" />
                    <span>Confirmed</span>
                    <span className="ml-1.5 rounded-full bg-blue-500/20 text-blue-800 dark:text-blue-300 px-1.5 py-0.5 text-[10px] font-bold shrink-0">
                      {counts.confirmed}
                    </span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="processing"
                    className="shrink-0 h-9 px-3.5 text-xs font-semibold rounded-lg inline-flex items-center justify-center whitespace-nowrap transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs data-[state=active]:border-border/60 cursor-pointer"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 mr-1.5 shrink-0" />
                    <span>Processing</span>
                    <span className="ml-1.5 rounded-full bg-indigo-500/20 text-indigo-800 dark:text-indigo-300 px-1.5 py-0.5 text-[10px] font-bold shrink-0">
                      {counts.processing}
                    </span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="shipped"
                    className="shrink-0 h-9 px-3.5 text-xs font-semibold rounded-lg inline-flex items-center justify-center whitespace-nowrap transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs data-[state=active]:border-border/60 cursor-pointer"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-purple-500 mr-1.5 shrink-0" />
                    <span>Shipped</span>
                    <span className="ml-1.5 rounded-full bg-purple-500/20 text-purple-800 dark:text-purple-300 px-1.5 py-0.5 text-[10px] font-bold shrink-0">
                      {counts.shipped}
                    </span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="delivered"
                    className="shrink-0 h-9 px-3.5 text-xs font-semibold rounded-lg inline-flex items-center justify-center whitespace-nowrap transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs data-[state=active]:border-border/60 cursor-pointer"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5 shrink-0" />
                    <span>Delivered</span>
                    <span className="ml-1.5 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 text-[10px] font-bold shrink-0">
                      {counts.delivered}
                    </span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="partially_delivered"
                    className="shrink-0 h-9 px-3.5 text-xs font-semibold rounded-lg inline-flex items-center justify-center whitespace-nowrap transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs data-[state=active]:border-border/60 cursor-pointer"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-teal-500 mr-1.5 shrink-0" />
                    <span>Partially Delivered</span>
                    <span className="ml-1.5 rounded-full bg-teal-500/20 text-teal-800 dark:text-teal-300 px-1.5 py-0.5 text-[10px] font-bold shrink-0">
                      {counts.partially_delivered}
                    </span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="cancelled"
                    className="shrink-0 h-9 px-3.5 text-xs font-semibold rounded-lg inline-flex items-center justify-center whitespace-nowrap transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs data-[state=active]:border-border/60 cursor-pointer"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500 mr-1.5 shrink-0" />
                    <span>Cancelled</span>
                    <span className="ml-1.5 rounded-full bg-rose-500/20 text-rose-800 dark:text-rose-300 px-1.5 py-0.5 text-[10px] font-bold shrink-0">
                      {counts.cancelled}
                    </span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="returned"
                    className="shrink-0 h-9 px-3.5 text-xs font-semibold rounded-lg inline-flex items-center justify-center whitespace-nowrap transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs data-[state=active]:border-border/60 cursor-pointer"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-orange-500 mr-1.5 shrink-0" />
                    <span>Returned</span>
                    <span className="ml-1.5 rounded-full bg-orange-500/20 text-orange-800 dark:text-orange-300 px-1.5 py-0.5 text-[10px] font-bold shrink-0">
                      {counts.returned}
                    </span>
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Right Overflow Gradient Mask & Scroll Button */}
              <div
                className={`pointer-events-none absolute right-0 top-0 bottom-0 w-10 sm:w-14 bg-gradient-to-l from-background via-background/80 to-transparent z-10 transition-opacity duration-300 rounded-r-xl ${
                  canScrollRight ? "opacity-100" : "opacity-0"
                }`}
                aria-hidden="true"
              />
              {canScrollRight && (
                <button
                  type="button"
                  onClick={() => scrollTabsBy(220)}
                  aria-label="Scroll status tabs right"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 z-20 h-7 w-7 rounded-full bg-background/95 hover:bg-background shadow-xs border border-border/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all cursor-pointer backdrop-blur-xs"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* TanStack Orders Table with Pagination, Selection, Sorting & View Options */}
          <DataTable
            columns={orderColumns}
            data={orders}
            manualPagination={true}
            pageCount={pageCount}
            rowCount={totalCount}
            pagination={paginationState}
            onPaginationChange={handlePaginationChange}
            manualSorting={true}
            sorting={sorting}
            onSortingChange={handleSortingChange}
            enableGlobalFilter={false}
            enableRowSelection={true}
            enableSorting={true}
            enablePagination={true}
            pageSizeOptions={[5, 10, 20, 50, 100]}
            isLoading={isOrdersLoading && orders.length === 0}
            isFetching={isOrdersFetching}
            loadingMessage={
              searchQuery !== debouncedSearch || searchQuery
                ? "Searching orders..."
                : isOrdersFetching
                  ? "Updating orders..."
                  : "Loading orders..."
            }
            toolbarPrefix={
              <div className="flex flex-1 items-center gap-2 flex-wrap sm:flex-nowrap w-full">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by order ID, customer name, phone, address..."
                    className="pl-8 pr-14 h-9 text-xs w-full bg-background"
                  />
                  <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5">
                    {(isOrdersFetching || searchQuery !== debouncedSearch) && (
                      <Loader2 className="h-4 w-4 animate-spin text-amber-600 dark:text-amber-400" />
                    )}
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery("");
                          setDebouncedSearch("");
                          setPage(1);
                          updateUrl({ search: "", page: 1 });
                        }}
                        className="text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Clear search"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
                  {/* Channel filter */}
                  <select
                    value={channelFilter}
                    onChange={(e) => {
                      const val = e.target.value;
                      setChannelFilter(val);
                      setPage(1);
                      updateUrl({ channel: val, page: 1 });
                    }}
                    className="h-9 px-3 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                  >
                    <option value="all">All Channels</option>
                    <option value="web">Web Store</option>
                    <option value="phone">Phone Call</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="admin">Admin Manual</option>
                  </select>

                  {/* Payment filter */}
                  <select
                    value={paymentFilter}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPaymentFilter(val);
                      setPage(1);
                      updateUrl({ payment: val, page: 1 });
                    }}
                    className="h-9 px-3 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                  >
                    <option value="all">All Payments</option>
                    <option value="unpaid">Unpaid</option>
                    <option value="partially_paid">Partially Paid</option>
                    <option value="paid">Paid</option>
                    <option value="refunded">Refunded</option>
                  </select>

                  {(searchQuery || channelFilter !== "all" || paymentFilter !== "all" || selectedTab !== "all") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSearchQuery("");
                        setDebouncedSearch("");
                        setChannelFilter("all");
                        setPaymentFilter("all");
                        setSelectedTab("all");
                        setPage(1);
                        updateUrl({ search: "", channel: "all", payment: "all", status: "all", page: 1 });
                      }}
                      className="h-9 text-xs text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                      Reset
                    </Button>
                  )}

                  {/* Expand / Collapse All Details Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleExpandAll}
                    className="h-9 text-xs text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                    title={allExpanded ? "Collapse all item details" : "Expand all item details"}
                  >
                    <ChevronsUpDown className="h-3.5 w-3.5 mr-1 text-amber-600" />
                    {allExpanded ? "Collapse All" : "Expand All"}
                  </Button>
                </div>
              </div>
            }
            onRowClick={(order) => handleOpenView(order)}
            renderSubRow={renderOrderDetailsSubRow}
            isRowExpanded={(order) => !!expandedRows[order.id]}
            emptyMessage={
              isOrdersLoading || isOrdersFetching
                ? "Loading orders from server..."
                : "No orders match your filter criteria."
            }
            bulkActions={(selectedOrders, clearSelection) => (
              <div className="flex items-center gap-2 flex-wrap">
                {/* 1. Status Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={bulkStatusMutation.isPending}
                      className="h-7 text-xs gap-1 bg-background hover:bg-muted"
                    >
                      <Clock className="h-3.5 w-3.5 text-amber-600" />
                      Update Status
                      <ChevronDown className="h-3 w-3 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48 text-xs">
                    <DropdownMenuLabel>Set Status ({selectedOrders.length} orders):</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleOpenBulkStatus(selectedOrders, "pending", clearSelection)}
                      className="cursor-pointer"
                    >
                      <Clock className="h-3.5 w-3.5 mr-2 text-amber-500" /> Mark Pending
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleOpenBulkStatus(selectedOrders, "confirmed", clearSelection)}
                      className="cursor-pointer"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-2 text-blue-500" /> Mark Confirmed
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleOpenBulkStatus(selectedOrders, "processing", clearSelection)}
                      className="cursor-pointer"
                    >
                      <Package className="h-3.5 w-3.5 mr-2 text-indigo-500" /> Mark Processing
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleOpenBulkStatus(selectedOrders, "shipped", clearSelection)}
                      className="cursor-pointer"
                    >
                      <Truck className="h-3.5 w-3.5 mr-2 text-purple-500" /> Mark Shipped
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleOpenBulkStatus(selectedOrders, "delivered", clearSelection)}
                      className="cursor-pointer"
                    >
                      <PackageCheck className="h-3.5 w-3.5 mr-2 text-emerald-500" /> Mark Delivered
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleOpenBulkStatus(selectedOrders, "cancelled", clearSelection)}
                      className="cursor-pointer text-destructive focus:text-destructive"
                    >
                      <XCircle className="h-3.5 w-3.5 mr-2" /> Mark Cancelled
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* 2. Assign Courier Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={bulkCourierMutation.isPending}
                      className="h-7 text-xs gap-1 bg-background hover:bg-muted"
                    >
                      <Truck className="h-3.5 w-3.5 text-blue-600" />
                      Assign Courier
                      <ChevronDown className="h-3 w-3 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-52 text-xs">
                    <DropdownMenuLabel>Assign Courier Partner:</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {[
                      "Steadfast Courier",
                      "Pathao Courier",
                      "RedX Delivery",
                      "Paperfly",
                      "Sundarban Courier",
                      "SA Paribahan",
                    ].map((courier) => (
                      <DropdownMenuItem
                        key={courier}
                        onClick={() => handleOpenBulkCourier(selectedOrders, courier, clearSelection)}
                        className="cursor-pointer"
                      >
                        <Truck className="h-3.5 w-3.5 mr-2 text-slate-500" />
                        {courier}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* 3. Print 58mm Thermal Stickers */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkPrintInvoices(selectedOrders)}
                  className="h-7 text-xs bg-background hover:bg-muted text-foreground hover:text-amber-600 cursor-pointer"
                  title="Open 58mm thermal sticker roll printable invoices in a new tab"
                >
                  <Printer className="h-3.5 w-3.5 mr-1 text-amber-600" />
                  Print ({selectedOrders.length})
                </Button>

                {/* 4. Export Selected CSV */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs bg-background hover:bg-muted"
                  onClick={() => {
                    const headers = [
                      "Order ID",
                      "Date",
                      "Customer",
                      "Phone",
                      "Status",
                      "Payment",
                      "Method",
                      "Courier",
                      "Fulfillment",
                      "Grand Total (BDT)",
                    ];
                    const rows = selectedOrders.map((o) => [
                      o.id,
                      formatDate(o.date),
                      `"${o.customer.replace(/"/g, '""')}"`,
                      `"${o.phone}"`,
                      o.status,
                      o.payment,
                      o.method,
                      o.courier_name || "",
                      o.fulfillment,
                      o.grand_total,
                    ]);
                    const csvContent =
                      "data:text/csv;charset=utf-8," +
                      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute(
                      "download",
                      `gur_orders_selected_${new Date().toISOString().slice(0, 10)}.csv`
                    );
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    showToast(`Exported ${selectedOrders.length} order(s) to CSV.`, "info");
                  }}
                >
                  <Download className="h-3.5 w-3.5 mr-1 text-amber-600" />
                  Export CSV
                </Button>

                {/* 5. Delete Selected */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs bg-background hover:bg-rose-50 text-rose-600 border-rose-200 dark:border-rose-900 cursor-pointer"
                  disabled={bulkDeleteMutation.isPending}
                  onClick={() => handleOpenBulkDelete(selectedOrders, clearSelection)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Delete ({selectedOrders.length})
                </Button>
              </div>
            )}
          />
        </Tabs>
      </motion.div>

      {/* ========================================================================= */}
      {/* 1. SLIDE-OVER SHEET: VIEW ORDER DETAILS & TIMELINE */}
      {/* ========================================================================= */}
      <OrderDetailsSheet
        open={isViewOpen}
        onOpenChange={setIsViewOpen}
        order={selectedOrder}
        ordersList={orders}
        onSelectOrder={(newOrder) => setSelectedOrder(newOrder)}
        onEditOrder={handleOpenEdit}
        onUpdateStatus={handleOpenStatus}
        onQuickAdvanceStatus={handleQuickAdvanceStatus}
        onRecordPayment={handleOpenPayment}
        onPrintInvoice={handleBulkPrintInvoices}
        onDeleteOrder={handleOpenDelete}
        catalogProducts={catalogProducts}
        onAddNote={async (orderId, note, currentOrder) => {
          addNoteMutation.mutate({
            orderId,
            note,
            currentOrder,
          });
        }}
        onEditNote={handleOpenEditNote}
        onDeleteNote={handleOpenDeleteNote}
        onEditCustomerNote={handleOpenEditCustomerNote}
        onClearCustomerNote={handleClearCustomerNote}
        isStatusPending={updateStatusMutation.isPending}
        isNotePending={addNoteMutation.isPending}
      />

      {/* ========================================================================= */}
      {/* UNIFIED ORDER FORM DIALOG (CREATING & EDITING) */}
      {/* ========================================================================= */}
      <OrderFormDialog
        key={orderModalState.open ? `${orderModalState.mode}-${orderModalState.order?.id || "create"}` : "closed"}
        open={orderModalState.open}
        onOpenChange={(open) => setOrderModalState((prev) => ({ ...prev, open }))}
        mode={orderModalState.mode}
        order={orderModalState.order}
        defaultStatus={selectedTab !== "all" ? (selectedTab as Order["status"]) : "confirmed"}
        onSave={handleSaveOrder}
        geoDivisions={geoDivisions}
        geoDistricts={geoDistricts}
        setGeoDistricts={setGeoDistricts}
        availableCatalogProducts={catalogProducts}
        ordersCount={orders.length}
        showToast={showToast}
      />

      {/* ========================================================================= */}
      {/* 3. UPDATE ORDER STATUS DIALOG */}
      {/* ========================================================================= */}
      <Dialog
        open={isStatusOpen}
        onOpenChange={(open) => {
          setIsStatusOpen(open);
          if (!open) setStatusError(null);
        }}
      >
        <DialogContent className="w-[95vw] sm:max-w-2xl md:max-w-3xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 flex flex-col">
          <DialogHeader className="shrink-0 border-b pb-3">
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <RefreshCw className="h-5 w-5 text-amber-600" />
              Update Order Status
            </DialogTitle>
            <DialogDescription>
              Change workflow progression for order <span className="font-mono font-bold text-foreground">{effectiveStatusOrder?.id}</span>.
            </DialogDescription>
          </DialogHeader>

          {/* Pre-validation Warning Card for Single Status Update */}
          {!singleStatusEligibility.valid && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-2">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-amber-900 dark:text-amber-200">
                    Status Transition Notice
                  </p>
                  <p className="text-amber-800 dark:text-amber-300 mt-0.5 text-[11px] leading-relaxed">
                    {singleStatusEligibility.reason}
                  </p>
                </div>
              </div>
              {(singleStatusEligibility.code === "CUSTOMER_NAME_REQUIRED" ||
                singleStatusEligibility.code === "CUSTOMER_PHONE_REQUIRED" ||
                singleStatusEligibility.code === "CUSTOMER_ADDRESS_REQUIRED" ||
                singleStatusEligibility.code === "ORDER_ITEMS_REQUIRED") && effectiveStatusOrder && (
                <div className="flex items-center justify-end pt-1 border-t border-amber-500/20">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsStatusOpen(false);
                      handleOpenEdit(effectiveStatusOrder);
                    }}
                    className="h-7 text-xs bg-background border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-950 cursor-pointer"
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    {singleStatusEligibility.code === "ORDER_ITEMS_REQUIRED"
                      ? "Add Products / Edit Order"
                      : "Edit Order Details"}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Inline Database / RLS / Trigger Error Banner */}
          {statusError && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="p-3.5 rounded-xl border border-rose-300 bg-rose-50/95 dark:bg-rose-950/50 dark:border-rose-800 text-rose-950 dark:text-rose-100 shadow-sm space-y-2 text-xs"
            >
              <div className="flex items-start gap-2.5">
                <div className="p-1 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-rose-900 dark:text-rose-200 text-xs sm:text-sm">
                      {statusError.title}
                    </p>
                    {statusError.code && (
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-rose-200/80 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300 font-semibold">
                        Code: {statusError.code}
                      </span>
                    )}
                    {statusError.isRlsError && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-200/90 dark:bg-amber-900/70 text-amber-900 dark:text-amber-200 font-bold uppercase tracking-wider">
                        RLS Policy Block
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-rose-800 dark:text-rose-200 mt-1 leading-relaxed">
                    {statusError.message}
                  </p>
                  {statusError.resolution && (
                    <div className="mt-2 p-2 rounded-lg bg-rose-100/80 dark:bg-rose-900/40 border border-rose-200 dark:border-rose-800 text-[11px] text-rose-900 dark:text-rose-200">
                      <span className="font-bold">Required Action: </span>
                      {statusError.resolution}
                    </div>
                  )}
                  {statusError.hint && (
                    <p className="text-[10px] text-rose-700/80 dark:text-rose-300/80 mt-1 italic">
                      Tip: {statusError.hint}
                    </p>
                  )}
                </div>
              </div>

              {/* Action buttons inside error banner */}
              <div className="flex items-center justify-end gap-2 pt-1 border-t border-rose-200/70 dark:border-rose-800/70">
                {(statusError.code === "CUSTOMER_NAME_REQUIRED" ||
                  statusError.code === "CUSTOMER_PHONE_REQUIRED" ||
                  statusError.code === "CUSTOMER_ADDRESS_REQUIRED" ||
                  statusError.code === "ORDER_ITEMS_REQUIRED") && effectiveStatusOrder ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsStatusOpen(false);
                      handleOpenEdit(effectiveStatusOrder);
                    }}
                    className="h-7 text-xs bg-white dark:bg-zinc-900 border-rose-300 text-rose-900 dark:text-rose-200 hover:bg-rose-100 dark:hover:bg-rose-950 cursor-pointer"
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    {statusError.code === "ORDER_ITEMS_REQUIRED"
                      ? "Add Products / Edit Order"
                      : "Edit Order Details"}
                  </Button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setStatusError(null)}
                  className="text-[11px] text-rose-700 dark:text-rose-300 hover:underline px-2 py-1 cursor-pointer font-medium"
                >
                  Dismiss Error
                </button>
              </div>
            </motion.div>
          )}

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Select New Status</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { value: "incomplete_order", label: "Incomplete Order", desc: "Draft or missing info" },
                  { value: "pending", label: "Pending", desc: "Awaiting confirmation" },
                  { value: "confirmed", label: "Confirmed", desc: "Order verified by desk" },
                  { value: "processing", label: "Processing", desc: "Being packed at warehouse" },
                  { value: "shipped", label: "Shipped", desc: "Dispatched to courier" },
                  { value: "delivered", label: "Delivered", desc: "Received by buyer" },
                  { value: "partially_delivered", label: "Partially Delivered", desc: "Partial items delivered" },
                  { value: "cancelled", label: "Cancelled", desc: "Order terminated" },
                  { value: "returned", label: "Returned", desc: "Returned to warehouse" },
                ].map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => {
                      setNewStatus(s.value as Order["status"]);
                      setStatusError(null);
                    }}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                      newStatus === s.value
                        ? "border-amber-600 bg-amber-50/50 dark:bg-amber-950/40 ring-2 ring-amber-500/20"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <p className="font-semibold text-foreground flex items-center justify-between">
                      {s.label}
                      {newStatus === s.value && <Check className="h-3.5 w-3.5 text-amber-600" />}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{s.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* If Cancelled or Returned, require reason */}
            {(newStatus === "cancelled" || newStatus === "returned") && (
              <div className="space-y-1.5 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
                <Label htmlFor="cancel_reason" className="text-rose-900 dark:text-rose-200">
                  Reason for {newStatus === "returned" ? "Return" : "Cancellation"}
                </Label>
                <Textarea
                  id="cancel_reason"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder={
                    newStatus === "returned"
                      ? "e.g. Defective seal, damaged in transit, customer refused delivery..."
                      : "e.g. Customer changed mind, stock out, duplicate order..."
                  }
                  rows={2}
                  className="bg-background text-xs"
                />
              </div>
            )}

            {/* If Processing, Shipped, Delivered, or Partially Delivered, require Courier assignment */}
            {(newStatus === "processing" ||
              newStatus === "shipped" ||
              newStatus === "delivered" ||
              newStatus === "partially_delivered") && (
              <div className="space-y-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <div className="flex items-center justify-between">
                  <Label htmlFor="status_courier_name" className="text-amber-900 dark:text-amber-200 flex items-center gap-1.5 font-medium text-xs">
                    <Truck className="h-4 w-4 text-amber-600" />
                    Courier Service Partner <span className="text-destructive font-bold">*</span>
                  </Label>
                  <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold uppercase">
                    Required for {newStatus.replace("_", " ")}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <select
                    id="status_courier_select"
                    value={
                      (BANGLADESH_COURIERS as readonly string[]).includes(selectedCourier)
                        ? selectedCourier
                        : selectedCourier
                        ? "other"
                        : ""
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val !== "other") {
                        setSelectedCourier(val);
                      }
                    }}
                    className="w-full h-8 rounded-md border border-input bg-background px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                  >
                    <option value="">-- Choose Courier Service --</option>
                    {BANGLADESH_COURIERS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    <option value="other">Other / Custom Courier</option>
                  </select>

                  <Input
                    id="status_courier_name"
                    value={selectedCourier}
                    onChange={(e) => setSelectedCourier(e.target.value)}
                    placeholder="Courier name (e.g. Steadfast, Pathao, RedX)..."
                    className="h-8 text-xs bg-background"
                  />
                </div>

                <div className="flex flex-wrap gap-1 pt-0.5">
                  {BANGLADESH_COURIERS.slice(0, 5).map((cName) => (
                    <button
                      key={cName}
                      type="button"
                      onClick={() => setSelectedCourier(cName)}
                      className={`text-[10px] px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                        selectedCourier === cName
                          ? "bg-amber-600 text-white border-amber-600 font-semibold"
                          : "bg-background text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {cName}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Notification toggle */}
            <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={notifyCustomer}
                onChange={(e) => setNotifyCustomer(e.target.checked)}
                className="rounded border-input text-amber-600 focus:ring-amber-500 h-4 w-4"
              />
              <span>Send automated SMS / WhatsApp notification to {effectiveStatusOrder?.phone || "customer"}</span>
            </label>
          </div>

          <DialogFooter className="shrink-0 pt-3 border-t bg-popover/95 backdrop-blur-xs sticky bottom-0 -mb-2 mt-4">
            <Button variant="outline" onClick={() => setIsStatusOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveStatus}
              disabled={updateStatusMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
            >
              {updateStatusMutation.isPending ? "Saving..." : "Confirm Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 3B. RECORD / UPDATE PAYMENT DIALOG */}
      {/* ========================================================================= */}
      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent className="w-[95vw] sm:max-w-lg md:max-w-xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-amber-600" />
              Record Order Payment
            </DialogTitle>
            <DialogDescription>
              Update payment settlement or log partial payments for order{" "}
              <span className="font-mono font-bold text-foreground">{paymentOrder?.id}</span>.
            </DialogDescription>
          </DialogHeader>

          {paymentOrder && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                recordPaymentForm.handleSubmit();
              }}
              className="space-y-4 py-2"
            >
              {/* Order Amount Overview Card */}
              <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-muted/40 border text-center">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase">Total</span>
                  <p className="font-mono font-bold text-sm text-foreground">
                    ৳ {paymentOrder.grand_total.toLocaleString()}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase">Paid</span>
                  <p className="font-mono font-bold text-sm text-emerald-600">
                    ৳ {paymentOrder.amount_paid.toLocaleString()}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase">Due</span>
                  <p className="font-mono font-bold text-sm text-rose-600">
                    ৳ {Math.max(0, paymentOrder.grand_total - paymentOrder.amount_paid).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Payment Status & Method */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <recordPaymentForm.Field name="payment">
                  {(field) => (
                    <FormFieldItem>
                      <FormFieldLabel htmlFor="pay_modal_status">Payment Status</FormFieldLabel>
                      <select
                        id="pay_modal_status"
                        value={field.state.value}
                        onChange={(e) => {
                          const newStatus = e.target.value as Order["payment"];
                          field.handleChange(newStatus);
                          if (newStatus === "paid") {
                            recordPaymentForm.setFieldValue("amount_paid", paymentOrder.grand_total);
                          } else if (newStatus === "unpaid") {
                            recordPaymentForm.setFieldValue("amount_paid", 0);
                          } else if (newStatus === "partially_paid") {
                            const cur = Number(recordPaymentForm.state.values.amount_paid) || 0;
                            if (cur <= 0 || cur >= paymentOrder.grand_total) {
                              const half = Math.round(paymentOrder.grand_total / 2);
                              recordPaymentForm.setFieldValue("amount_paid", half > 0 ? half : 500);
                            }
                          }
                        }}
                        className="w-full h-9 rounded-lg border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                      >
                        <option value="unpaid">Unpaid</option>
                        <option value="partially_paid">Partially Paid</option>
                        <option value="paid">Paid in Full</option>
                        <option value="refunded">Refunded</option>
                      </select>
                    </FormFieldItem>
                  )}
                </recordPaymentForm.Field>

                <recordPaymentForm.Field name="method">
                  {(field) => (
                    <FormFieldItem>
                      <FormFieldLabel htmlFor="pay_modal_method">Payment Method</FormFieldLabel>
                      <select
                        id="pay_modal_method"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value as Order["method"])}
                        className="w-full h-9 rounded-lg border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                      >
                        <option value="bkash">bKash</option>
                        <option value="nagad">Nagad</option>
                        <option value="rocket">Rocket</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="card">Credit / Debit Card</option>
                        <option value="cash">Cash</option>
                        <option value="cod">Cash on Delivery (COD)</option>
                        <option value="credit_terms">Credit Terms</option>
                      </select>
                    </FormFieldItem>
                  )}
                </recordPaymentForm.Field>
              </div>

              {/* Amount Paid Field */}
              <recordPaymentForm.Field
                name="amount_paid"
                validators={{
                  onChange: validateWithZod(orderAmountPaidSchema),
                  onBlur: validateWithZod(orderAmountPaidSchema),
                }}
              >
                {(field) => {
                  const paidVal = Number(field.state.value) || 0;
                  const remainingDue = Math.max(0, paymentOrder.grand_total - paidVal);

                  return (
                    <FormFieldItem>
                      <div className="flex items-center justify-between">
                        <FormFieldLabel htmlFor="pay_modal_amount">Amount Paid ({currency} {currencySymbol})</FormFieldLabel>
                        <span className="text-[11px] font-mono text-muted-foreground">
                          Due: <span className="text-rose-600 font-bold">{currencySymbol} {remainingDue.toLocaleString()}</span>
                        </span>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-sm font-bold text-muted-foreground font-mono">
                          {currencySymbol}
                        </span>
                        <Input
                          id="pay_modal_amount"
                          type="number"
                          min="0"
                          max={paymentOrder.grand_total}
                          value={field.state.value === 0 ? "" : field.state.value}
                          onChange={(e) => {
                            const val = e.target.value === "" ? 0 : Number(e.target.value);
                            field.handleChange(val);
                            if (val >= paymentOrder.grand_total) {
                              recordPaymentForm.setFieldValue("payment", "paid");
                            } else if (val > 0) {
                              recordPaymentForm.setFieldValue("payment", "partially_paid");
                            } else {
                              recordPaymentForm.setFieldValue("payment", "unpaid");
                            }
                          }}
                          onBlur={field.handleBlur}
                          className="pl-7 font-mono font-bold text-sm h-9 bg-background"
                        />
                      </div>
                      <FormFieldError errors={field.state.meta.errors} />

                      {/* Quick Presets */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mr-1">
                          Quick Presets:
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            field.handleChange(500);
                            recordPaymentForm.setFieldValue("payment", "partially_paid");
                          }}
                          className="px-2 py-0.5 rounded border text-[11px] font-mono bg-background hover:bg-muted font-medium transition-colors cursor-pointer"
                        >
                          ৳ 500
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            field.handleChange(1000);
                            recordPaymentForm.setFieldValue("payment", "partially_paid");
                          }}
                          className="px-2 py-0.5 rounded border text-[11px] font-mono bg-background hover:bg-muted font-medium transition-colors cursor-pointer"
                        >
                          ৳ 1,000
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const half = Math.round(paymentOrder.grand_total * 0.5);
                            field.handleChange(half);
                            recordPaymentForm.setFieldValue("payment", "partially_paid");
                          }}
                          className="px-2 py-0.5 rounded border text-[11px] font-mono bg-background hover:bg-muted font-medium transition-colors cursor-pointer"
                        >
                          50%
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            field.handleChange(paymentOrder.grand_total);
                            recordPaymentForm.setFieldValue("payment", "paid");
                          }}
                          className="px-2 py-0.5 rounded border text-[11px] font-mono bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold hover:bg-emerald-500/20 transition-colors cursor-pointer"
                        >
                          Full (৳ {paymentOrder.grand_total.toLocaleString()})
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            field.handleChange(0);
                            recordPaymentForm.setFieldValue("payment", "unpaid");
                          }}
                          className="px-2 py-0.5 rounded border text-[11px] font-mono text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                    </FormFieldItem>
                  );
                }}
              </recordPaymentForm.Field>

              {/* Transaction Ref / Code */}
              <recordPaymentForm.Field name="transaction_ref">
                {(field) => (
                  <FormFieldItem>
                    <FormFieldLabel htmlFor="pay_modal_ref">Transaction ID / Reference (Optional)</FormFieldLabel>
                    <Input
                      id="pay_modal_ref"
                      placeholder="e.g. bKash TrxID 9K284JFK or Bank Slip #..."
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      className="font-mono text-xs h-9"
                    />
                  </FormFieldItem>
                )}
              </recordPaymentForm.Field>

              {/* Memo Note */}
              <recordPaymentForm.Field name="note">
                {(field) => (
                  <FormFieldItem>
                    <FormFieldLabel htmlFor="pay_modal_note">Payment Note (Internal)</FormFieldLabel>
                    <Textarea
                      id="pay_modal_note"
                      placeholder="Add memo e.g. Customer paid ৳500 advance via bKash personal..."
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      rows={2}
                      className="text-xs"
                    />
                  </FormFieldItem>
                )}
              </recordPaymentForm.Field>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setIsPaymentOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={recordPaymentMutation.isPending}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-medium"
                >
                  {recordPaymentMutation.isPending ? "Recording..." : "Save Payment"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 4. ADD ORDER NOTE DIALOG */}
      {/* ========================================================================= */}
      <Dialog open={isNoteOpen} onOpenChange={setIsNoteOpen}>
        <DialogContent className="w-[95vw] sm:max-w-lg md:max-w-xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-amber-600" />
              Add Order Note
            </DialogTitle>
            <DialogDescription>
              Add staff status updates, customer note, delivery instructions, or packaging notes for order{" "}
              <span className="font-mono font-bold text-foreground">{noteOrder?.id}</span>.
            </DialogDescription>
          </DialogHeader>

          {noteOrder && (
            <div className="space-y-2 py-1 text-xs">
              {/* Show customer note if present */}
              {noteOrder.customer_note ? (
                <div className="p-2.5 rounded-lg bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 font-bold text-blue-900 dark:text-blue-300">
                      <MessageSquare className="h-3 w-3 text-blue-600" />
                      Customer Note (Stored in Order Table)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenEditCustomerNote(noteOrder)}
                      className="text-[10px] text-blue-700 dark:text-blue-300 hover:underline cursor-pointer"
                    >
                      Edit
                    </button>
                  </div>
                  <p className="text-blue-950 dark:text-blue-100 italic mt-0.5">&quot;{noteOrder.customer_note}&quot;</p>
                </div>
              ) : null}

              {/* Show delivery notes summary if present */}
              {((noteOrder.notes || []).filter((n) => n.type === "delivery").length > 0) && (
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <span className="flex items-center gap-1 font-bold text-emerald-900 dark:text-emerald-300">
                    <Truck className="h-3 w-3 text-emerald-600" />
                    Delivery Notes ({(noteOrder.notes || []).filter((n) => n.type === "delivery").length})
                  </span>
                  <div className="space-y-1 mt-1 max-h-16 overflow-y-auto pr-1">
                    {(noteOrder.notes || []).filter((n) => n.type === "delivery").map((n) => (
                      <p key={n.id} className="text-[11px] text-emerald-950 dark:text-emerald-100 line-clamp-1">
                        • {n.text}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Show packaging notes summary if present */}
              {((noteOrder.notes || []).filter((n) => n.type === "packaging").length > 0) && (
                <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                  <span className="flex items-center gap-1 font-bold text-purple-900 dark:text-purple-300">
                    <Package className="h-3 w-3 text-purple-600" />
                    Packaging Notes ({(noteOrder.notes || []).filter((n) => n.type === "packaging").length})
                  </span>
                  <div className="space-y-1 mt-1 max-h-16 overflow-y-auto pr-1">
                    {(noteOrder.notes || []).filter((n) => n.type === "packaging").map((n) => (
                      <p key={n.id} className="text-[11px] text-purple-950 dark:text-purple-100 line-clamp-1">
                        • {n.text}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Show staff notes summary if present */}
              {((noteOrder.notes || []).filter((n) => n.type === "internal").length > 0) && (
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <span className="flex items-center gap-1 font-bold text-amber-900 dark:text-amber-300">
                    <ShieldCheck className="h-3 w-3 text-amber-600" />
                    Internal Staff Notes ({(noteOrder.notes || []).filter((n) => n.type === "internal").length})
                  </span>
                  <div className="space-y-1 mt-1 max-h-16 overflow-y-auto pr-1">
                    {(noteOrder.notes || []).filter((n) => n.type === "internal").map((n) => (
                      <p key={n.id} className="text-[11px] text-amber-950 dark:text-amber-100 line-clamp-1">
                        • {n.text} <span className="text-[10px] text-muted-foreground">({n.created_at})</span>
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              addNoteForm.handleSubmit();
            }}
            className="space-y-4 py-1"
          >
            <addNoteForm.Field name="type">
              {(field) => (
                <FormFieldItem>
                  <FormFieldLabel htmlFor="modal_note_type">Select Note Type</FormFieldLabel>
                  <div className="grid grid-cols-2 gap-2">
                    {/* 1. Internal Staff Note */}
                    <button
                      type="button"
                      onClick={() => field.handleChange("internal")}
                      className={`flex items-start gap-2 p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                        field.state.value === "internal"
                          ? "border-amber-600 bg-amber-500/10 text-amber-950 dark:text-amber-200 font-semibold ring-1 ring-amber-600"
                          : "border-input hover:bg-muted/50 text-muted-foreground"
                      }`}
                    >
                      <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold leading-none">Internal Staff Note</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Order update & status (private)</p>
                      </div>
                    </button>

                    {/* 2. Customer Note */}
                    <button
                      type="button"
                      onClick={() => field.handleChange("customer")}
                      className={`flex items-start gap-2 p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                        field.state.value === "customer"
                          ? "border-blue-600 bg-blue-500/10 text-blue-950 dark:text-blue-200 font-semibold ring-1 ring-blue-600"
                          : "border-input hover:bg-muted/50 text-muted-foreground"
                      }`}
                    >
                      <MessageSquare className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold leading-none">Customer Note</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">For seller (order column)</p>
                      </div>
                    </button>

                    {/* 3. Delivery Note */}
                    <button
                      type="button"
                      onClick={() => field.handleChange("delivery")}
                      className={`flex items-start gap-2 p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                        field.state.value === "delivery"
                          ? "border-emerald-600 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200 font-semibold ring-1 ring-emerald-600"
                          : "border-input hover:bg-muted/50 text-muted-foreground"
                      }`}
                    >
                      <Truck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold leading-none">Delivery Note</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">For delivery man / rider</p>
                      </div>
                    </button>

                    {/* 4. Packaging Note */}
                    <button
                      type="button"
                      onClick={() => field.handleChange("packaging")}
                      className={`flex items-start gap-2 p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                        field.state.value === "packaging"
                          ? "border-purple-600 bg-purple-500/10 text-purple-950 dark:text-purple-200 font-semibold ring-1 ring-purple-600"
                          : "border-input hover:bg-muted/50 text-muted-foreground"
                      }`}
                    >
                      <Package className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold leading-none">Packaging Note</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">For checking while packaging</p>
                      </div>
                    </button>
                  </div>
                </FormFieldItem>
              )}
            </addNoteForm.Field>

            <addNoteForm.Field
              name="text"
              validators={{
                onChange: validateWithZod(orderNoteTextSchema),
              }}
            >
              {(field) => (
                <FormFieldItem>
                  <addNoteForm.Subscribe selector={(state) => state.values.type}>
                    {(noteType) => (
                      <>
                        <FormFieldLabel htmlFor="modal_note_text">
                          {noteType === "internal"
                            ? "Internal Staff Note Details"
                            : noteType === "customer"
                            ? "Customer Note Details (For Seller)"
                            : noteType === "delivery"
                            ? "Delivery Instructions (For Delivery Man)"
                            : "Packaging Checklist & Instructions"}
                        </FormFieldLabel>
                        <Textarea
                          id="modal_note_text"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                          placeholder={
                            noteType === "internal"
                              ? "Enter order status update, customer verification remarks, or internal follow-up..."
                              : noteType === "customer"
                              ? "Enter customer note or special request for seller..."
                              : noteType === "delivery"
                              ? "Enter special delivery instructions (e.g. Call before delivery, ring doorbell twice)..."
                              : "Enter packaging instructions (e.g. Check jar seals, bubble wrap bottle, add gift ribbon)..."
                          }
                          rows={4}
                          className="text-xs"
                        />
                      </>
                    )}
                  </addNoteForm.Subscribe>
                  <FormFieldError errors={field.state.meta.errors} />
                  <FormFieldDescription>
                    Max 1000 characters. Customer notes update the order customer note column; rest notes are saved to the notes table.
                  </FormFieldDescription>
                </FormFieldItem>
              )}
            </addNoteForm.Field>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsNoteOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addNoteMutation.isPending}
                className="bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
              >
                {addNoteMutation.isPending ? "Saving..." : "Save Note"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 4B. EDIT ORDER NOTE DIALOG */}
      {/* ========================================================================= */}
      <Dialog open={isEditNoteOpen} onOpenChange={setIsEditNoteOpen}>
        <DialogContent className="w-[95vw] sm:max-w-lg md:max-w-xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-amber-600" />
              Edit Order Note
            </DialogTitle>
            <DialogDescription>
              Modify note for order <span className="font-mono font-bold text-foreground">{editingNote?.orderId}</span>.
            </DialogDescription>
          </DialogHeader>

          {editingNote && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                editNoteForm.handleSubmit();
              }}
              className="space-y-4 py-1"
            >
              <editNoteForm.Field name="type">
                {(field) => (
                  <FormFieldItem>
                    <FormFieldLabel htmlFor="edit_modal_note_type">Note Category</FormFieldLabel>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {/* 1. Internal Staff Note */}
                      <button
                        type="button"
                        onClick={() => field.handleChange("internal")}
                        className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-center cursor-pointer transition-all ${
                          field.state.value === "internal"
                            ? "border-amber-600 bg-amber-500/10 text-amber-950 dark:text-amber-200 font-semibold ring-1 ring-amber-600"
                            : "border-input hover:bg-muted/50 text-muted-foreground"
                        }`}
                      >
                        <ShieldCheck className="h-4 w-4 text-amber-600" />
                        <span className="text-xs font-semibold">Staff Note</span>
                      </button>

                      {/* 2. Customer Note */}
                      <button
                        type="button"
                        onClick={() => field.handleChange("customer")}
                        className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-center cursor-pointer transition-all ${
                          field.state.value === "customer"
                            ? "border-blue-600 bg-blue-500/10 text-blue-950 dark:text-blue-200 font-semibold ring-1 ring-blue-600"
                            : "border-input hover:bg-muted/50 text-muted-foreground"
                        }`}
                      >
                        <MessageSquare className="h-4 w-4 text-blue-600" />
                        <span className="text-xs font-semibold">Customer</span>
                      </button>

                      {/* 3. Delivery Note */}
                      <button
                        type="button"
                        onClick={() => field.handleChange("delivery")}
                        className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-center cursor-pointer transition-all ${
                          field.state.value === "delivery"
                            ? "border-emerald-600 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200 font-semibold ring-1 ring-emerald-600"
                            : "border-input hover:bg-muted/50 text-muted-foreground"
                        }`}
                      >
                        <Truck className="h-4 w-4 text-emerald-600" />
                        <span className="text-xs font-semibold">Delivery</span>
                      </button>

                      {/* 4. Packaging Note */}
                      <button
                        type="button"
                        onClick={() => field.handleChange("packaging")}
                        className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-center cursor-pointer transition-all ${
                          field.state.value === "packaging"
                            ? "border-purple-600 bg-purple-500/10 text-purple-950 dark:text-purple-200 font-semibold ring-1 ring-purple-600"
                            : "border-input hover:bg-muted/50 text-muted-foreground"
                        }`}
                      >
                        <Package className="h-4 w-4 text-purple-600" />
                        <span className="text-xs font-semibold">Packaging</span>
                      </button>
                    </div>
                    {field.state.value === "customer" && (
                      <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-1 flex items-center gap-1">
                        <MessageSquare className="h-3 w-3 inline shrink-0" />
                        Saved in order customer note column (for seller, written while ordering).
                      </p>
                    )}
                  </FormFieldItem>
                )}
              </editNoteForm.Field>

              <editNoteForm.Field
                name="text"
                validators={{
                  onChange: validateWithZod(orderNoteTextSchema),
                }}
              >
                {(field) => (
                  <FormFieldItem>
                    <FormFieldLabel htmlFor="edit_modal_note_text">Note Content</FormFieldLabel>
                    <Textarea
                      id="edit_modal_note_text"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      rows={4}
                      className="text-xs"
                      placeholder="Enter updated note text..."
                    />
                    <FormFieldError errors={field.state.meta.errors} />
                  </FormFieldItem>
                )}
              </editNoteForm.Field>

              <DialogFooter className="flex items-center justify-between pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 text-xs flex items-center gap-1 px-2.5 cursor-pointer"
                  onClick={() => {
                    const resolvedOrder =
                      selectedOrder?.id === editingNote.orderId
                        ? selectedOrder
                        : noteOrder?.id === editingNote.orderId
                        ? noteOrder
                        : orders.find((o) => o.id === editingNote.orderId);
                    handleOpenDeleteNote(
                      editingNote.id,
                      editingNote.orderId,
                      editingNote.text,
                      editingNote.type,
                      resolvedOrder
                    );
                  }}
                  disabled={deleteNoteMutation.isPending || updateNoteMutation.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Note
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsEditNoteOpen(false);
                      setEditingNote(null);
                    }}
                    disabled={updateNoteMutation.isPending || deleteNoteMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateNoteMutation.isPending || deleteNoteMutation.isPending}
                    className="bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
                  >
                    {updateNoteMutation.isPending ? "Updating..." : "Save Changes"}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 4C. DELETE ORDER NOTE CONFIRMATION DIALOG */}
      {/* ========================================================================= */}
      <Dialog
        open={!!deletingNoteTarget}
        onOpenChange={(open) => {
          if (!open) setDeletingNoteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete {deletingNoteTarget?.type === "customer" ? "Customer Note" : "Order Note"}
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete this note from order{" "}
              <span className="font-mono font-bold text-foreground">
                {deletingNoteTarget?.orderId}
              </span>
              ? This action will sync to the database.
            </DialogDescription>
          </DialogHeader>

          {deletingNoteTarget && (
            <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-xs space-y-2">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                {deletingNoteTarget.type === "customer" ? (
                  <Badge className="text-[10px] py-0 px-1.5 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-300">
                    Customer Note
                  </Badge>
                ) : deletingNoteTarget.type === "delivery" ? (
                  <Badge className="text-[10px] py-0 px-1.5 bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 border-indigo-300">
                    Delivery Note
                  </Badge>
                ) : deletingNoteTarget.type === "packaging" ? (
                  <Badge className="text-[10px] py-0 px-1.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 border-emerald-300">
                    Packaging Note
                  </Badge>
                ) : (
                  <Badge className="text-[10px] py-0 px-1.5 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-300">
                    Internal Staff Note
                  </Badge>
                )}
              </div>
              <p className="text-foreground/90 italic whitespace-pre-wrap leading-relaxed line-clamp-4">
                &quot;{deletingNoteTarget.text}&quot;
              </p>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeletingNoteTarget(null)}
              disabled={deleteNoteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDeleteNote}
              disabled={deleteNoteMutation.isPending}
              className="cursor-pointer"
            >
              {deleteNoteMutation.isPending ? "Deleting..." : "Confirm Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 5. DELETE ORDER CONFIRMATION DIALOG */}
      {/* ========================================================================= */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete Order {deletingOrder?.id}
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete this order? This action will sync to the database and cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {deletingOrder && (
            <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-xs space-y-1">
              <p className="font-semibold text-destructive">Customer: {deletingOrder.customer}</p>
              <p className="text-muted-foreground">
                Total Amount: ৳ {deletingOrder.grand_total.toLocaleString()} · Status: {deletingOrder.status}
              </p>
              <p className="text-[11px] text-muted-foreground pt-1">
                Notice: Deleting this order removes associated items and event records. Stock reservation will be freed.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteOrderMutation.isPending}
              onClick={handleConfirmDelete}
            >
              {deleteOrderMutation.isPending ? "Deleting..." : "Confirm Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isBulkStatusOpen}
        onOpenChange={(open) => {
          setIsBulkStatusOpen(open);
          if (!open) setBulkStatusError(null);
        }}
      >
        <DialogContent className="w-[95vw] sm:max-w-2xl md:max-w-3xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 flex flex-col">
          <DialogHeader className="shrink-0 border-b pb-3">
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Clock className="h-5 w-5 text-amber-600" />
              Update Status for {effectiveBulkSelectedOrders.length} Order(s)
            </DialogTitle>
            <DialogDescription>
              Set status to <span className="font-bold text-foreground uppercase">{bulkTargetStatus.replace(/_/g, " ")}</span> across all selected orders.
            </DialogDescription>
          </DialogHeader>

          {/* Inline Database / RLS Error Banner for Bulk Status */}
          {bulkStatusError && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="p-3.5 rounded-xl border border-rose-300 bg-rose-50/95 dark:bg-rose-950/50 dark:border-rose-800 text-rose-950 dark:text-rose-100 shadow-sm space-y-2 text-xs"
            >
              <div className="flex items-start gap-2.5">
                <div className="p-1 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-rose-900 dark:text-rose-200 text-xs sm:text-sm">
                      {bulkStatusError.title}
                    </p>
                    {bulkStatusError.code && (
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-rose-200/80 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300 font-semibold">
                        Code: {bulkStatusError.code}
                      </span>
                    )}
                    {bulkStatusError.isRlsError && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-200/90 dark:bg-amber-900/70 text-amber-900 dark:text-amber-200 font-bold uppercase tracking-wider">
                        RLS Policy Block
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-rose-800 dark:text-rose-200 mt-1 leading-relaxed">
                    {bulkStatusError.message}
                  </p>
                  {bulkStatusError.resolution && (
                    <div className="mt-2 p-2 rounded-lg bg-rose-100/80 dark:bg-rose-900/40 border border-rose-200 dark:border-rose-800 text-[11px] text-rose-900 dark:text-rose-200">
                      <span className="font-bold">Required Action: </span>
                      {bulkStatusError.resolution}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Pre-validation Warning Card for Ineligible Orders */}
          {bulkEligibility.ineligible.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-2">
              <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-semibold">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>
                  {bulkEligibility.ineligible.length} of {effectiveBulkSelectedOrders.length} order(s) cannot be moved to {bulkTargetStatus.replace(/_/g, " ").toUpperCase()}:
                </span>
              </div>
              <div className="space-y-1.5 pl-1 max-h-52 overflow-y-auto pr-1">
                {bulkEligibility.ineligible.map(({ order, reason }) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between gap-2 p-2 rounded-lg bg-background/80 border text-[11px]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-foreground">{order.id}</span>
                        <span className="text-[10px] px-1 rounded bg-muted text-muted-foreground uppercase">
                          {order.status}
                        </span>
                      </div>
                      <p className="text-rose-600 dark:text-rose-400 font-medium text-[10px] mt-0.5 truncate">
                        {reason}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setIsBulkStatusOpen(false);
                        handleOpenEdit(order);
                      }}
                      className="h-6 px-2 text-[10px] bg-background hover:bg-muted text-foreground cursor-pointer shrink-0"
                    >
                      <Edit className="h-2.5 w-2.5 mr-1" />
                      {reason.includes("product item") ? "Add Items" : "Edit Info"}
                    </Button>
                  </div>
                ))}
              </div>
              {bulkEligibility.eligible.length > 0 ? (
                <p className="text-[11px] text-amber-800 dark:text-amber-300 font-medium pt-1 border-t border-amber-500/20">
                  ✓ Clicking confirm will update the <span className="font-bold">{bulkEligibility.eligible.length} eligible order(s)</span> and safely skip the invalid ones.
                </p>
              ) : (
                <p className="text-[11px] text-rose-700 dark:text-rose-400 font-medium pt-1 border-t border-rose-500/20">
                  ✕ None of the selected orders can be advanced to {bulkTargetStatus.replace(/_/g, " ").toUpperCase()}. Please click &apos;Edit Info&apos; above to fill required details first.
                </p>
              )}
            </div>
          )}

          <div className="space-y-3 py-2">
            <div className="p-3 rounded-lg bg-muted/40 border text-xs space-y-1">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-foreground">
                  Selected Orders ({effectiveBulkSelectedOrders.length}):
                </p>
                {bulkEligibility.ineligible.length > 0 && (
                  <span className="text-[11px] font-mono text-amber-700 dark:text-amber-300 font-bold">
                    {bulkEligibility.eligible.length} Eligible · {bulkEligibility.ineligible.length} Ineligible
                  </span>
                )}
              </div>
              <p className="font-mono text-[11px] text-muted-foreground break-words">
                {effectiveBulkSelectedOrders.map((o) => o.id).join(", ")}
              </p>
            </div>

            {(bulkTargetStatus === "processing" ||
              bulkTargetStatus === "shipped" ||
              bulkTargetStatus === "delivered" ||
              bulkTargetStatus === "partially_delivered") && (
              <div className="space-y-1.5 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-xs">
                <label className="font-semibold text-blue-950 dark:text-blue-200 flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5 text-blue-600" />
                  Courier Partner for Dispatched Orders:
                </label>
                <select
                  value={bulkTargetCourierForStatus}
                  onChange={(e) => setBulkTargetCourierForStatus(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-md border border-input bg-background text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {[
                    "Steadfast Courier",
                    "Pathao Courier",
                    "RedX Delivery",
                    "Paperfly",
                    "Sundarban Courier",
                    "SA Paribahan",
                  ].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground">
                  Applied to all orders being moved to {bulkTargetStatus.replace(/_/g, " ").toUpperCase()} if unassigned.
                </p>
              </div>
            )}

            {bulkTargetStatus === "cancelled" ? (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-1">
                  <XCircle className="h-3.5 w-3.5 text-rose-600" />
                  Cancellation Reason (Required, min 3 chars) *:
                </label>
                <Textarea
                  value={bulkStatusNote}
                  onChange={(e) => setBulkStatusNote(e.target.value)}
                  placeholder="e.g. Customer requested cancellation / Item out of stock / Phone unreachable after 3 attempts..."
                  rows={3}
                  className="text-xs border-rose-300 dark:border-rose-800 focus-visible:ring-rose-500"
                />
                <p className="text-[11px] text-muted-foreground">
                  Saved into the database cancellation audit record and internal staff timeline.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Optional Batch Staff Note:
                </label>
                <Textarea
                  value={bulkStatusNote}
                  onChange={(e) => setBulkStatusNote(e.target.value)}
                  placeholder="e.g. Dispatched via evening courier pickup / Customer phone verification completed..."
                  rows={3}
                  className="text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  This note will be automatically added to the internal staff notes for all processed orders.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="shrink-0 pt-3 border-t bg-popover/95 backdrop-blur-xs sticky bottom-0 -mb-2 mt-4">
            <Button variant="outline" onClick={() => setIsBulkStatusOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                bulkStatusMutation.isPending ||
                bulkEligibility.eligible.length === 0 ||
                (bulkTargetStatus === "cancelled" && bulkStatusNote.trim().length < 3)
              }
              onClick={handleConfirmBulkStatus}
              className="bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
            >
              {bulkStatusMutation.isPending
                ? "Updating..."
                : bulkEligibility.ineligible.length > 0 && bulkEligibility.eligible.length > 0
                ? `Update ${bulkEligibility.eligible.length} Eligible Orders (Skip ${bulkEligibility.ineligible.length})`
                : bulkEligibility.eligible.length === 0
                ? "No Eligible Orders Selected"
                : `Update ${effectiveBulkSelectedOrders.length} Orders`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 7. BULK ASSIGN COURIER MODAL */}
      {/* ========================================================================= */}
      <Dialog open={isBulkCourierOpen} onOpenChange={setIsBulkCourierOpen}>
        <DialogContent className="w-[95vw] sm:max-w-lg md:max-w-xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-blue-600" />
              Assign Courier to {effectiveBulkSelectedOrders.length} Order(s)
            </DialogTitle>
            <DialogDescription>
              Assign <span className="font-bold text-foreground">{bulkTargetCourier}</span> as the delivery partner for all selected orders.
            </DialogDescription>
          </DialogHeader>

          {bulkCourierError && (
            <div className="p-3.5 rounded-xl border border-rose-300 bg-rose-50/95 dark:bg-rose-950/50 dark:border-rose-800 text-rose-950 dark:text-rose-100 text-xs space-y-1">
              <p className="font-bold text-rose-900 dark:text-rose-200">{bulkCourierError.title}</p>
              <p className="text-xs text-rose-800 dark:text-rose-200">{bulkCourierError.message}</p>
            </div>
          )}

          {bulkCourierEligibility.ineligible.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-2">
              <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-semibold">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>
                  {bulkCourierEligibility.ineligible.length} of {effectiveBulkSelectedOrders.length} order(s) cannot be assigned a courier:
                </span>
              </div>
              <div className="space-y-1 pl-1 max-h-40 overflow-y-auto pr-1">
                {bulkCourierEligibility.ineligible.map(({ order, reason }) => (
                  <div key={order.id} className="p-1.5 rounded bg-background/80 border text-[11px] flex items-center justify-between gap-2">
                    <span className="font-mono font-bold">{order.id}</span>
                    <span className="text-rose-600 dark:text-rose-400 font-medium truncate">{reason}</span>
                  </div>
                ))}
              </div>
              {bulkCourierEligibility.eligible.length > 0 ? (
                <p className="text-[11px] text-amber-800 dark:text-amber-300 font-medium pt-1 border-t border-amber-500/20">
                  ✓ Confirming will assign courier to the <span className="font-bold">{bulkCourierEligibility.eligible.length} eligible order(s)</span> and safely skip the finalized ones.
                </p>
              ) : (
                <p className="text-[11px] text-rose-700 dark:text-rose-400 font-medium pt-1 border-t border-rose-500/20">
                  ✕ None of the selected orders can be assigned a courier. Cancelled, returned, and delivered orders are locked.
                </p>
              )}
            </div>
          )}

          <div className="space-y-3 py-2">
            <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-xs space-y-1">
              <p className="font-semibold text-foreground">
                Selected Orders ({effectiveBulkSelectedOrders.length}):
              </p>
              <p className="font-mono text-[11px] text-blue-950 dark:text-blue-200 break-words">
                {effectiveBulkSelectedOrders.map((o) => o.id).join(", ")}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Optional Courier / Dispatch Note:
              </label>
              <Textarea
                value={bulkCourierNote}
                onChange={(e) => setBulkCourierNote(e.target.value)}
                placeholder="e.g. Bulk courier consignment manifest #48291..."
                rows={3}
                className="text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Stored in internal staff notes for all processed orders.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkCourierOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={bulkCourierMutation.isPending || bulkCourierEligibility.eligible.length === 0}
              onClick={handleConfirmBulkCourier}
              className="bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
            >
              {bulkCourierMutation.isPending
                ? "Assigning..."
                : bulkCourierEligibility.ineligible.length > 0 && bulkCourierEligibility.eligible.length > 0
                ? `Assign to ${bulkCourierEligibility.eligible.length} Eligible Orders (Skip ${bulkCourierEligibility.ineligible.length})`
                : bulkCourierEligibility.eligible.length === 0
                ? "No Eligible Orders Selected"
                : `Assign to ${effectiveBulkSelectedOrders.length} Orders`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 8. BULK DELETE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      <Dialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete {effectiveBulkSelectedOrders.length} Order(s)
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete these {effectiveBulkSelectedOrders.length} orders? This action will sync to the database and cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {bulkDeleteError && (
            <div className="p-3.5 rounded-xl border border-rose-300 bg-rose-50/95 dark:bg-rose-950/50 dark:border-rose-800 text-rose-950 dark:text-rose-100 text-xs space-y-1">
              <p className="font-bold text-rose-900 dark:text-rose-200">{bulkDeleteError.title}</p>
              <p className="text-xs text-rose-800 dark:text-rose-200">{bulkDeleteError.message}</p>
            </div>
          )}

          {bulkDeleteEligibility.ineligible.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-2">
              <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-semibold">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>
                  {bulkDeleteEligibility.ineligible.length} of {effectiveBulkSelectedOrders.length} order(s) cannot be deleted:
                </span>
              </div>
              <div className="space-y-1 pl-1 max-h-40 overflow-y-auto pr-1">
                {bulkDeleteEligibility.ineligible.map(({ order, reason }) => (
                  <div key={order.id} className="p-1.5 rounded bg-background/80 border text-[11px] flex items-center justify-between gap-2">
                    <span className="font-mono font-bold">{order.id}</span>
                    <span className="text-rose-600 dark:text-rose-400 font-medium truncate">{reason}</span>
                  </div>
                ))}
              </div>
              {bulkDeleteEligibility.eligible.length > 0 ? (
                <p className="text-[11px] text-amber-800 dark:text-amber-300 font-medium pt-1 border-t border-amber-500/20">
                  ✓ Confirming will delete the <span className="font-bold">{bulkDeleteEligibility.eligible.length} eligible order(s)</span> and safely preserve the dispatched ones.
                </p>
              ) : (
                <p className="text-[11px] text-rose-700 dark:text-rose-400 font-medium pt-1 border-t border-rose-500/20">
                  ✕ None of the selected orders can be deleted. Orders that are shipped or delivered must be preserved for audit and inventory integrity.
                </p>
              )}
            </div>
          )}

          <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-xs space-y-1.5">
            <p className="font-semibold text-destructive">
              Selected Orders ({effectiveBulkSelectedOrders.length}):
            </p>
            <p className="text-muted-foreground font-mono text-[11px] break-words">
              {effectiveBulkSelectedOrders.map((o) => o.id).join(", ")}
            </p>
            <p className="text-[11px] text-muted-foreground pt-1">
              Associated line items and event records will be permanently removed.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={bulkDeleteMutation.isPending || bulkDeleteEligibility.eligible.length === 0}
              onClick={handleConfirmBulkDelete}
              className="cursor-pointer"
            >
              {bulkDeleteMutation.isPending
                ? "Deleting..."
                : bulkDeleteEligibility.ineligible.length > 0 && bulkDeleteEligibility.eligible.length > 0
                ? `Delete ${bulkDeleteEligibility.eligible.length} Eligible Orders (Skip ${bulkDeleteEligibility.ineligible.length})`
                : bulkDeleteEligibility.eligible.length === 0
                ? "No Deletable Orders Selected"
                : `Delete ${effectiveBulkSelectedOrders.length} Orders`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
