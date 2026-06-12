import { Sheet, type SheetRef } from "react-modal-sheet";
import { forwardRef, useEffect, useRef, type ComponentProps, type ReactNode } from "react";
import { cn } from "~/lib/cn";

const closedSnap = 1;
const openSnap = 2;
const sheetSnapPoints = [0, 2, 0.72, 1];

export interface BottomSheetProps extends Omit<ComponentProps<typeof Sheet>, "children" | "isOpen" | "onClose" | "ref" | "snapPoints" | "initialSnap" | "detent"> {
  /**
   * The sheet stays mounted for the whole game session. `open` only snaps it
   * between a hidden detent and the gameplay detent, which keeps react-modal-sheet
   * animations stable instead of remounting a tiny portal goblin every click.
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
    disableDismiss,
    disableScrollLocking,
    ...props
  },
  ref,
) {
  const sheetRef = useRef<SheetRef>(null);
  const { ["data-drag-node-id"]: dragNodeId, ...sheetProps } = props;

  useEffect(() => {
    sheetRef.current?.snapTo(open ? openSnap : closedSnap);
  }, [open]);

  return (
    <Sheet
      ref={sheetRef}
      isOpen
      onClose={onClose}
      detent="default"
      disableDismiss={disableDismiss ?? true}
      disableScrollLocking={disableScrollLocking ?? false}
      initialSnap={open ? openSnap : closedSnap}
      snapPoints={sheetSnapPoints}
      tweenConfig={{ ease: "easeOut", duration: 0.2 }}
      {...sheetProps}
    >
      <Sheet.Container
        ref={ref}
        data-drag-node-id={dragNodeId}
        className={cn("ak-bottom-sheet-container", className, containerClassName)}
      >
        <Sheet.Content className={cn("ak-bottom-sheet-content", contentClassName)}>
          {children}
        </Sheet.Content>
      </Sheet.Container>
    </Sheet>
  );
});
