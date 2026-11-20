"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogFooter as DialogFooter,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Users,
  CheckCircle2,
  Clock,
  ShoppingBag,
  Sparkles,
  Loader2,
} from "lucide-react";
import {
  createCallListAction,
  getCustomersForListAction,
  getAssignableStaffAction,
  CustomerFilterOption,
} from "@/actions/call-lists";

interface CreateCallListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (listId: string) => void;
}

export function CreateCallListDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateCallListDialogProps) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [assignedTo, setAssignedTo] = React.useState<string>("none");
  const [segment, setSegment] = React.useState<
    "all" | "incomplete" | "past_buyers" | "dormant_30d" | "high_value"
  >("all");
  const [search, setSearch] = React.useState("");
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
    enabled: open,
  });

  // Fetch filtered customers
  const { data: customers = [], isLoading: isLoadingCustomers } = useQuery({
    queryKey: ["admin", "calls", "filter-customers", segment, search],
    queryFn: async () => {
      const res = await getCustomersForListAction({
        segment,
        search,
        limit: 150,
      });
      return res.success ? res.data : [];
    },
    enabled: open,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please enter a list title");
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
        toast.success(`Call list "${title}" created with ${selectedCustomerIds.size} contacts!`);
        onOpenChange(false);
        setTitle("");
        setDescription("");
        setSelectedCustomerIds(new Set());
        onSuccess(res.listId);
      } else {
        toast.error(res.error || "Failed to create call list");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create call list");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="text-xl flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Create Customer Call List
          </DialogTitle>
          <DialogDescription>
            Target specific customer segments or hand-pick customers for telephone outreach.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* List Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="title" className="text-xs font-semibold">
                  List Title *
                </Label>
                <Input
                  id="title"
                  placeholder="E.g., Winter Khejur Gur Launch - Dormant Buyers"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="assignee" className="text-xs font-semibold">
                  Assign To Agent (Optional)
                </Label>
                <Select value={assignedTo} onValueChange={(val) => setAssignedTo(val ?? "none")}>
                  <SelectTrigger id="assignee" className="w-full">
                    <SelectValue placeholder="All Staff (Unassigned)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Shared / Unassigned</SelectItem>
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
                  Description / Campaign Goal
                </Label>
                <Input
                  id="desc"
                  placeholder="Offer 10% coupon for repeat order or ask feedback"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            {/* Customer Picker */}
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Select Customers to Include ({selectedCustomerIds.size} selected)
                </Label>
              </div>

              {/* Segment Tabs */}
              <Tabs
                value={segment}
                onValueChange={(v: any) => setSegment(v)}
                className="w-full"
              >
                <TabsList className="grid grid-cols-2 sm:grid-cols-5 w-full h-auto p-1 text-xs">
                  <TabsTrigger value="all" className="text-xs py-1.5">
                    All Customers
                  </TabsTrigger>
                  <TabsTrigger value="incomplete" className="text-xs py-1.5">
                    Incomplete Orders
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

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                <Input
                  placeholder="Filter by customer name, phone number or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 text-xs"
                />
              </div>

              {/* Customer Selection Table */}
              <div className="border rounded-md max-h-56 overflow-y-auto divide-y bg-card">
                {isLoadingCustomers ? (
                  <div className="py-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    Loading customers...
                  </div>
                ) : customers.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    No customers found matching this filter.
                  </div>
                ) : (
                  <>
                    <div className="p-2.5 bg-muted/40 flex items-center justify-between sticky top-0 z-10 border-b">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="select-all"
                          checked={isAllCurrentSelected}
                          onCheckedChange={handleSelectAll}
                        />
                        <label
                          htmlFor="select-all"
                          className="text-xs font-semibold cursor-pointer"
                        >
                          Select All Visible ({customers.length})
                        </label>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {selectedCustomerIds.size} selected total
                      </span>
                    </div>

                    {customers.map((c) => {
                      const isSelected = selectedCustomerIds.has(c.id);
                      return (
                        <div
                          key={c.id}
                          onClick={() => handleToggleCustomer(c.id)}
                          className={`p-2.5 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-primary/5 hover:bg-primary/10"
                              : "hover:bg-muted/30"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => handleToggleCustomer(c.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div>
                              <span className="font-semibold text-foreground block">
                                {c.name}
                              </span>
                              <span className="text-muted-foreground font-mono">
                                {c.phone}
                              </span>
                            </div>
                          </div>
                          <div className="text-right space-y-0.5">
                            <div className="font-semibold text-foreground">
                              {c.orders} {c.orders === 1 ? "order" : "orders"}
                            </div>
                            <div className="text-muted-foreground">
                              ৳ {c.spent.toLocaleString("en-BD")}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 border-t bg-card/60 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {selectedCustomerIds.size} customers will be added to this calling list.
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-primary font-semibold"
                disabled={isSubmitting || selectedCustomerIds.size === 0}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                    Creating List...
                  </>
                ) : (
                  `Create Call List (${selectedCustomerIds.size})`
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
