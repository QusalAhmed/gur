"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  animate,
  motion,
  useDragControls,
  useMotionValue,
  useReducedMotion,
  type DragControls,
  type PanInfo,
} from "motion/react";
import { XIcon } from "lucide-react";

import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetClose,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export type ResponsiveDialogSize = "sm" | "md" | "lg" | "xl" | "2xl" | "full";

const DESKTOP_SIZE_CLASSES: Record<ResponsiveDialogSize, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-2xl",
  "2xl": "sm:max-w-4xl",
  full: "w-[95vw] sm:max-w-[95vw] h-[90dvh] max-h-[90dvh]",
};

interface ResponsiveDialogContextValue {
  isMobile: boolean;
  isOpen?: boolean;
  dismissible: boolean;
  requestClose: () => void;
  dragControls: DragControls | null;
  contentPaddingMode: "default" | "none" | "custom";
  setContentPaddingMode: (mode: "default" | "none" | "custom") => void;
}

const ResponsiveDialogContext =
  React.createContext<ResponsiveDialogContextValue>({
    isMobile: false,
    isOpen: undefined,
    dismissible: true,
    requestClose: () => {},
    dragControls: null,
    contentPaddingMode: "default",
    setContentPaddingMode: () => {},
  });

export interface ResponsiveDialogProps
  extends Omit<DialogPrimitive.Root.Props, "disablePointerDismissal"> {
  /**
   * Whether the dialog/drawer can be dismissed by clicking the backdrop,
   * pressing Escape, or swiping down on mobile. Defaults to `true`.
   */
  dismissible?: boolean;
}

export function ResponsiveDialog({
  open,
  defaultOpen,
  onOpenChange,
  dismissible = true,
  children,
  ...props
}: ResponsiveDialogProps) {
  const isMobile = useIsMobile();
  const actionsRef = React.useRef<DialogPrimitive.Root.Actions | null>(null);
  const dragControls = useDragControls();
  const [contentPaddingMode, setContentPaddingMode] = React.useState<
    "default" | "none" | "custom"
  >("default");

  const handleOpenChange = React.useCallback(
    (
      nextOpen: boolean,
      eventDetails: DialogPrimitive.Root.ChangeEventDetails
    ) => {
      if (
        !nextOpen &&
        !dismissible &&
        (eventDetails.reason === "escape-key" ||
          eventDetails.reason === "outside-press")
      ) {
        eventDetails.cancel();
        return;
      }
      onOpenChange?.(nextOpen, eventDetails);
    },
    [dismissible, onOpenChange]
  );

  const requestClose = React.useCallback(() => {
    actionsRef.current?.close();
  }, []);

  const contextValue = React.useMemo<ResponsiveDialogContextValue>(
    () => ({
      isMobile,
      isOpen: open,
      dismissible,
      requestClose,
      dragControls,
      contentPaddingMode,
      setContentPaddingMode,
    }),
    [isMobile, open, dismissible, requestClose, dragControls, contentPaddingMode]
  );

  return (
    <ResponsiveDialogContext.Provider value={contextValue}>
      {isMobile ? (
        <Sheet
          open={open}
          defaultOpen={defaultOpen}
          onOpenChange={handleOpenChange}
          disablePointerDismissal={!dismissible}
          actionsRef={actionsRef}
          {...props}
        >
          {children}
        </Sheet>
      ) : (
        <Dialog
          open={open}
          defaultOpen={defaultOpen}
          onOpenChange={handleOpenChange}
          disablePointerDismissal={!dismissible}
          actionsRef={actionsRef}
          {...props}
        >
          {children}
        </Dialog>
      )}
    </ResponsiveDialogContext.Provider>
  );
}

export function ResponsiveDialogTrigger(
  props: React.ComponentProps<typeof DialogTrigger>
) {
  const { isMobile } = React.useContext(ResponsiveDialogContext);
  return isMobile ? <SheetTrigger {...props} /> : <DialogTrigger {...props} />;
}

export function ResponsiveDialogClose(
  props: React.ComponentProps<typeof DialogClose>
) {
  const { isMobile } = React.useContext(ResponsiveDialogContext);
  return isMobile ? <SheetClose {...props} /> : <DialogClose {...props} />;
}

function extractZIndexClass(className?: string): string | undefined {
  if (!className) return undefined;
  const matches = className.match(/\bz-(?:\[[^\]]+\]|\d+)\b/g);
  return matches?.[matches.length - 1];
}

