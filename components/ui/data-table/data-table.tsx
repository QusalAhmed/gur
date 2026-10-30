"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  RowSelectionState,
  OnChangeFn,
  PaginationState,
} from "@tanstack/react-table";
import { Search, X, CheckSquare, AlertCircle, Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DataTablePagination } from "./data-table-pagination";
import { DataTableViewOptions } from "./data-table-view-options";
import { cn } from "@/lib/utils";

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchPlaceholder?: string;
  searchColumn?: string;
  searchKey?: string;
  enableGlobalFilter?: boolean;
  enableRowSelection?: boolean;
  enableSorting?: boolean;
  enableColumnVisibility?: boolean;
  enablePagination?: boolean;
  initialPageSize?: number;
  pageSize?: number;
  pageSizeOptions?: number[];
  toolbarPrefix?: React.ReactNode;
  toolbarSuffix?: React.ReactNode;
  bulkActions?: (selectedRows: TData[], clearSelection: () => void) => React.ReactNode;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  onRowClick?: (row: TData) => void;
  renderSubRow?: (row: TData) => React.ReactNode;
  isRowExpanded?: (row: TData) => boolean;
  getRowId?: (row: TData, index: number) => string;
  className?: string;

  // Server-side / controlled pagination & sorting:
  manualPagination?: boolean;
  pageCount?: number;
  rowCount?: number;
  pagination?: PaginationState;
  onPaginationChange?: OnChangeFn<PaginationState>;
  manualSorting?: boolean;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  isLoading?: boolean;
  isFetching?: boolean;
  loadingMessage?: string;
  loadingSkeletonRows?: number;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder = "Search records...",
  searchColumn,
  searchKey,
  enableGlobalFilter = true,
  enableRowSelection = true,
  enableSorting = true,
  enableColumnVisibility = true,
  enablePagination = true,
  initialPageSize = 10,
  pageSize,
  pageSizeOptions = [5, 10, 20, 50],
  toolbarPrefix,
  toolbarSuffix,
  bulkActions,
  emptyMessage = "No results found matching your criteria.",
  emptyIcon,
  onRowClick,
  renderSubRow,
  isRowExpanded,
  getRowId = (row: any, index: number) =>
    row && typeof row === "object" && "id" in row && row.id != null
      ? String(row.id)
      : String(index),
  className,

  // Server-side props
  manualPagination = false,
  pageCount,
  rowCount,
  pagination: controlledPagination,
  onPaginationChange,
  manualSorting = false,
  sorting: controlledSorting,
  onSortingChange,
  isLoading = false,
  isFetching = false,
  loadingMessage,
  loadingSkeletonRows,
}: DataTableProps<TData, TValue>) {
  const activeSearchCol = searchColumn || searchKey;
  const effectivePageSize = pageSize || initialPageSize;

  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const [internalSorting, setInternalSorting] = React.useState<SortingState>([]);
  const [internalPagination, setInternalPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: effectivePageSize,
  });

  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = React.useState("");

  const effectiveSorting = controlledSorting !== undefined ? controlledSorting : internalSorting;
  const effectivePagination =
    controlledPagination !== undefined ? controlledPagination : internalPagination;

  const table = useReactTable({
    data,
    columns,
    getRowId,
    manualPagination,
    pageCount: manualPagination ? pageCount : undefined,
    rowCount: manualPagination ? rowCount : undefined,
    manualSorting,
    state: {
      sorting: effectiveSorting,
      pagination: effectivePagination,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter: enableGlobalFilter ? globalFilter : undefined,
    },
    enableRowSelection,
    enableSorting,
    onSortingChange: onSortingChange ?? setInternalSorting,
    onPaginationChange: onPaginationChange ?? setInternalPagination,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: manualPagination ? undefined : getFilteredRowModel(),
    getPaginationRowModel:
      enablePagination && !manualPagination ? getPaginationRowModel() : undefined,
    getSortedRowModel: manualSorting ? undefined : getSortedRowModel(),
    initialState: {
      pagination: {
        pageSize: effectivePageSize,
      },
    },
  });

  const selectedRows = React.useMemo(() => {
    if (!mounted || !enableRowSelection || !rowSelection || Object.keys(rowSelection).length === 0) {
      return [];
    }
    return table.getFilteredSelectedRowModel().rows.map((r) => r.original);
  }, [mounted, enableRowSelection, rowSelection, table]);

  const selectedCount = selectedRows.length;

  const clearSelection = () => {
    table.resetRowSelection();
  };

  if (!mounted) {
    return (
      <div className={cn("space-y-3", className)}>
        {/* Top Toolbar Skeleton */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-center gap-2 flex-wrap">
            {toolbarPrefix}
            {(enableGlobalFilter || activeSearchCol) && (
              <div className="h-9 w-full sm:w-64 rounded-lg bg-muted/40 animate-pulse border border-input/40" />
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {enableColumnVisibility && (
              <div className="h-8 w-24 rounded-lg bg-muted/40 animate-pulse border border-input/40" />
            )}
            {toolbarSuffix}
          </div>
        </div>

        {/* Main Table Skeleton Container */}
        <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                {Array.from({ length: Math.min(columns.length || 5, 6) }).map((_, i) => (
                  <TableHead key={i} className="py-2.5 px-3">
                    <div className="h-4 w-20 bg-muted/60 rounded animate-pulse" />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: Math.min(effectivePageSize, 5) }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: Math.min(columns.length || 5, 6) }).map((_, j) => (
                    <TableCell key={j} className="py-3 px-3">
                      <div className="h-4 w-full bg-muted/30 rounded animate-pulse" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  const isInitialOrEmptyLoading = isLoading || (isFetching && (!data || data.length === 0));

  return (
    <div className={cn("space-y-3", className)}>
      {/* Top Toolbar */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2 flex-wrap">
          {toolbarPrefix}

          {/* Search Input */}
          {(enableGlobalFilter || activeSearchCol) && (
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={
                  activeSearchCol
                    ? (table.getColumn(activeSearchCol)?.getFilterValue() as string) ?? ""
                    : globalFilter
                }
                onChange={(event) => {
                  if (activeSearchCol) {
                    table.getColumn(activeSearchCol)?.setFilterValue(event.target.value);
                  } else {
                    setGlobalFilter(event.target.value);
                  }
                }}
                className="pl-8 h-9 text-xs"
              />
              {((activeSearchCol && table.getColumn(activeSearchCol)?.getFilterValue()) || globalFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    if (activeSearchCol) {
                      table.getColumn(activeSearchCol)?.setFilterValue("");
                    } else {
                      setGlobalFilter("");
                    }
                  }}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {enableColumnVisibility && <DataTableViewOptions table={table} />}
          {toolbarSuffix}
        </div>
      </div>

      {/* Floating Bulk Actions Bar when rows are selected */}
      {enableRowSelection && selectedCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 sm:px-4 rounded-xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 text-xs animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-amber-600" />
            <span className="font-semibold text-foreground">
              {selectedCount} item{selectedCount > 1 ? "s" : ""} selected
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Clear
            </Button>
          </div>

          {bulkActions && (
            <div className="flex items-center gap-2 flex-wrap">
              {bulkActions(selectedRows, clearSelection)}
            </div>
          )}
        </div>
      )}

      {/* Main Table Container */}
      <div className="relative rounded-xl border bg-card shadow-xs overflow-hidden">
        {/* Sleek top glowing indeterminate progress bar on data fetch / page transition */}
        {(isFetching || isLoading) && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500/20 overflow-hidden z-30 pointer-events-none">
            <div className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 animate-table-progress shadow-[0_0_10px_rgba(245,158,11,0.6)]" />
          </div>
        )}

        {/* Floating loading badge overlay in the middle of the screen */}
        {(isFetching || isLoading) && (
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none transition-all duration-200 animate-in fade-in">
            <div className="inline-flex items-center gap-2.5 px-4 py-2 sm:px-5 sm:py-2.5 rounded-full bg-background/95 dark:bg-card/95 border border-amber-500/40 shadow-2xl backdrop-blur-md text-xs sm:text-sm font-semibold text-foreground tracking-wide animate-in zoom-in-95 duration-200 pointer-events-auto">
              <Loader2 className="h-4 w-4 animate-spin text-amber-600 dark:text-amber-400 shrink-0" />
              <span>{loadingMessage || "Loading data..."}</span>
            </div>
          </div>
        )}

        <Table>
          <TableHeader className="bg-muted/40">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} className="py-2 px-2 sm:px-2.5">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isInitialOrEmptyLoading ? (
              // Animated realistic skeleton rows while loading data initially or when empty
              Array.from({ length: loadingSkeletonRows || Math.min(effectivePageSize, 8) }).map((_, rowIndex) => (
                <TableRow key={`skeleton-row-${rowIndex}`} className="hover:bg-transparent">
                  {columns.map((column, colIndex) => {
                    const isFirst = colIndex === 0;
                    const isSecond = colIndex === 1;
                    const isThird = colIndex === 2;
                    const isFourth = colIndex === 3;
                    const isLast = colIndex === columns.length - 1;

                    return (
                      <TableCell
                        key={`skeleton-cell-${rowIndex}-${colIndex}`}
                        className="py-3 px-2 sm:px-2.5"
                      >
                        {isFirst ? (
                          <div className="h-4 w-4 rounded bg-muted/60 animate-pulse" />
                        ) : isSecond ? (
                          <div className="space-y-1.5">
                            <div className="h-4 w-24 sm:w-28 rounded bg-muted/70 animate-pulse" />
                            <div className="h-3 w-16 sm:w-20 rounded bg-muted/40 animate-pulse" />
                          </div>
                        ) : isThird ? (
                          <div className="space-y-1.5">
                            <div className="h-4 w-32 sm:w-40 rounded bg-muted/70 animate-pulse" />
                            <div className="h-3 w-20 sm:w-24 rounded bg-muted/40 animate-pulse" />
                          </div>
                        ) : isFourth ? (
                          <div className="h-6 w-20 sm:w-24 rounded-full bg-muted/60 animate-pulse" />
                        ) : isLast ? (
                          <div className="flex justify-end">
                            <div className="h-7 w-16 sm:w-20 rounded-lg bg-muted/60 animate-pulse" />
                          </div>
                        ) : (
                          <div className="h-4 w-20 sm:w-24 rounded bg-muted/50 animate-pulse" />
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => {
                const isSelected = row.getIsSelected();
                return (
                  <React.Fragment key={row.id}>
                    <TableRow
                      data-state={isSelected && "selected"}
                      onClick={() => onRowClick?.(row.original)}
                      className={cn(
                        "transition-colors",
                        isSelected && "bg-amber-500/5 dark:bg-amber-500/10",
                        onRowClick && "cursor-pointer",
                        renderSubRow && (!isRowExpanded || isRowExpanded(row.original)) && "border-b-0 hover:bg-muted/30",
                        isFetching && "opacity-45 pointer-events-none transition-opacity duration-200"
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="py-2.5 px-2 sm:px-2.5 text-xs align-top whitespace-normal">
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                    {renderSubRow && (!isRowExpanded || isRowExpanded(row.original)) && (
                      <TableRow
                        data-state={isSelected && "selected"}
                        className={cn(
                          "border-b border-border/80 transition-colors bg-muted/15 hover:bg-muted/20",
                          isSelected && "bg-amber-500/5 dark:bg-amber-500/10",
                          isFetching && "opacity-45 pointer-events-none transition-opacity duration-200"
                        )}
                      >
                        <TableCell
                          colSpan={row.getVisibleCells().length}
                          className="p-0"
                        >
                          {renderSubRow(row.original)}
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-40 text-center text-muted-foreground"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    {emptyIcon || <AlertCircle className="h-7 w-7 text-muted-foreground/50" />}
                    <p className="text-sm font-medium">{emptyMessage}</p>
                    {((searchColumn && table.getColumn(searchColumn)?.getFilterValue()) || globalFilter) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (searchColumn) {
                            table.getColumn(searchColumn)?.setFilterValue("");
                          }
                          setGlobalFilter("");
                        }}
                        className="h-7 text-xs mt-1"
                      >
                        Reset search
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Bottom Pagination */}
        {enablePagination && (
          <DataTablePagination
            table={table}
            pageSizeOptions={pageSizeOptions}
            showSelectedCount={enableRowSelection}
            isFetching={isFetching}
          />
        )}
      </div>
    </div>
  );
}
