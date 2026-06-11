import { forwardRef, useEffect, useState, type ReactNode } from "react";
import { cn } from "~/lib/cn";

const transitionMs = 220;

export const BottomSheet = forwardRef<HTMLElement, BottomSheetProps>(function BottomSheet(
  {
    open,
    keepMounted = false,
    closedClassName = "translate-y-[calc(100%+1rem)]",
    backdropClassName = "z-40 bg-slate-950/50",
    sheetClassName = "z-50",
    className,
    children,
    onClose,
  },
  ref,
) {
  const [mounted, setMounted] = useState(open || keepMounted);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const frame = window.requestAnimationFrame(() => setShown(true));
      return () => window.cancelAnimationFrame(frame);
    }

    setShown(false);
    if (keepMounted) return;

    const timeout = window.setTimeout(() => setMounted(false), transitionMs);
    return () => window.clearTimeout(timeout);
  }, [keepMounted, open]);

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

  if (!mounted) return null;

  return (
    <>
      {open ? <button type="button" aria-label="Close sheet" className={cn("fixed inset-0", backdropClassName)} onClick={onClose} /> : null}

      <aside
        ref={ref}
        style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        className={cn(
          "fixed inset-x-0 mx-auto w-[min(100vw-1.5rem,430px)] rounded-t-lg border border-slate-800 bg-slate-950/96 shadow-2xl shadow-black/60 transition-transform duration-200",
          shown ? "translate-y-0" : closedClassName,
          sheetClassName,
          className,
        )}
      >
        {children}
      </aside>
    </>
  );
});

export interface BottomSheetProps {
  open: boolean;
  keepMounted?: boolean;
  closedClassName?: string;
  backdropClassName?: string;
  sheetClassName?: string;
  className?: string;
  children: ReactNode;
  onClose(): void;
}
