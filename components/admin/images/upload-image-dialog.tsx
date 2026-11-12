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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { UploadCloud, Loader2, Package } from "lucide-react";
import { ImageUploader, UploadedImage } from "@/components/ui/image-uploader";
import { assignNewProductImagesAction, ProductOption } from "@/actions/product-images";

interface UploadImageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: ProductOption[];
  preselectedProductId?: string;
}

export function UploadImageDialog({
  open,
  onOpenChange,
  products,
  preselectedProductId,
}: UploadImageDialogProps) {
  const queryClient = useQueryClient();
  const [selectedProductId, setSelectedProductId] = React.useState<string>(preselectedProductId || "");
  const [uploadedItems, setUploadedItems] = React.useState<UploadedImage[]>([]);
  const [makePrimary, setMakePrimary] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Update selectedProductId when preselectedProductId changes
  React.useEffect(() => {
    if (preselectedProductId) {
      setSelectedProductId(preselectedProductId);
    } else if (!selectedProductId && products.length > 0) {
      setSelectedProductId(products[0].id);
    }
  }, [preselectedProductId, products, selectedProductId]);

  const handleClose = () => {
    if (isSubmitting) return;
    setUploadedItems([]);
    setMakePrimary(false);
    onOpenChange(false);
  };

  const handleSave = async () => {
    if (!selectedProductId) {
      toast.error("Please select a target product");
      return;
    }

    const successfulUploads = uploadedItems.filter(
      (item) => item.status === "success" && (item.url || item.path)
    );

    if (successfulUploads.length === 0) {
      toast.error("Please upload at least one image before saving");
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedProduct = products.find((p) => p.id === selectedProductId);
      const res = await assignNewProductImagesAction({
        productId: selectedProductId,
        images: successfulUploads.map((item, idx) => ({
          storagePath: item.url || item.path || "",
          altText: item.altText || `${selectedProduct?.name || "Product"} photography`,
          isPrimary: makePrimary && idx === 0,
        })),
      });

      if (!res.success) {
        throw new Error(res.error || "Failed to assign images to product");
      }

      toast.success(
        `Added ${res.count} image${res.count > 1 ? "s" : ""} to ${selectedProduct?.name || "product"}`
      );
      await queryClient.invalidateQueries({ queryKey: ["admin", "product-images"] });
      handleClose();
    } catch (err: any) {
      console.error("Image assignment error:", err);
      toast.error(err?.message || "Failed to save image to product");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const targetFolder = `products/${selectedProduct?.slug || selectedProductId || "general"}`;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl shadow-2xl border border-border bg-card">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-border/80 bg-muted/20 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center">
              <UploadCloud className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Upload Product Media
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Upload high-resolution photography directly to ImageKit and assign to a catalog product
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pt-5 pb-8 space-y-5">
          {/* Product Selector */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5 text-amber-600" /> Target Catalog Product
            </Label>
            <Select
              value={selectedProductId}
              onValueChange={(val) => setSelectedProductId(val || "")}
              disabled={isSubmitting}
            >
              <SelectTrigger className="h-10 text-xs bg-background">
                <SelectValue placeholder="Choose a product to receive media..." />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.name} {p.name_bn ? `(${p.name_bn})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Images will be uploaded to ImageKit folder:{" "}
              <code className="text-amber-600 font-mono text-[11px] bg-amber-500/10 px-1 py-0.5 rounded">
                /{targetFolder}
              </code>
            </p>
          </div>

          {/* Primary Cover Checkbox */}
          <div className="flex items-center space-x-2 pt-1 pb-1">
            <Checkbox
              id="make-primary"
              checked={makePrimary}
              onCheckedChange={(checked) => setMakePrimary(Boolean(checked))}
              disabled={isSubmitting}
            />
            <Label
              htmlFor="make-primary"
              className="text-xs font-medium cursor-pointer text-foreground"
            >
              Set first uploaded image as primary cover for this product
            </Label>
          </div>

          {/* Image Uploader */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground">
              Photos & Media Files
            </Label>
            <ImageUploader
              value={uploadedItems}
              onChange={setUploadedItems}
              multiple={true}
              maxFiles={8}
              folder={targetFolder}
              showAltInput={true}
              allowGallery={true}
              disabled={isSubmitting || !selectedProductId}
              label="Drop images here or click to browse"
              description="Supports WebP, PNG, JPG up to 50MB. Uploads directly to ImageKit with live progress."
            />
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t border-border/80 bg-muted/20 shrink-0 flex items-center justify-between sm:justify-end gap-2">
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
            disabled={isSubmitting || uploadedItems.length === 0 || !selectedProductId}
            className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Saving Media...
              </>
            ) : (
              `Save ${uploadedItems.length > 0 ? `${uploadedItems.length} Photo${uploadedItems.length > 1 ? "s" : ""}` : "Media"} to Product`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
