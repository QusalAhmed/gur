import { z } from "zod";

/**
 * Category Name (English): Required, 2 to 100 characters, trimmed.
 */
export const categoryNameSchema = z
  .string()
  .transform((v) => (v || "").trim())
  .pipe(
    z
      .string()
      .min(2, "Category name must be at least 2 characters")
      .max(100, "Category name must not exceed 100 characters")
  );

/**
 * Category Name (Bangla): Optional, trimmed, max 100 characters.
 */
export const categoryNameBnSchema = z
  .string()
  .transform((v) => (v || "").trim())
  .pipe(z.string().max(100, "Bangla name must not exceed 100 characters"))
  .optional()
  .default("");

/**
 * URL Slug: Required, lowercase alphanumeric with hyphens, 2 to 100 characters.
 */
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const categorySlugSchema = z
  .string()
  .transform((v) => (v || "").toLowerCase().trim())
  .pipe(
    z
      .string()
      .min(2, "Slug must be at least 2 characters")
      .max(100, "Slug must not exceed 100 characters")
      .regex(
        SLUG_REGEX,
        "Slug must contain only lowercase letters, numbers, and hyphens (e.g. pure-date-palm-gur)"
      )
  );

/**
 * Parent Category ID: UUID or null / 'none'.
 */
export const categoryParentIdSchema = z
  .string()
  .nullable()
  .optional()
  .transform((v) => (!v || v === "none" ? null : v));

/**
 * Sort / Display Order: Non-negative integer.
 */
export const categorySortOrderSchema = z.coerce
  .number({
    message: "Display order must be a valid number",
  })
  .int("Display order must be an integer")
  .min(0, "Display order cannot be negative")
  .default(0);

/**
 * Status (Active / Draft): Boolean.
 */
export const categoryIsActiveSchema = z.boolean().default(true);

/**
 * Descriptions (English & Bangla): Optional text up to 1000 characters.
 */
export const categoryDescriptionSchema = z
  .string()
  .transform((v) => (v || "").trim())
  .pipe(z.string().max(1000, "Description must not exceed 1000 characters"))
  .optional()
  .default("");

export const categoryDescriptionBnSchema = z
  .string()
  .transform((v) => (v || "").trim())
  .pipe(z.string().max(1000, "Bangla description must not exceed 1000 characters"))
  .optional()
  .default("");

/**
 * SEO Meta Title & Description:
 */
export const categorySeoTitleSchema = z
  .string()
  .transform((v) => (v || "").trim())
  .pipe(z.string().max(120, "SEO Title must not exceed 120 characters"))
  .optional()
  .default("");

export const categorySeoDescriptionSchema = z
  .string()
  .transform((v) => (v || "").trim())
  .pipe(z.string().max(300, "SEO Meta Description must not exceed 300 characters"))
  .optional()
  .default("");

/**
 * Comprehensive Category Form Schema
 */
export const categoryFormSchema = z.object({
  name: categoryNameSchema,
  nameBn: categoryNameBnSchema,
  slug: categorySlugSchema,
  parentId: categoryParentIdSchema,
  sortOrder: categorySortOrderSchema,
  isActive: categoryIsActiveSchema,
  imagePath: z.string().nullable().optional().default(null),
  imageUrl: z.string().nullable().optional().default(null),
  description: categoryDescriptionSchema,
  descriptionBn: categoryDescriptionBnSchema,
  seoTitle: categorySeoTitleSchema,
  seoDescription: categorySeoDescriptionSchema,
});

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;

/**
 * TanStack Form Validator Adapter Helper:
 * Wraps any Zod schema for TanStack Form field validators (onChange, onBlur).
 * Returns undefined if valid, or the first error message string if invalid.
 */
export function validateWithZod<T>(schema: z.ZodType<T>) {
  return ({ value }: { value: unknown }): string | undefined => {
    const result = schema.safeParse(value);
    if (!result.success) {
      return result.error.issues[0]?.message;
    }
    return undefined;
  };
}
