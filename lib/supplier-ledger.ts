export type SupplierType = "gachi" | "mill" | "packaging" | "trader" | "other";

export type SupplierLedgerStatus = "active" | "voided";

export type PurchaseSettlementStatus = "active" | "paid" | "voided";

export const SUPPLIER_TYPE_LABELS: Record<SupplierType, { en: string; bn: string }> = {
  gachi: { en: "Gachi / Tapper", bn: "গাছি" },
  mill: { en: "Sugar Mill", bn: "চিনিকল" },
  packaging: { en: "Packaging & Jars", bn: "প্যাকেজিং ও জার" },
  trader: { en: "Wholesale Trader", bn: "পাইকারি সরবরাহকারী" },
  other: { en: "Other", bn: "অন্যান্য" },
};

export const PURCHASE_UNITS = ["kg", "g", "l", "ml", "t", "pcs"] as const;

export const SUPPLIER_PAYMENT_METHODS = [
  { value: "cash", label: "Cash / নগদ" },
  { value: "bkash", label: "bKash / বিকাশ" },
  { value: "nagad", label: "Nagad / নগদ (MFS)" },
  { value: "rocket", label: "Rocket / রকেট" },
  { value: "bank_transfer", label: "Bank Transfer / ব্যাংক" },
] as const;

