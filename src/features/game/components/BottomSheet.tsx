import { forwardRef, useEffect, type ReactNode } from "react";
import { cn } from "~/lib/cn";

export interface BottomSheetProps {
  /**
   * The sheet is always mounted. `open` only flips a data attribute so CSS owns
   * the slide/backdrop animation and React does not remount the panel mid-gesture.
   */
  open: boolean;
  children: ReactNode;
  className?: string;
  containerClassName?: string;
  contentClassName?: string;
  "data-drag-node-id"?: string;
  onClose(): void;
}

export const BottomSheet = forwardRef<HTMLDivElement, BottomSheetProps>(function BottomSheet(
  {
    open,
    children,
    className,
    containerClassName,
    contentClassName,
    onClose,
    "data-drag-node-id": dragNodeId,
  },
  ref,
) {
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  return (
    <div className="ak-bottom-sheet" data-open={open ? "true" : "false"} aria-hidden={!open}>
      <button
        type="button"
        aria-label="Close bottom sheet"
        tabIndex={open ? 0 : -1}
        className="ak-bottom-sheet-backdrop"
        onClick={onClose}
      />

      <section
        ref={ref}
        role="dialog"
        aria-modal="true"
        data-drag-node-id={dragNodeId}
        className={cn("ak-bottom-sheet-panel", className, containerClassName)}
      >
        <div className={cn("ak-bottom-sheet-content", contentClassName)}>
          {children}
        </div>
      </section>
    </div>
  );
});
