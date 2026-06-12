import { Sheet, type SheetRef } from "react-modal-sheet";
import { forwardRef, useEffect, useRef, type ComponentProps, type ReactNode } from "react";
import { cn } from "~/lib/cn";

const defaultPeekHeight = 80;

export interface BottomSheetProps extends Omit<ComponentProps<typeof Sheet>, "children" | "isOpen" | "onClose" | "ref"> {
  /**
   * Modal sheets use this as mount/open state. Peek sheets use it as the
   * expanded-vs-peek snap state while staying mounted.
   */
  open: boolean;
  variant?: "modal" | "peek";
  children: ReactNode;
  header?: ReactNode;
  peekHeight?: number;
  className?: string;
  containerClassName?: string;
  headerClassName?: string;
  contentClassName?: string;
  backdropClassName?: string;
  "data-drag-node-id"?: string;
  onOpenChange?(open: boolean): void;
  onClose(): void;
}

/**
 * Shared react-modal-sheet wrapper for both modal panels and header-peeking
 * panels. The game should style/compose sheets here, not hand-roll another
 * almost-bottom-sheet and then debug scroll physics like a cursed hobby.
 */
export const BottomSheet = forwardRef<HTMLDivElement, BottomSheetProps>(function BottomSheet(
  {
    open,
    variant = "modal",
    children,
    header,
    peekHeight = defaultPeekHeight,
    className,
    containerClassName,
    headerClassName,
    contentClassName,
    backdropClassName,
    onOpenChange,
    onClose,
    initialSnap,
    snapPoints,
    onSnap,
    detent,
    disableDismiss,
    disableScrollLocking,
    ...props
  },
  ref,
) {
  const sheetRef = useRef<SheetRef>(null);
  const { ["data-drag-node-id"]: dragNodeId, ...sheetProps } = props;
  const isPeek = variant === "peek";
  const peekSnapPoints = snapPoints ?? [peekHeight, 1];
  const expandedSnap = peekSnapPoints.length - 1;
  const collapsedSnap = 0;
  const sheetOpen = isPeek ? true : open;

  useEffect(() => {
    if (!isPeek) return;
    sheetRef.current?.snapTo(open ? expandedSnap : collapsedSnap);
  }, [collapsedSnap, expandedSnap, isPeek, open]);

  useEffect(() => {
    if (!isPeek || !open) return;

    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
    };
  }, [isPeek, open]);

  function close() {
    if (isPeek) {
      sheetRef.current?.snapTo(collapsedSnap);
      onOpenChange?.(false);
      return;
    }

    onClose();
  }

  function handleSnap(index: number) {
    if (isPeek) onOpenChange?.(index === expandedSnap);
    onSnap?.(index);
  }

  return (
    <Sheet
      ref={sheetRef}
      isOpen={sheetOpen}
      onClose={close}
      detent={detent ?? (isPeek ? "default" : "content")}
      disableDismiss={disableDismiss ?? isPeek}
      disableScrollLocking={disableScrollLocking ?? isPeek}
      initialSnap={initialSnap ?? (isPeek ? (open ? expandedSnap : collapsedSnap) : undefined)}
      snapPoints={isPeek ? peekSnapPoints : snapPoints}
      tweenConfig={{ ease: "easeOut", duration: 0.2 }}
      onSnap={handleSnap}
      unstyled
      {...sheetProps}
    >
      <Sheet.Container
        ref={ref}
        unstyled
        data-drag-node-id={dragNodeId}
        className={cn(
          "ak-bottom-sheet-container mx-auto w-[min(100vw-1.5rem,430px)] overflow-hidden rounded-t-lg border border-slate-800 bg-slate-950/96 text-slate-100 shadow-2xl shadow-black/60",
          className,
          containerClassName,
        )}
      >
        {header ? (
          <Sheet.Header unstyled className={cn("ak-bottom-sheet-header h-20 border-b border-slate-800/80 px-4 py-3", headerClassName)}>
            {header}
          </Sheet.Header>
        ) : null}

        <Sheet.Content
          unstyled
          className={cn(
            "ak-bottom-sheet-content relative overscroll-contain",
            isPeek ? "overflow-visible" : "max-h-[80vh] overflow-y-auto",
            contentClassName,
          )}
        >
          {children}
        </Sheet.Content>
      </Sheet.Container>

      {!isPeek ? <Sheet.Backdrop unstyled className={cn("ak-bottom-sheet-backdrop bg-slate-950/55", backdropClassName)} onTap={onClose} /> : null}
    </Sheet>
  );
});
