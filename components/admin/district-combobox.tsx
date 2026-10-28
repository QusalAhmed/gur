"use client";

import * as React from "react";
import { Check, ChevronsUpDown, MapPin, Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { DbGeoDistrict, fetchGeoDistricts, fallbackDistricts } from "@/lib/supabase";

export interface DistrictComboboxProps {
  id?: string;
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  divisionId?: number | null;
  divisionName?: string | null;
  districts?: DbGeoDistrict[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onAddCustomDistrict?: (name: string) => void;
}

export function DistrictCombobox({
  id,
  value = "",
  onChange,
  onBlur,
  divisionId,
  divisionName,
  districts: externalDistricts,
  placeholder = "Select district...",
  disabled = false,
  className,
  onAddCustomDistrict,
}: DistrictComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [loadedDistricts, setLoadedDistricts] = React.useState<DbGeoDistrict[]>(
    externalDistricts && externalDistricts.length > 0 ? externalDistricts : fallbackDistricts
  );
  const [isDbLoaded, setIsDbLoaded] = React.useState(false);

  // Sync external districts if provided
  React.useEffect(() => {
    if (externalDistricts && externalDistricts.length > 0) {
      setLoadedDistricts(externalDistricts);
    }
  }, [externalDistricts]);

  // If no external districts provided, fetch directly from Supabase table geo_districts
  React.useEffect(() => {
    if (!externalDistricts || externalDistricts.length === 0) {
      let active = true;
      fetchGeoDistricts().then((data) => {
        if (active && data && data.length > 0) {
          setLoadedDistricts(data);
          setIsDbLoaded(true);
        }
      });
      return () => {
        active = false;
      };
    }
  }, [externalDistricts]);

  // Filter districts based on division (if divisionId or divisionName is specified)
  const filteredDistricts = React.useMemo(() => {
    if (divisionId) {
      return loadedDistricts.filter((d) => d.division_id === divisionId);
    }
    return loadedDistricts;
  }, [loadedDistricts, divisionId]);

  // Find currently selected district object
  const selectedDistrict = React.useMemo(() => {
    if (!value) return null;
    return loadedDistricts.find(
      (d) => d.name.toLowerCase() === value.trim().toLowerCase()
    );
  }, [loadedDistricts, value]);

  // Handle selecting an item
  const handleSelect = (districtName: string) => {
    onChange?.(districtName);
    setOpen(false);
    setSearchQuery("");
  };

  // Handle adding custom district
  const handleAddCustom = (customName: string) => {
    const trimmed = customName.trim();
    if (!trimmed) return;
    onChange?.(trimmed);
    onAddCustomDistrict?.(trimmed);
    setOpen(false);
    setSearchQuery("");
  };

  // Determine if search query is a new custom district not currently in list
  const isQueryNew = React.useMemo(() => {
    if (!searchQuery.trim()) return false;
    const q = searchQuery.trim().toLowerCase();
    return !filteredDistricts.some(
      (d) =>
        d.name.toLowerCase() === q ||
        (d.name_bn && d.name_bn.toLowerCase() === q)
    );
  }, [searchQuery, filteredDistricts]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          onBlur={onBlur}
          className={cn(
            "w-full h-9 justify-between font-normal border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer hover:bg-muted/40",
            !value && "text-muted-foreground",
            className
          )}
        >
          <span className="flex items-center gap-1.5 truncate">
            <MapPin className="size-3.5 text-amber-600 shrink-0" />
            {selectedDistrict ? (
              <span className="truncate">
                <span className="font-medium text-foreground">{selectedDistrict.name}</span>
                {selectedDistrict.name_bn && (
                  <span className="ml-1 text-muted-foreground text-xs">
                    ({selectedDistrict.name_bn})
                  </span>
                )}
              </span>
            ) : value ? (
              <span className="truncate font-medium text-foreground">{value}</span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50 ml-2" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-[calc(100vw-2rem)] sm:w-80 p-0 shadow-lg border rounded-xl overflow-hidden"
      >
        <Command
          filter={(value, search) => {
            const normalizedSearch = search.toLowerCase().trim();
            if (value.toLowerCase().includes(normalizedSearch)) return 1;
            return 0;
          }}
          className="rounded-xl"
        >
          <CommandInput
            placeholder="Search district in English or বাংলা..."
            value={searchQuery}
            onValueChange={setSearchQuery}
            className="h-9 text-xs"
          />

          <CommandList className="max-h-60 overflow-y-auto p-1">
            <CommandEmpty className="p-3 text-center text-xs text-muted-foreground space-y-2">
              <p>No district matching &quot;{searchQuery}&quot;.</p>
              {searchQuery.trim() && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="w-full text-xs h-7"
                  onClick={() => handleAddCustom(searchQuery)}
                >
                  <Plus className="size-3 mr-1 text-amber-600" />
                  Use &quot;{searchQuery.trim()}&quot; as custom district
                </Button>
              )}
            </CommandEmpty>

            <CommandGroup
              heading={
                divisionName
                  ? `${divisionName} Division Districts (${filteredDistricts.length})`
                  : `Districts from geo_districts (${filteredDistricts.length})`
              }
            >
              {value && (
                <CommandItem
                  value="__clear_district_selection__"
                  onSelect={() => handleSelect("")}
                  className="flex items-center gap-2 py-1.5 px-2 text-xs rounded-lg cursor-pointer text-muted-foreground hover:text-foreground mb-1 border-b border-border/40"
                >
                  <Minus className="size-3" />
                  <span>Clear district selection</span>
                </CommandItem>
              )}
              {filteredDistricts.map((district) => {
                const isSelected =
                  value.toLowerCase() === district.name.toLowerCase();
                const searchableText = `${district.name} ${district.name_bn || ""}`;

                return (
                  <CommandItem
                    key={district.id}
                    value={searchableText}
                    data-checked={isSelected}
                    onSelect={() => handleSelect(district.name)}
                    className="flex items-center justify-between py-1.5 px-2 text-xs rounded-lg cursor-pointer hover:bg-muted/70 transition-colors"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className={cn("font-medium", isSelected ? "text-amber-700 dark:text-amber-300 font-semibold" : "text-foreground")}>
                        {district.name}
                      </span>
                      {district.name_bn && (
                        <span className="text-[11px] text-muted-foreground">
                          ({district.name_bn})
                        </span>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>

            {isQueryNew && searchQuery.trim() && (
              <>
                <CommandSeparator className="my-1" />
                <CommandGroup heading="Custom District">
                  <CommandItem
                    value={`custom-${searchQuery}`}
                    onSelect={() => handleAddCustom(searchQuery)}
                    className="flex items-center gap-2 py-1.5 px-2 text-xs text-amber-700 dark:text-amber-400 font-medium cursor-pointer"
                  >
                    <Plus className="size-3.5 shrink-0" />
                    <span>Add &quot;{searchQuery.trim()}&quot; as custom district</span>
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
