"use client";

import * as React from "react";
import {
  Sparkles,
  UploadCloud,
  Image as ImageIcon,
  Trash2,
  RefreshCw,
  FolderTree,
  Tag,
  FileText,
  Globe,
  Save,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import {
  UiCategoryItem,
  createCategoryInDb,
  updateCategoryInDb,
  uploadCategoryImageToStorage,
  deleteCategoryImageFromStorage,
} from "@/lib/supabase";
import {
  categoryFormSchema,
  categoryNameSchema,
  categoryNameBnSchema,
  categorySlugSchema,
  categorySortOrderSchema,
  categoryDescriptionSchema,
  categoryDescriptionBnSchema,
  categorySeoTitleSchema,
  categorySeoDescriptionSchema,
  validateWithZod,
  CategoryFormValues,
} from "@/lib/validations/category";
import {
  FormFieldItem,
  FormFieldLabel,
  FormFieldError,
} from "@/components/ui/tanstack-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: UiCategoryItem | null;
  parentCategories: UiCategoryItem[];
  prefilledParentId?: string | null;
  onSuccess: (message: string) => void;
  onError: (error: string) => void;
}

export function CategoryFormDialog({
  open,
  onOpenChange,
  category,
  parentCategories,
  prefilledParentId,
  onSuccess,
  onError,
}: CategoryFormDialogProps) {
  const queryClient = useQueryClient();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const isEdit = Boolean(category?.id);
  const [isSlugManual, setIsSlugManual] = React.useState(Boolean(category?.slug));
  const [uploadingImage, setUploadingImage] = React.useState(false);

  // Filter out self from parent options to avoid circular parent loops
  const eligibleParents = parentCategories.filter((c) => c.id !== category?.id);

  // Mutation for Database Save / Update
  const saveMutation = useMutation({
    mutationFn: async (values: CategoryFormValues) => {
      const payload = {
        name: values.name,
        nameBn: values.nameBn || undefined,
        slug: values.slug,
        parent_id: values.parentId,
        description: values.description || undefined,
        descriptionBn: values.descriptionBn || undefined,
        image_path: values.imagePath || null,
        sort_order: values.sortOrder,
        is_active: values.isActive,
        seo_title: values.seoTitle || undefined,
        seo_description: values.seoDescription || undefined,
      };

      if (isEdit && category) {
        return await updateCategoryInDb(category.id, {
          name: payload.name,
          name_bn: payload.nameBn || null,
          slug: payload.slug,
          parent_id: payload.parent_id,
          description: payload.description || null,
          description_bn: payload.descriptionBn || null,
          image_path: payload.image_path,
          sort_order: payload.sort_order,
          is_active: payload.is_active,
          seo_title: payload.seo_title || null,
          seo_description: payload.seo_description || null,
        });
      } else {
        return await createCategoryInDb(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "categories-list"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      onSuccess(
        isEdit
          ? `Category updated successfully.`
          : `Category created successfully.`
      );
      onOpenChange(false);
    },
    onError: (err: any) => {
      onError(err?.message || "Failed to save category.");
    },
  });

  // TanStack Form Instance
  const form = useForm({
    defaultValues: {
      name: category?.name || "",
      nameBn: category?.nameBn || "",
      slug: category?.slug || "",
      parentId: (category?.parentId || prefilledParentId || "none") as string,
      sortOrder: category?.displayOrder ?? (parentCategories.length + 1),
      isActive: category?.isActive ?? true,
      imagePath: (category?.imagePath || null) as string | null,
      imageUrl: (category?.imageUrl || null) as string | null,
      description: category?.description || "",
      descriptionBn: category?.descriptionBn || "",
      seoTitle: category?.seoTitle || "",
      seoDescription: category?.seoDescription || "",
    },
    onSubmit: async ({ value }) => {
      const validation = categoryFormSchema.safeParse(value);
      if (!validation.success) {
        const firstError = validation.error.issues[0]?.message || "Validation failed.";
        onError(firstError);
        return;
      }
      saveMutation.mutate(validation.data);
    },
    onSubmitInvalid: ({ formApi }) => {
      const fieldEntries = Object.entries(formApi.state.fieldMeta);
      const invalidEntry = fieldEntries.find(
        ([, meta]) => meta?.errors && meta.errors.length > 0
      );
      const firstError = invalidEntry?.[1]?.errors?.[0];
      const errorMsg =
        typeof firstError === "string"
          ? firstError
          : (firstError as any)?.message || "Please fix validation errors before submitting.";
      onError(errorMsg);
    },
  });

  // Image Upload Handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      onError(`"${file.name}" exceeds the 5MB file limit.`);
      return;
    }

    setUploadingImage(true);
    try {
      const { path, publicUrl } = await uploadCategoryImageToStorage(
        file,
        category?.id || "new"
      );
      form.setFieldValue("imagePath", path);
      form.setFieldValue("imageUrl", publicUrl);
    } catch (err: any) {
      console.error("Category image upload error:", err);
      onError(err?.message || "Failed to upload image to Supabase Storage.");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveImage = async () => {
    const currentPath = form.getFieldValue("imagePath");
    if (currentPath) {
      deleteCategoryImageFromStorage(currentPath);
    }
    form.setFieldValue("imagePath", null);
    form.setFieldValue("imageUrl", null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-2xl md:max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl shadow-2xl border border-border bg-card">
        {/* Fixed Header */}
        <DialogHeader className="px-6 py-4 border-b border-border/80 shrink-0 pr-12 text-left bg-muted/10">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <FolderTree className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-bold text-foreground truncate">
                {isEdit ? `Edit Category: ${category?.name}` : "Create New Category"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground truncate">
                Powered by TanStack Form & Zod schema validation
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* TanStack Form Wrapper */}
        <form
          id="category-form"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="flex-1 min-h-0 flex flex-col overflow-hidden"
        >
          {/* Scrollable Single Page Form Body */}
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-6">
            {/* ── Section 1: Basic Information & Hierarchy ── */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground tracking-wide uppercase">
                <Tag className="h-3.5 w-3.5 text-amber-600" />
                <span>General Information</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <form.Field
                  name="name"
                  validators={{
                    onChange: validateWithZod(categoryNameSchema),
                    onBlur: validateWithZod(categoryNameSchema),
                  }}
                >
                  {(field) => (
                    <FormFieldItem>
                      <FormFieldLabel required htmlFor="category_name">
                        Category Name (English)
                      </FormFieldLabel>
                      <Input
                        id="category_name"
                        placeholder="e.g. Pure Date Palm Gur"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => {
                          const val = e.target.value;
                          field.handleChange(val);
                          if (!isSlugManual && val.trim()) {
                            const gen = val
                              .toLowerCase()
                              .replace(/[^a-z0-9\s-]/g, "")
                              .trim()
                              .replace(/\s+/g, "-");
                            form.setFieldValue("slug", gen);
                            form.validateField("slug", "change");
                          }
                        }}
                        className="h-9 text-xs"
                      />
                      <FormFieldError field={field} />
                    </FormFieldItem>
                  )}
                </form.Field>

                <form.Field
                  name="nameBn"
                  validators={{
                    onChange: validateWithZod(categoryNameBnSchema),
                    onBlur: validateWithZod(categoryNameBnSchema),
                  }}
                >
                  {(field) => (
                    <FormFieldItem>
                      <FormFieldLabel htmlFor="category_name_bn">
                        Category Name (Bangla / বাংলা)
                      </FormFieldLabel>
                      <Input
                        id="category_name_bn"
                        placeholder="e.g. খাঁটি খেজুরের গুড়"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        className="h-9 text-xs font-bangla"
                      />
                      <FormFieldError field={field} />
                    </FormFieldItem>
                  )}
                </form.Field>
              </div>

              <form.Field
                name="slug"
                validators={{
                  onChange: validateWithZod(categorySlugSchema),
                  onBlur: validateWithZod(categorySlugSchema),
                }}
              >
                {(field) => (
                  <FormFieldItem>
                    <div className="flex items-center justify-between">
                      <FormFieldLabel required htmlFor="category_slug">
                        URL Slug
                      </FormFieldLabel>
                      <button
                        type="button"
                        onClick={() => {
                          setIsSlugManual(false);
                          const nameVal = form.getFieldValue("name");
                          const generated = nameVal
                            .toLowerCase()
                            .replace(/[^a-z0-9\s-]/g, "")
                            .trim()
                            .replace(/\s+/g, "-");
                          field.handleChange(generated);
                          form.validateField("slug", "change");
                        }}
                        className="text-[11px] text-amber-600 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Sparkles className="h-3 w-3" /> Auto-generate
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground px-2.5 py-1.5 bg-muted/60 border border-border rounded-md select-none shrink-0 font-mono">
                        /category/
                      </span>
                      <Input
                        id="category_slug"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => {
                          setIsSlugManual(true);
                          field.handleChange(
                            e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                          );
                        }}
                        placeholder="pure-date-palm-gur"
                        className="h-9 text-xs font-mono flex-1 min-w-0"
                      />
                    </div>
                    <FormFieldError field={field} />
                  </FormFieldItem>
                )}
              </form.Field>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <form.Field name="parentId">
                  {(field) => (
                    <FormFieldItem>
                      <FormFieldLabel htmlFor="category_parent">Parent Category</FormFieldLabel>
                      <Select
                        value={field.state.value || "none"}
                        onValueChange={(val) => field.handleChange(val || "none")}
                      >
                        <SelectTrigger id="category_parent" className="w-full h-9 text-xs">
                          <SelectValue placeholder="Top Level Category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None (Top Level)</SelectItem>
                          {eligibleParents.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name} {c.nameBn ? `(${c.nameBn})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormFieldError field={field} />
                    </FormFieldItem>
                  )}
                </form.Field>

                <form.Field
                  name="sortOrder"
                  validators={{
                    onChange: validateWithZod(categorySortOrderSchema),
                    onBlur: validateWithZod(categorySortOrderSchema),
                  }}
                >
                  {(field) => (
                    <FormFieldItem>
                      <FormFieldLabel htmlFor="category_sort_order">Display Order #</FormFieldLabel>
                      <Input
                        id="category_sort_order"
                        type="number"
                        min="0"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(parseInt(e.target.value) || 0)}
                        className="h-9 text-xs"
                      />
                      <FormFieldError field={field} />
                    </FormFieldItem>
                  )}
                </form.Field>

                <form.Field name="isActive">
                  {(field) => (
                    <FormFieldItem>
                      <FormFieldLabel htmlFor="category_status">Catalog Status</FormFieldLabel>
                      <Select
                        value={field.state.value ? "active" : "draft"}
                        onValueChange={(val) => field.handleChange(val === "active")}
                      >
                        <SelectTrigger id="category_status" className="w-full h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active (Visible)</SelectItem>
                          <SelectItem value="draft">Draft (Hidden)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormFieldError field={field} />
                    </FormFieldItem>
                  )}
                </form.Field>
              </div>
            </div>

            {/* ── Section 2: Category Banner & Thumbnail ── */}
            <div className="space-y-3 pt-4 border-t border-border/80">
              <div className="flex items-center justify-between text-xs font-bold text-foreground tracking-wide uppercase">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-3.5 w-3.5 text-amber-600" />
                  <span>Media & Banner Image</span>
                </div>
                <span className="text-[11px] text-muted-foreground font-normal lowercase">
                  supabase: catalog-images
                </span>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={handleImageUpload}
                className="hidden"
              />

              <form.Subscribe selector={(state) => [state.values.imageUrl, state.values.imagePath]}>
                {([currentImageUrl, currentImagePath]) =>
                  currentImageUrl ? (
                    <div className="rounded-xl border border-border p-3.5 bg-muted/20 flex flex-col sm:flex-row items-center gap-4">
                      <div className="w-full sm:w-44 h-28 rounded-lg overflow-hidden bg-muted border border-border shrink-0 flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={currentImageUrl as string}
                          alt={form.getFieldValue("name") || "Category image"}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 space-y-2 text-center sm:text-left min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">
                          {((currentImagePath as string) || "").split("/").pop() || "Category Banner"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Public asset stored in Supabase Storage. Used on catalog badges and navigation tiles.
                        </p>
                        <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingImage}
                            className="h-7 text-xs cursor-pointer"
                          >
                            <UploadCloud className="h-3.5 w-3.5 mr-1" />
                            {uploadingImage ? "Uploading..." : "Change Image"}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleRemoveImage}
                            className="h-7 text-xs text-destructive hover:bg-destructive/10 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-border hover:border-amber-500/60 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-muted/15 hover:bg-muted/30"
                    >
                      <div className="h-10 w-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-2 text-amber-600">
                        <UploadCloud className="h-5 w-5" />
                      </div>
                      <p className="text-xs font-semibold text-foreground">
                        Upload Category Banner / Thumbnail
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 max-w-sm">
                        Stored in Supabase Storage <code className="text-amber-600">catalog-images</code>{" "}
                        bucket. Supports JPEG, PNG, WebP up to 5MB.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-3 h-7 text-xs pointer-events-none"
                        disabled={uploadingImage}
                      >
                        {uploadingImage ? "Uploading..." : "Choose File"}
                      </Button>
                    </div>
                  )
                }
              </form.Subscribe>
            </div>

            {/* ── Section 3: Bilingual Descriptions ── */}
            <div className="space-y-4 pt-4 border-t border-border/80">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground tracking-wide uppercase">
                <FileText className="h-3.5 w-3.5 text-amber-600" />
                <span>Catalog Descriptions</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <form.Field
                  name="description"
                  validators={{
                    onChange: validateWithZod(categoryDescriptionSchema),
                    onBlur: validateWithZod(categoryDescriptionSchema),
                  }}
                >
                  {(field) => (
                    <FormFieldItem>
                      <FormFieldLabel htmlFor="category_desc_en">Description (English)</FormFieldLabel>
                      <Textarea
                        id="category_desc_en"
                        rows={3}
                        placeholder="Category overview for shoppers and catalog pages..."
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        className="text-xs resize-none"
                      />
                      <FormFieldError field={field} />
                    </FormFieldItem>
                  )}
                </form.Field>

                <form.Field
                  name="descriptionBn"
                  validators={{
                    onChange: validateWithZod(categoryDescriptionBnSchema),
                    onBlur: validateWithZod(categoryDescriptionBnSchema),
                  }}
                >
                  {(field) => (
                    <FormFieldItem>
                      <FormFieldLabel htmlFor="category_desc_bn">
                        Description (Bangla / বাংলা)
                      </FormFieldLabel>
                      <Textarea
                        id="category_desc_bn"
                        rows={3}
                        placeholder="বিবরণ..."
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        className="text-xs font-bangla resize-none"
                      />
                      <FormFieldError field={field} />
                    </FormFieldItem>
                  )}
                </form.Field>
              </div>
            </div>

            {/* ── Section 4: Search Engine Optimization (SEO) ── */}
            <div className="space-y-4 pt-4 border-t border-border/80">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground tracking-wide uppercase">
                <Globe className="h-3.5 w-3.5 text-amber-600" />
                <span>Search Engine Optimization (SEO)</span>
              </div>

              <form.Field
                name="seoTitle"
                validators={{
                  onChange: validateWithZod(categorySeoTitleSchema),
                  onBlur: validateWithZod(categorySeoTitleSchema),
                }}
              >
                {(field) => (
                  <FormFieldItem>
                    <FormFieldLabel htmlFor="category_seo_title">SEO Meta Title</FormFieldLabel>
                    <Input
                      id="category_seo_title"
                      placeholder={
                        form.getFieldValue("name")
                          ? `${form.getFieldValue("name")} | Gur Molasses Bangladesh`
                          : "Custom SEO Meta Title"
                      }
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      className="h-9 text-xs"
                    />
                    <FormFieldError field={field} />
                  </FormFieldItem>
                )}
              </form.Field>

              <form.Field
                name="seoDescription"
                validators={{
                  onChange: validateWithZod(categorySeoDescriptionSchema),
                  onBlur: validateWithZod(categorySeoDescriptionSchema),
                }}
              >
                {(field) => (
                  <FormFieldItem>
                    <FormFieldLabel htmlFor="category_seo_desc">SEO Meta Description</FormFieldLabel>
                    <Textarea
                      id="category_seo_desc"
                      rows={2}
                      placeholder="Brief summary for search engine snippet..."
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      className="text-xs resize-none"
                    />
                    <FormFieldError field={field} />
                  </FormFieldItem>
                )}
              </form.Field>
            </div>
          </div>

          {/* Fixed Footer */}
          <DialogFooter className="px-6 py-4 border-t border-border/80 bg-muted/30 shrink-0 flex flex-row items-center justify-between gap-3">
            <div className="text-[11px] text-muted-foreground hidden sm:block">
              <span className="text-destructive font-bold">*</span> Required fields
            </div>
            <div className="flex items-center gap-2.5 ml-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-8.5 px-4 text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <form.Subscribe selector={(state) => [state.isSubmitting]}>
                {([isSubmitting]) => (
                  <Button
                    type="submit"
                    size="sm"
                    disabled={saveMutation.isPending || isSubmitting}
                    className="bg-amber-600 hover:bg-amber-700 text-white h-8.5 px-4 text-xs cursor-pointer font-medium shadow-sm"
                  >
                    {saveMutation.isPending || isSubmitting ? (
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    {isEdit ? "Update Category" : "Save Category"}
                  </Button>
                )}
              </form.Subscribe>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
