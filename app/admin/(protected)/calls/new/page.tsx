"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Users,
  Search,
  Calendar,
  Sparkles,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createCallListAction,
  getCustomersForListAction,
  getAssignableStaffAction,
} from "@/actions/call-lists";
import { DateRangePicker } from "@/components/admin/date-range-picker";
import { format } from "date-fns";

export default function NewCallListPage() {
  const router = useRouter();

  // List Form Details
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [assignedTo, setAssignedTo] = React.useState<string>("none");

  // Filters
  const [segment, setSegment] = React.useState<
    "all" | "incomplete" | "past_buyers" | "dormant_30d" | "high_value"
  >("all");
  const [startDate, setStartDate] = React.useState<string>("");
  const [endDate, setEndDate] = React.useState<string>("");
  const [search, setSearch] = React.useState<string>("");

  // Customer Selection
  const [selectedCustomerIds, setSelectedCustomerIds] = React.useState<Set<string>>(
    new Set()
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Fetch staff
  const { data: staffList = [] } = useQuery({
    queryKey: ["admin", "calls", "staff"],
    queryFn: async () => {
      const res = await getAssignableStaffAction();
      return res.success ? res.data : [];
    },
    staleTime: 60_000,
  });

  // Fetch filtered customers
  const { data: customers = [], isLoading: isLoadingCustomers } = useQuery({
    queryKey: ["admin", "calls", "filter-customers", segment, search, startDate, endDate],
    queryFn: async () => {
      const res = await getCustomersForListAction({
        segment,
        search,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        limit: 500,
      });
      return res.success ? res.data : [];
    },
    staleTime: 10_000,
  });

  // Handle select all in current filtered view
  const handleSelectAll = (checked: boolean | "indeterminate") => {
    const updated = new Set(selectedCustomerIds);
    if (checked === true) {
      customers.forEach((c) => updated.add(c.id));
    } else {
      customers.forEach((c) => updated.delete(c.id));
    }
    setSelectedCustomerIds(updated);
  };

  const handleToggleCustomer = (id: string) => {
    const updated = new Set(selectedCustomerIds);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedCustomerIds(updated);
  };

  const isAllCurrentSelected =
    customers.length > 0 && customers.every((c) => selectedCustomerIds.has(c.id));

  // Quick Date Presets
  const applyWinterPreset = () => {
    setStartDate("2025-11-01");
    setEndDate("2026-04-01");
    if (!title) {
      setTitle("Winter Season Customers (Nov 2025 – Apr 2026)");
    }
    if (!description) {
      setDescription("Re-engagement outreach for customers who purchased last winter season.");
    }
    toast.info("Applied date filter: 1 Nov 2025 – 1 Apr 2026");
  };

  const applyLast30DaysPreset = () => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    setStartDate(from.toISOString().slice(0, 10));
    setEndDate(to.toISOString().slice(0, 10));
  };

  const clearDateFilter = () => {
    setStartDate("");
    setEndDate("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please enter a call list title");
      return;
    }
    if (selectedCustomerIds.size === 0) {
      toast.error("Please select at least one customer to call");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await createCallListAction({
        title: title.trim(),
        description: description.trim() || undefined,
        assignedTo: assignedTo === "none" ? null : assignedTo,
        customerIds: Array.from(selectedCustomerIds),
      });

      if (res.success && res.listId) {
        toast.success(`Call list created with ${selectedCustomerIds.size} customers!`);
        router.push(`/admin/calls/${res.listId}`);
      } else {
        toast.error(res.error || "Failed to create call list");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create call list");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon-sm" className="h-8 w-8">
            <Link href="/admin/calls" title="Back to Call Lists">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" />
              Create Call List
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select customer segments or purchase date ranges to generate a focused telecalling list.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="text-xs">
            <Link href="/admin/calls">Cancel</Link>
          </Button>
          <Button
            size="sm"
            className="bg-primary font-semibold text-xs gap-1.5"
            onClick={handleSubmit}
            disabled={isSubmitting || selectedCustomerIds.size === 0}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Creating...
              </>
            ) : (
              `Create List (${selectedCustomerIds.size})`
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: LIST DETAILS */}
        <div className="space-y-6 lg:col-span-1">
          <Card className="shadow-xs">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-sm font-semibold">List Information</CardTitle>
              <CardDescription className="text-xs">
                Campaign name, objectives, and agent assignment.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-0 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="title" className="text-xs font-semibold">
                  List Title *
                </Label>
                <Input
                  id="title"
                  placeholder="E.g., Winter Season Customers (Nov 2025 – Apr 2026)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="assignee" className="text-xs font-semibold">
                  Assigned Telecaller / Staff
                </Label>
                <Select value={assignedTo} onValueChange={(val) => setAssignedTo(val ?? "none")}>
                  <SelectTrigger id="assignee" className="w-full text-xs">
                    <SelectValue placeholder="All Staff (Shared Queue)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Shared Queue (All Staff)</SelectItem>
                    {staffList.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="desc" className="text-xs font-semibold">
                  Campaign Goal / Remarks
                </Label>
                <Textarea
                  id="desc"
                  placeholder="Offer winter special discount or collect product feedback."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="text-xs resize-none"
                />
              </div>
            </CardContent>
          </Card>

          {/* Quick Presets Box */}
          <Card className="shadow-xs bg-muted/20 border-dashed">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-primary">
                <Sparkles className="w-3.5 h-3.5" />
                Quick Campaign Presets
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full justify-start text-xs h-8 font-normal"
                onClick={applyWinterPreset}
              >
                ❄️ Winter Season (Nov 2025 – Apr 2026)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full justify-start text-xs h-8 font-normal"
                onClick={applyLast30DaysPreset}
              >
                📅 Recent Buyers (Last 30 Days)
              </Button>
              {(startDate || endDate) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs h-7 text-muted-foreground gap-1"
                  onClick={clearDateFilter}
                >
                  <RotateCcw className="w-3 h-3" />
                  Clear Date Filters
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: CUSTOMER SELECTION & FILTERS */}
        <div className="space-y-4 lg:col-span-2">
          <Card className="shadow-xs">
            <CardHeader className="p-5 pb-3 space-y-3 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <span>Select Customer Audience</span>
                    <Badge variant="secondary" className="text-xs">
                      {selectedCustomerIds.size} selected
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Filter by purchase date range, customer segment, or search keywords.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      const all = new Set(selectedCustomerIds);
                      customers.forEach((c) => all.add(c.id));
                      setSelectedCustomerIds(all);
                    }}
                  >
                    Select All ({customers.length})
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => setSelectedCustomerIds(new Set())}
                  >
                    Clear
                  </Button>
                </div>
              </div>

              {/* Segment Tabs */}
              <Tabs
                value={segment}
                onValueChange={(v) => {
                  if (v) setSegment(v as typeof segment);
                }}
                className="w-full"
              >
                <TabsList className="grid grid-cols-2 sm:grid-cols-5 w-full h-auto p-1 text-xs">
                  <TabsTrigger value="all" className="text-xs py-1.5">
                    All
                  </TabsTrigger>
                  <TabsTrigger value="incomplete" className="text-xs py-1.5">
                    Incomplete
                  </TabsTrigger>
                  <TabsTrigger value="past_buyers" className="text-xs py-1.5">
                    Past Buyers
                  </TabsTrigger>
                  <TabsTrigger value="dormant_30d" className="text-xs py-1.5">
                    Dormant (30d+)
                  </TabsTrigger>
                  <TabsTrigger value="high_value" className="text-xs py-1.5">
                    High Value (৳2k+)
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Universal Purchase Date Range Pickers & Search */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1 items-end">
                <div className="sm:col-span-5 space-y-1">
                  <Label className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-amber-600" /> Purchase Date Range
                  </Label>
                  <DateRangePicker
                    from={startDate}
                    to={endDate}
                    onSelect={({ from, to }) => {
                      setStartDate(from && from !== "all" ? from : "");
                      setEndDate(to && to !== "all" ? to : "");
                    }}
                    allowAllTime={true}
                    disableFutureDates={false}
                    placeholder="All Purchase Dates (No Filter)"
                    extraPresets={[
                      {
                        id: "winter_season",
                        label: "Winter Season",
                        from: "2025-11-01",
                        to: "2026-04-01",
                      },
                    ]}
                    className="w-full"
                  />
                </div>

                <div className="sm:col-span-7 space-y-1">
                  <Label className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                    <Search className="w-3 h-3" /> Search Customer
                  </Label>
                  <div className="relative">
                    <Input
                      placeholder="Name, phone, or email..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {/* Customer Table */}
              <div className="max-h-[500px] overflow-y-auto divide-y">
                {isLoadingCustomers ? (
                  <div className="py-16 text-center text-sm text-muted-foreground space-y-2">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                    <p>Loading matching customers...</p>
                  </div>
                ) : customers.length === 0 ? (
                  <div className="py-16 text-center text-sm text-muted-foreground">
                    No customers found matching these date and segment filters.
                  </div>
                ) : (
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/40 text-muted-foreground font-semibold sticky top-0 z-10 border-b">
                      <tr>
                        <th className="py-2.5 px-3 w-10">
                          <Checkbox
                            checked={isAllCurrentSelected}
                            onCheckedChange={handleSelectAll}
                          />
                        </th>
                        <th className="py-2.5 px-3">Customer</th>
                        <th className="py-2.5 px-3">Orders</th>
                        <th className="py-2.5 px-3">Total Spent</th>
                        <th className="py-2.5 px-3">Last Order</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {customers.map((c) => {
                        const isSelected = selectedCustomerIds.has(c.id);
                        return (
                          <tr
                            key={c.id}
                            onClick={() => handleToggleCustomer(c.id)}
                            className={`cursor-pointer transition-colors ${
                              isSelected
                                ? "bg-primary/5 hover:bg-primary/10"
                                : "hover:bg-muted/30"
                            }`}
                          >
                            <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => handleToggleCustomer(c.id)}
                              />
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-semibold text-foreground block">
                                {c.name}
                              </span>
                              <span className="font-mono text-muted-foreground text-[11px]">
                                {c.phone}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <Badge variant="outline" className="text-[11px]">
                                {c.orders} {c.orders === 1 ? "order" : "orders"}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-foreground">
                              ৳ {c.spent.toLocaleString("en-BD")}
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground">
                              {c.lastOrder
                                ? format(new Date(c.lastOrder), "dd MMM yyyy")
                                : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-3.5 bg-background/95 backdrop-blur-md border-t z-20 flex items-center justify-between shadow-lg px-6 lg:pl-64">
        <div className="flex items-center gap-3 text-xs">
          <span className="font-semibold text-foreground">
            {selectedCustomerIds.size} of {customers.length} customers selected
          </span>
          {(startDate || endDate) && (
            <Badge variant="secondary" className="text-[11px]">
              Date: {startDate || "Any"} to {endDate || "Any"}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="text-xs">
            <Link href="/admin/calls">Cancel</Link>
          </Button>
          <Button
            size="sm"
            className="bg-primary font-semibold text-xs gap-1.5"
            onClick={handleSubmit}
            disabled={isSubmitting || selectedCustomerIds.size === 0}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Creating Call List...
              </>
            ) : (
              `Create Call List (${selectedCustomerIds.size})`
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