export function roundMoney(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export interface PurchaseLineDraft {
  quantity: number;
  unitPrice: number;
}

export function computePurchaseTotals(
  items: PurchaseLineDraft[],
  extraCharges = 0,
  discountAmount = 0
): {
  subtotal: number;
  extraCharges: number;
  discountAmount: number;
  totalAmount: number;
  isDiscountValid: boolean;
} {
  const subtotal = roundMoney(
    items.reduce((sum, item) => {
      const qty = Math.max(0, Number(item.quantity) || 0);
      const price = Math.max(0, Number(item.unitPrice) || 0);
      return sum + roundMoney(qty * price);
    }, 0)
  );
  const extra = roundMoney(Math.max(0, Number(extraCharges) || 0));
  const discount = roundMoney(Math.max(0, Number(discountAmount) || 0));
  const gross = roundMoney(subtotal + extra);
  const isDiscountValid = discount <= gross;
  const totalAmount = roundMoney(Math.max(0, gross - discount));

  return {
    subtotal,
    extraCharges: extra,
    discountAmount: discount,
    totalAmount,
    isDiscountValid,
  };
}

export function getBalanceStatus(netBalance: number): "due" | "advance" | "settled" {
  const rounded = roundMoney(netBalance);
  if (rounded > 0.005) return "due";
  if (rounded < -0.005) return "advance";
  return "settled";
}

export function computePurchaseSettlement(
  totalAmount: number,
  linkedPaidAmount: number,
  status: SupplierLedgerStatus
): {
  paidAmount: number;
  remainingDue: number;
  settlementStatus: PurchaseSettlementStatus;
  isPartiallyPaid: boolean;
} {
  if (status === "voided") {
    return {
      paidAmount: 0,
      remainingDue: 0,
      settlementStatus: "voided",
      isPartiallyPaid: false,
    };
  }

  const total = roundMoney(Math.max(0, Number(totalAmount) || 0));
  const paid = roundMoney(Math.max(0, Number(linkedPaidAmount) || 0));
  const rawDue = roundMoney(Math.max(0, total - paid));
  const remainingDue = rawDue <= 0.005 ? 0 : rawDue;
  const settlementStatus: PurchaseSettlementStatus = remainingDue === 0 ? "paid" : "active";

  return {
    paidAmount: paid,
    remainingDue,
    settlementStatus,
    isPartiallyPaid: paid > 0.005 && remainingDue > 0,
  };
}

export interface KhataPurchaseInput {
  id: string;
  number: string;
  date: string;
  createdAt: string;
  totalAmount: number;
  summary: string;
  notes?: string | null;
  status: SupplierLedgerStatus;
}

export interface KhataPaymentInput {
  id: string;
  number: string;
  date: string;
  createdAt: string;
  amount: number;
  method: string;
  paidBy?: string | null;
  linkedPurchaseNumber?: string | null;
  notes?: string | null;
  status: SupplierLedgerStatus;
}

export interface KhataEntry {
  id: string;
  kind: "opening" | "purchase" | "payment";
  refNumber: string;
  date: string;
  description: string;
  meta: string | null;
  debit: number; // increases payable due (purchase)
  credit: number; // reduces payable due (cash payment)
  runningBalance: number;
  status: SupplierLedgerStatus;
}

export function buildSupplierKhata(
  openingBalance: number,
  purchases: KhataPurchaseInput[],
  payments: KhataPaymentInput[]
): {
  entries: KhataEntry[];
  openingBalance: number;
  totalPurchased: number;
  totalPaid: number;
  netBalance: number;
} {
  const opening = roundMoney(Number(openingBalance) || 0);

  type RawEvent = {
    sortDate: string;
    sortOrder: number; // 0 = purchase, 1 = payment on same date
    sortCreated: string;
    kind: "purchase" | "payment";
    id: string;
    refNumber: string;
    date: string;
    description: string;
    meta: string | null;
    debit: number;
    credit: number;
    status: SupplierLedgerStatus;
  };

  const events: RawEvent[] = [
    ...purchases.map((p) => ({
      sortDate: p.date,
      sortOrder: 0,
      sortCreated: p.createdAt,
      kind: "purchase" as const,
      id: p.id,
      refNumber: p.number,
      date: p.date,
      description: p.summary,
      meta: p.notes || null,
      debit: roundMoney(p.totalAmount),
      credit: 0,
      status: p.status,
    })),
    ...payments.map((pay) => ({
      sortDate: pay.date,
      sortOrder: 1,
      sortCreated: pay.createdAt,
      kind: "payment" as const,
      id: pay.id,
      refNumber: pay.number,
      date: pay.date,
      description: pay.linkedPurchaseNumber
        ? `Cash payment (${pay.linkedPurchaseNumber})`
        : `${pay.method === "cash" ? "Cash" : pay.method} payment`,
      meta: [pay.paidBy ? `Paid by ${pay.paidBy}` : null, pay.notes || null].filter(Boolean).join(" · ") || null,
      debit: 0,
      credit: roundMoney(pay.amount),
      status: pay.status,
    })),
  ];

  events.sort((a, b) => {
    if (a.sortDate !== b.sortDate) return a.sortDate.localeCompare(b.sortDate);
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.sortCreated.localeCompare(b.sortCreated);
  });

  const entries: KhataEntry[] = [];
  let running = opening;
  let totalPurchased = 0;
  let totalPaid = 0;

  if (opening !== 0) {
    entries.push({
      id: "opening-balance",
      kind: "opening",
      refNumber: "OPENING",
      date: "",
      description: opening > 0 ? "Opening payable due" : "Opening advance credit",
      meta: null,
      debit: opening > 0 ? opening : 0,
      credit: opening < 0 ? Math.abs(opening) : 0,
      runningBalance: running,
      status: "active",
    });
  }

  for (const ev of events) {
    if (ev.status === "active") {
      running = roundMoney(running + ev.debit - ev.credit);
      totalPurchased = roundMoney(totalPurchased + ev.debit);
      totalPaid = roundMoney(totalPaid + ev.credit);
    }

    entries.push({
      id: ev.id,
      kind: ev.kind,
      refNumber: ev.refNumber,
      date: ev.date,
      description: ev.description,
      meta: ev.meta,
      debit: ev.debit,
      credit: ev.credit,
      runningBalance: running,
      status: ev.status,
    });
  }

  return {
    entries,
    openingBalance: opening,
    totalPurchased,
    totalPaid,
    netBalance: running,
  };
}
