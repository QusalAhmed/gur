"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Link2, Package, Image as ImageIcon } from "lucide-react";
import {
  linkImageKitFileToProductAction,
  ImageKitMediaItem,
  ProductOption,
} from "@/actions/product-images";

interface LinkImageDialogProps {
  image: ImageKitMediaItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: ProductOption[];
}

export function LinkImageDialog({
  image,
  open,
  onOpenChange,
  products,
}: LinkImageDialogProps) {
  const queryClient = useQueryClient();
  const [selectedProductId, setSelectedProductId] = React.useState<string>("");
  const [altText, setAltText] = React.useState("");
  const [isPrimary, setIsPrimary] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (image) {
      if (image.assignedProduct?.id) {
        setSelectedProductId(image.assignedProduct.id);
        setIsPrimary(image.assignedProduct.isPrimary);
      } else if (products.length > 0 && !selectedProductId) {
        setSelectedProductId(products[0].id);
      }
      setAltText(image.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "));
    }
  }, [image, products, selectedProductId]);

  const handleClose = () => {
    if (isSubmitting) return;
    onOpenChange(false);
  };

  const handleSave = async () => {
    if (!image || !selectedProductId) {
      toast.error("Please select a target product");
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedProduct = products.find((p) => p.id === selectedProductId);
      const res = await linkImageKitFileToProductAction({
        productId: selectedProductId,
        url: image.url,
        altText,
        isPrimary,
      });

      if (!res.success) {
        throw new Error(res.error || "Failed to link ImageKit photo to product");
      }

      toast.success(
        `Assigned "${image.name}" to ${selectedProduct?.name || "product"}`
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "product-images"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "imagekit-media"] }),
      ]);
      handleClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to link image");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!image) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] sm:max-w-md p-0 gap-0 overflow-hidden rounded-2xl shadow-2xl border border-border bg-card">
        <DialogHeader className="px-6 py-4 border-b border-border/80 bg-muted/20 text-left">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center">
              <Link2 className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-foreground">
                Assign ImageKit Photo to Product
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground truncate max-w-xs">
                {image.name}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 pb-7 space-y-4">
          {/* Image Thumbnail */}
          <div className="flex items-center gap-3 p-2.5 rounded-xl border border-border/80 bg-muted/20">
            <div className="h-16 w-16 rounded-lg bg-muted border border-border overflow-hidden shrink-0 flex items-center justify-center">
              {image.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={image.thumbnailUrl || image.url}
                  alt={image.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
              )}
            </div>
            <div className="min-w-0 flex-1 text-xs">
              <p className="font-semibold text-foreground truncate">{image.name}</p>
              <p className="text-[11px] text-muted-foreground truncate font-mono mt-0.5">
                {image.width && image.height ? `${image.width} × ${image.height} px` : "ImageKit CDN"}
              </p>
            </div>
          </div>

          {/* Product Select */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5 text-amber-600" /> Target Catalog Product
            </Label>
            <Select
              value={selectedProductId}
              onValueChange={(val) => setSelectedProductId(val || "")}
              disabled={isSubmitting}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Choose product..." />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.name} {p.name_bn ? `(${p.name_bn})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Alt Text */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">
              SEO Alt Text
            </Label>
            <Input
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              placeholder="e.g. Pure date palm molasses 1kg jar"
              className="text-xs h-9"
              disabled={isSubmitting}
            />
          </div>

          {/* Primary Cover Checkbox */}
          <div className="flex items-center space-x-2 pt-1">
            <Checkbox
              id="link-is-primary"
              checked={isPrimary}
              onCheckedChange={(checked) => setIsPrimary(Boolean(checked))}
              disabled={isSubmitting}
            />
            <Label
              htmlFor="link-is-primary"
              className="text-xs font-medium cursor-pointer text-foreground"
            >
              Set as primary cover for this product
            </Label>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border/80 bg-muted/20 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={isSubmitting}
            className="h-8 text-xs cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isSubmitting || !selectedProductId}
            className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Assigning...
              </>
            ) : (
              "Assign to Product"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

