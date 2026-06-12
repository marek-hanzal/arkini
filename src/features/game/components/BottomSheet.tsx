import { Sheet } from "react-modal-sheet";
import { useEffect, type ComponentProps, type ReactNode } from "react";
import { cn } from "~/lib/cn";

export interface BottomSheetProps extends Omit<ComponentProps<typeof Sheet>, "children" | "isOpen" | "onClose"> {
  open: boolean;
  children: ReactNode;
  containerClassName?: string;
  contentClassName?: string;
  onClose(): void;
}

/**
 * Modal bottom sheet backed by react-modal-sheet.
 *
 * Inventory intentionally uses PeekBottomSheet because it needs a collapsed
 * header-only state. Build/config sheets should use this component so mount,
 * drag, backdrop, and close animation are handled by one battle-tested sheet
 * instead of more handcrafted DOM yoga.
 */
export function BottomSheet({
  open,
  children,
  containerClassName,
  contentClassName,
  onClose,
  ...props
}: Readonly<BottomSheetProps>) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
    };
  }, [open]);

  return (
    <Sheet
      isOpen={open}
      onClose={onClose}
      detent="content-height"
      tweenConfig={{ ease: "easeOut", duration: 0.2 }}
      {...props}
    >
      <Sheet.Container
        className={cn(
          "mx-auto w-[min(100vw-1.5rem,430px)] overflow-hidden rounded-t-lg border border-slate-800 bg-slate-950/96 text-slate-100 shadow-2xl shadow-black/60",
          containerClassName,
        )}
      >
        <Sheet.Content className={cn("relative max-h-[80vh] overflow-y-auto overscroll-contain", contentClassName)}>
          {children}
        </Sheet.Content>
      </Sheet.Container>
      <Sheet.Backdrop className="bg-slate-950/55" onTap={onClose} />
    </Sheet>
  );
}
