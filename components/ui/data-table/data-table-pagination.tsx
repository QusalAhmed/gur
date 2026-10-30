"use client";

import * as React from "react";
import { Table } from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface DataTablePaginationProps<TData> {
  table: Table<TData>;
  pageSizeOptions?: number[];
  showSelectedCount?: boolean;
}

/**
 * Sliding window pagination algorithm used by top-tier SaaS platforms (Stripe, GitHub, Shopify).
 * Generates an array of page numbers and ellipsis separators based on current page and total pages.
 */
function getPaginationRange(
  currentPage: number,
  totalPages: number,
  siblingCount = 1
): (number | "ellipsis")[] {
  // If total pages is small, show all
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
  const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages);

  const shouldShowLeftDots = leftSiblingIndex > 2;
  const shouldShowRightDots = rightSiblingIndex < totalPages - 2;

  const firstPageIndex = 1;
  const lastPageIndex = totalPages;

  // Case 1: No left dots, but right dots needed
  if (!shouldShowLeftDots && shouldShowRightDots) {
    const leftItemCount = 3 + 2 * siblingCount;
    const leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1);
    return [...leftRange, "ellipsis", totalPages];
  }

  // Case 2: No right dots, but left dots needed
  if (shouldShowLeftDots && !shouldShowRightDots) {
    const rightItemCount = 3 + 2 * siblingCount;
    const rightRange = Array.from(
      { length: rightItemCount },
      (_, i) => totalPages - rightItemCount + i + 1
    );
    return [firstPageIndex, "ellipsis", ...rightRange];
  }

  // Case 3: Both left and right dots needed
  if (shouldShowLeftDots && shouldShowRightDots) {
    const middleRange = Array.from(
      { length: rightSiblingIndex - leftSiblingIndex + 1 },
      (_, i) => leftSiblingIndex + i
    );
    return [firstPageIndex, "ellipsis", ...middleRange, "ellipsis", lastPageIndex];
  }

  return Array.from({ length: totalPages }, (_, i) => i + 1);
}

export function DataTablePagination<TData>({
  table,
  pageSizeOptions = [10, 20, 30, 50],
  showSelectedCount = true,
}: DataTablePaginationProps<TData>) {
  const selectedCount = table.getFilteredSelectedRowModel().rows.length;
  // Use table.getRowCount() which handles server-side manual pagination rowCount option
  const rowCountFromTable = table.getRowCount();
  const totalCount =
    typeof rowCountFromTable === "number" && rowCountFromTable >= 0
      ? rowCountFromTable
      : table.getFilteredRowModel().rows.length;

  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const pageCount = Math.max(1, table.getPageCount());
  const currentPage = pageIndex + 1;

  const startRow = totalCount === 0 ? 0 : pageIndex * pageSize + 1;
  const endRow = Math.min((pageIndex + 1) * pageSize, totalCount);

  const paginationRange = React.useMemo(() => {
    return getPaginationRange(currentPage, pageCount, 1);
  }, [currentPage, pageCount]);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-3 py-3 border-t bg-card/60 text-xs text-muted-foreground select-none flex-wrap">
      {/* Left section: selection & records count */}
      <div className="flex items-center gap-2 flex-wrap">
        {showSelectedCount && (
          <span className="font-medium text-foreground">
            {selectedCount > 0 ? (
              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                {selectedCount} of {totalCount} row(s) selected
              </span>
            ) : (
              <span>{totalCount.toLocaleString()} total record(s)</span>
            )}
          </span>
        )}
        <span className="hidden md:inline-block text-muted-foreground/50">•</span>
        <span className="hidden md:inline-block">
          Showing <span className="font-medium text-foreground">{startRow}</span>–
          <span className="font-medium text-foreground">{endRow}</span> of{" "}
          <span className="font-medium text-foreground">{totalCount.toLocaleString()}</span>
        </span>
      </div>

      {/* Right section: page size + page numbers + navigation */}
      <div className="flex items-center gap-2 sm:gap-4 flex-wrap justify-end">
        {/* Rows per page selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Rows:</span>
          <Select
            value={`${pageSize}`}
            onValueChange={(val) => {
              table.setPageSize(Number(val));
            }}
          >
            <SelectTrigger className="h-8 w-[70px] text-xs bg-background">
              <SelectValue placeholder={`${pageSize}`} />
            </SelectTrigger>
            <SelectContent side="top">
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={`${size}`} className="text-xs">
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Compact page indicator on mobile */}
        <div className="flex items-center justify-center font-medium md:hidden min-w-[70px] text-xs">
          {currentPage} / {pageCount}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center space-x-1">
          {/* First Page */}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 hidden xl:flex bg-background hover:bg-muted"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            title="First page"
            aria-label="Go to first page"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>

          {/* Previous Page */}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 bg-background hover:bg-muted"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            title="Previous page"
            aria-label="Go to previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {/* Numbered Page Buttons (Desktop / Tablet) */}
          <div className="hidden md:flex items-center space-x-1">
            {paginationRange.map((item, index) => {
              if (item === "ellipsis") {
                return (
                  <div
                    key={`ellipsis-${index}`}
                    className="h-8 w-8 flex items-center justify-center text-muted-foreground/60 select-none"
                    aria-hidden="true"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </div>
                );
              }

              const isCurrent = item === currentPage;
              return (
                <Button
                  key={`page-${item}`}
                  variant={isCurrent ? "default" : "outline"}
                  size="icon"
                  className={cn(
                    "h-8 w-8 text-xs font-medium transition-colors",
                    isCurrent
                      ? "bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-xs"
                      : "bg-background hover:bg-muted text-foreground"
                  )}
                  onClick={() => table.setPageIndex(item - 1)}
                  aria-current={isCurrent ? "page" : undefined}
                  aria-label={`Go to page ${item}`}
                >
                  {item}
                </Button>
              );
            })}
          </div>

          {/* Next Page */}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 bg-background hover:bg-muted"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            title="Next page"
            aria-label="Go to next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          {/* Last Page */}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 hidden xl:flex bg-background hover:bg-muted"
            onClick={() => table.setPageIndex(pageCount - 1)}
            disabled={!table.getCanNextPage()}
            title="Last page"
            aria-label="Go to last page"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
