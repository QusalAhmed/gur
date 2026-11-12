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
import { toast } from "sonner";
import { Loader2, Edit3, Image as ImageIcon } from "lucide-react";
import { updateProductImageAltTextAction, ProductImageItem } from "@/actions/product-images";

interface EditAltDialogProps {
  image: ProductImageItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditAltDialog({ image, open, onOpenChange }: EditAltDialogProps) {
  const queryClient = useQueryClient();
  const [altText, setAltText] = React.useState("");
  const [altTextBn, setAltTextBn] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (image) {
      setAltText(image.alt_text || "");
      setAltTextBn(image.alt_text_bn || "");
    }
  }, [image]);

  const handleClose = () => {
    if (isSubmitting) return;
    onOpenChange(false);
  };

  const handleSave = async () => {
    if (!image) return;

    setIsSubmitting(true);
    try {
      const res = await updateProductImageAltTextAction({
        imageId: image.id,
        altText,
        altTextBn,
      });

      if (!res.success) {
        throw new Error(res.error || "Failed to update alt text");
      }

      toast.success("Updated image alt text");
      await queryClient.invalidateQueries({ queryKey: ["admin", "product-images"] });
      handleClose();
    } catch (err: any) {
      toast.error(err?.message || "Error updating alt text");
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
              <Edit3 className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-foreground">
                Edit Image Alt Text & SEO
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {image.product?.name || "Product Media"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 pb-7 space-y-4">
          {/* Image Thumbnail Preview */}
          <div className="flex items-center gap-3 p-2.5 rounded-xl border border-border/80 bg-muted/20">
            <div className="h-14 w-14 rounded-lg bg-muted border border-border overflow-hidden shrink-0 flex items-center justify-center">
              {image.public_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={image.public_url}
                  alt={image.alt_text || "Product image"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
              )}
            </div>
            <div className="min-w-0 flex-1 text-xs">
              <p className="font-semibold text-foreground truncate">
                {image.product?.name || "Unassigned"}
              </p>
              <p className="text-[11px] text-muted-foreground truncate font-mono mt-0.5">
                {image.storage_path.split("/").pop()}
              </p>
            </div>
          </div>

          {/* English Alt Text */}
          <div className="space-y-1.5">
            <Label htmlFor="alt-en" className="text-xs font-semibold text-foreground">
              English Alt Text (Search & Screen Readers)
            </Label>
            <Input
              id="alt-en"
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              placeholder="e.g. Blackstrap Molasses 200L Steel Drum packaging"
              className="text-xs h-9"
              disabled={isSubmitting}
            />
          </div>

          {/* Bengali Alt Text */}
          <div className="space-y-1.5">
            <Label htmlFor="alt-bn" className="text-xs font-semibold text-foreground">
              Bengali Alt Text (বাংলা বিবরণ)
            </Label>
            <Input
              id="alt-bn"
              value={altTextBn}
              onChange={(e) => setAltTextBn(e.target.value)}
              placeholder="e.g. খেজুরের খাঁটি ঝোলা গুড় পাত্র"
              className="text-xs h-9"
              disabled={isSubmitting}
            />
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
            disabled={isSubmitting}
            className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

