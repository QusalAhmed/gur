import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function FormFieldItem({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-1.5", className)} {...props} />;
}

export function FormFieldLabel({
  className,
  required,
  children,
  ...props
}: React.ComponentProps<typeof Label> & { required?: boolean }) {
  return (
    <Label
      className={cn(
        "text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5",
        className
      )}
      {...props}
    >
      {children}
      {required && <span className="text-destructive font-bold">*</span>}
    </Label>
  );
}

export function FormFieldDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-[11px] text-muted-foreground leading-normal", className)}
      {...props}
    />
  );
}

export function FormFieldError({
  field,
  errors: directErrors,
  className,
}: {
  field?: {
    state: {
      meta: {
        errors?: unknown[];
        isTouched?: boolean;
      };
    };
  };
  errors?: unknown[];
  className?: string;
}) {
  const errList = directErrors || field?.state?.meta?.errors;
  if (!errList || errList.length === 0) return null;

  const validErrors = errList.filter(Boolean);
  if (validErrors.length === 0) return null;

  const getErrorMessage = (err: unknown): string => {
    if (typeof err === "string") return err;
    if (
      typeof err === "object" &&
      err !== null &&
      "message" in err &&
      typeof (err as any).message === "string"
    ) {
      return (err as any).message;
    }
    return JSON.stringify(err);
  };

  const messages = Array.from(new Set(validErrors.map(getErrorMessage).filter(Boolean)));
  if (messages.length === 0) return null;

  return (
    <p
      role="alert"
      className={cn("text-xs font-medium text-rose-500 dark:text-rose-400 mt-1 flex items-center gap-1", className)}
    >
      <span className="shrink-0 text-rose-500 font-bold">⚠</span>
      <span>{messages.join(", ")}</span>
    </p>
  );
}