function extractPaddingClasses(className?: string): string {
  if (!className) return "";
  return className
    .split(/\s+/)
    .filter((cls) => /^(?:[a-z-]+:)*(?:p|px|py|pt|pb|pl|pr)-/.test(cls))
    .join(" ");
}

function extractGapClasses(className?: string): string {
  if (!className) return "";
  return className
    .split(/\s+/)
    .filter((cls) => /^(?:[a-z-]+:)*gap(?:-[xy])?-/.test(cls))
    .join(" ");
}

function stripPaddingAndGapClasses(className?: string): string {
  if (!className) return "";
  return className
    .split(/\s+/)
    .filter(
      (cls) =>
        !/^(?:[a-z-]+:)*(?:p|px|py|pt|pb|pl|pr|gap(?:-[xy])?)-/.test(cls)
    )
    .join(" ");
}

export interface ResponsiveDialogContentProps
  extends Omit<DialogPrimitive.Popup.Props, "className"> {
  className?: string;
  size?: ResponsiveDialogSize;
  mobileClassName?: string;
  overlayClassName?: string;
  showCloseButton?: boolean;
}

export function ResponsiveDialogContent({
  size,
  className,
  mobileClassName,
  overlayClassName,
  showCloseButton = true,
  children,
  ...props
}: ResponsiveDialogContentProps) {
  const {
    isMobile,
    isOpen,
    dismissible,
    requestClose,
    dragControls,
    setContentPaddingMode,
  } = React.useContext(ResponsiveDialogContext);
  const prefersReducedMotion = useReducedMotion();
  const y = useMotionValue(0);
  const [closeAttempt, setCloseAttempt] = React.useState(0);

  const hasZeroPadding =
    typeof className === "string" && /\bp-0\b/.test(className);
  const paddingClasses = extractPaddingClasses(className);
  const hasCustomPadding = Boolean(paddingClasses);

  React.useEffect(() => {
    setContentPaddingMode(
      hasZeroPadding ? "none" : hasCustomPadding ? "custom" : "default"
    );
  }, [hasZeroPadding, hasCustomPadding, setContentPaddingMode]);

  React.useEffect(() => {
    if (isMobile) {
      y.set(0);
    }
  }, [isMobile, isOpen, y]);

  React.useEffect(() => {
    if (closeAttempt > 0 && isOpen === true) {
      animate(y, 0, {
        type: "spring",
        stiffness: 500,
        damping: 38,
        duration: prefersReducedMotion ? 0 : undefined,
      });
    }
  }, [closeAttempt, isOpen, prefersReducedMotion, y]);

  const handleDragEnd = React.useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (dismissible && (info.offset.y > 90 || info.velocity.y > 450)) {
        setCloseAttempt((c) => c + 1);
        requestClose();
        return;
      }

      animate(y, 0, {
        type: "spring",
        stiffness: 500,
        damping: 38,
        duration: prefersReducedMotion ? 0 : undefined,
      });
    },
    [dismissible, prefersReducedMotion, requestClose, y]
  );

  if (isMobile) {
    const zClass =
      extractZIndexClass(mobileClassName) ??
      extractZIndexClass(className) ??
      "z-50";
    const gapClasses = extractGapClasses(className);
    const outerClassOverrides = stripPaddingAndGapClasses(className);
    const isManagedFlexLayout =
      typeof className === "string" &&
      (className.includes("overflow-hidden") ||
        (className.includes("flex-col") && hasZeroPadding));

    return (
      <SheetPortal>
        <SheetOverlay className={cn(zClass, overlayClassName)} />
        <DialogPrimitive.Popup
          data-slot="responsive-dialog-content"
          data-side="bottom"
          className={cn(
            "fixed inset-x-0 bottom-0 flex flex-col outline-none transition duration-200 ease-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:translate-y-8 data-starting-style:translate-y-8 motion-reduce:transition-none motion-reduce:data-ending-style:translate-y-0 motion-reduce:data-starting-style:translate-y-0",
            zClass
          )}
          {...props}
        >
          <motion.div
            drag={dismissible ? "y" : false}
            dragControls={dragControls ?? undefined}
            dragListener={false}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0.03, bottom: 0.45 }}
            onDragEnd={handleDragEnd}
            style={{ y }}
            className={cn(
              outerClassOverrides,
              "relative flex w-full sm:w-full max-w-none sm:max-w-none md:max-w-none max-h-[90dvh] flex-col overflow-hidden rounded-t-2xl rounded-b-none border-t border-x-0 border-b-0 border-border bg-popover text-sm text-popover-foreground shadow-2xl ring-1 ring-foreground/10",
              mobileClassName
            )}
          >
            {/* Pinned Drag Handle Bar */}
            <div
              onPointerDown={(e) => {
                if (dismissible) dragControls?.start(e);
              }}
              className={cn(
                "flex w-full shrink-0 touch-none select-none items-center justify-center pt-2.5 pb-1.5",
                dismissible && "cursor-grab active:cursor-grabbing"
              )}
              aria-hidden="true"
            >
              <div className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
            </div>

            {showCloseButton && (
              <DialogPrimitive.Close
                data-slot="responsive-dialog-close"
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Close"
                    className="absolute top-1.5 right-1.5 z-20 size-11 rounded-full text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  />
                }
              >
                <XIcon className="size-4" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            )}

            {/* Scrollable or Managed Flex Body */}
            <div
              className={cn(
                "flex-1 min-h-0 flex flex-col",
                isManagedFlexLayout
                  ? "overflow-hidden"
                  : "overflow-y-auto overscroll-contain",
                gapClasses || "gap-4",
                hasCustomPadding
                  ? cn(
                      paddingClasses,
                      !hasZeroPadding &&
                        "pb-[max(1rem,env(safe-area-inset-bottom))]"
                    )
                  : "px-4 pt-1 pb-[max(1rem,env(safe-area-inset-bottom))]"
              )}
            >
              {children}
            </div>
          </motion.div>
        </DialogPrimitive.Popup>
      </SheetPortal>
    );
  }

  return (
    <DialogContent
      className={cn(
        size ? DESKTOP_SIZE_CLASSES[size] : undefined,
        className
      )}
      overlayClassName={overlayClassName}
      showCloseButton={showCloseButton}
      {...props}
    >
      {children}
    </DialogContent>
  );
}

