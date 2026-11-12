"use client";

import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const ResponsiveDialogContext = React.createContext(false);

interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function ResponsiveDialog({
  open,
  onOpenChange,
  children,
}: ResponsiveDialogProps) {
  const isMobile = useIsMobile();

  return (
    <ResponsiveDialogContext.Provider value={isMobile}>
      {isMobile ? (
        <Sheet open={open} onOpenChange={onOpenChange}>
          {children}
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={onOpenChange}>
          {children}
        </Dialog>
      )}
    </ResponsiveDialogContext.Provider>
  );
}

export function ResponsiveDialogContent({
  className,
  mobileClassName,
  children,
}: {
  className?: string;
  mobileClassName?: string;
  children: React.ReactNode;
}) {
  const isMobile = React.useContext(ResponsiveDialogContext);

  if (isMobile) {
    return (
      <SheetContent
        side="bottom"
        className={cn(
          "max-h-[90dvh] overflow-y-auto rounded-t-2xl p-4 gap-4",
          mobileClassName
        )}
      >
        <div
          aria-hidden="true"
          className="mx-auto -mt-1 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/25"
        />
        {children}
      </SheetContent>
    );
  }

  return <DialogContent className={className}>{children}</DialogContent>;
}

export function ResponsiveDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const isMobile = React.useContext(ResponsiveDialogContext);
  return isMobile ? (
    <SheetHeader className={cn("p-0 pr-8 text-left gap-1.5", className)} {...props} />
  ) : (
    <DialogHeader className={className} {...props} />
  );
}

export function ResponsiveDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const isMobile = React.useContext(ResponsiveDialogContext);
  return isMobile ? (
    <SheetFooter
      className={cn(
        "-mx-4 -mb-4 mt-2 flex-col-reverse gap-2 border-t bg-muted/50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]",
        className
      )}
      {...props}
    />
  ) : (
    <DialogFooter className={className} {...props} />
  );
}

export function ResponsiveDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogTitle>) {
  const isMobile = React.useContext(ResponsiveDialogContext);
  return isMobile ? (
    <SheetTitle className={className} {...props} />
  ) : (
    <DialogTitle className={className} {...props} />
  );
}

export function ResponsiveDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogDescription>) {
  const isMobile = React.useContext(ResponsiveDialogContext);
  return isMobile ? (
    <SheetDescription className={className} {...props} />
  ) : (
    <DialogDescription className={className} {...props} />
  );
}
