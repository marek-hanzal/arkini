import { forwardRef, useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { cn } from "~/shared/cn";
import { animateBottomSheet } from "~/play/util/animation";
import { assignRef } from "~/shared/util/refs";

export interface BottomSheetProps {
  /**
   * The sheet is always mounted. `open` only flips interactivity; GSAP owns the
   * slide/backdrop timeline so React does not remount the panel mid-gesture.
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
  forwardedRef,
) {
  const backdropRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const setPanelRef = useCallback((node: HTMLDivElement | null) => {
    panelRef.current = node;
    assignRef(forwardedRef, node);
  }, [forwardedRef]);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const backdrop = backdropRef.current;
    if (!panel || !backdrop) return;

    animateBottomSheet({ panel, backdrop, open });
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  return (
    <div className="ak-bottom-sheet" data-open={open ? "true" : "false"}>
      <button
        ref={backdropRef}
        type="button"
        aria-label="Close bottom sheet"
        tabIndex={open ? 0 : -1}
        className="ak-bottom-sheet-backdrop"
        onClick={onClose}
      />

      <section
        ref={setPanelRef}
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