export function ResponsiveDialogHeader({
  className,
  onPointerDown,
  ...props
}: React.ComponentProps<"div">) {
  const { isMobile, dismissible, dragControls } = React.useContext(
    ResponsiveDialogContext
  );

  if (isMobile) {
    return (
      <SheetHeader
        className={cn(
          "p-0 pr-11 text-left gap-1.5 shrink-0 select-none touch-pan-x",
          className
        )}
        onPointerDown={(e) => {
          onPointerDown?.(e);
          if (!dismissible) return;
          const target = e.target as HTMLElement | null;
          if (
            target?.closest(
              'button, a, input, select, textarea, [role="button"], [data-no-drag]'
            )
          ) {
            return;
          }
          dragControls?.start(e);
        }}
        {...props}
      />
    );
  }

  return <DialogHeader className={className} onPointerDown={onPointerDown} {...props} />;
}

export function ResponsiveDialogBody({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="responsive-dialog-body"
      className={cn(
        "flex-1 min-h-0 overflow-y-auto overscroll-contain",
        className
      )}
      {...props}
    />
  );
}

export function ResponsiveDialogFooter({
  className,
  showCloseButton = false,
  ...props
}: React.ComponentProps<typeof DialogFooter>) {
  const { isMobile, contentPaddingMode } = React.useContext(
    ResponsiveDialogContext
  );

  if (isMobile) {
    const hasMargin =
      typeof className === "string" &&
      /(?:^|\s)-?m(?:[xybtlr])?-/.test(className);
    const hasCustomPadding =
      typeof className === "string" &&
      /(?:^|\s)p(?:[xybtlr])?-/.test(className);

    return (
      <SheetFooter
        className={cn(
          "shrink-0 flex-col-reverse gap-2",
          !hasMargin &&
            !hasCustomPadding &&
            contentPaddingMode === "default" &&
            "-mx-4 -mb-[max(1rem,env(safe-area-inset-bottom))] mt-2 border-t bg-muted/50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]",
          !hasMargin &&
            !hasCustomPadding &&
            contentPaddingMode === "none" &&
            "border-t bg-muted/50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]",
          className
        )}
        {...props}
      />
    );
  }

  return (
    <DialogFooter
      className={className}
      showCloseButton={showCloseButton}
      {...props}
    />
  );
}

export function ResponsiveDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogTitle>) {
  const { isMobile } = React.useContext(ResponsiveDialogContext);
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
  const { isMobile } = React.useContext(ResponsiveDialogContext);
  return isMobile ? (
    <SheetDescription className={className} {...props} />
  ) : (
    <DialogDescription className={className} {...props} />
  );
}
