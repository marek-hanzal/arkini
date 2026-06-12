import { useDraggable, useDroppable, type Data } from "@dnd-kit/core";
import type { HTMLAttributes, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { cn } from "~/lib/cn";
import { usePressActions } from "../usePressActions";
import { BottomSheet, type BottomSheetProps } from "./BottomSheet";

export function DroppableCell({
  id,
  data,
  className,
  children,
  ...props
}: Readonly<DroppableCellProps>) {
  const { setNodeRef, isOver } = useDroppable({ id, data });

  return (
    <div
      ref={setNodeRef}
      className={typeof className === "function" ? className(isOver) : className}
      {...props}
    >
      {children}
    </div>
  );
}

export interface DroppableCellProps extends Omit<HTMLAttributes<HTMLDivElement>, "className" | "children"> {
  id: string;
  data: Data;
  className?: string | ((isOver: boolean) => string);
  children: ReactNode;
}

export function DroppableBottomSheet({
  id,
  data,
  className,
  children,
  ...props
}: Readonly<DroppableBottomSheetProps>) {
  const { setNodeRef, isOver } = useDroppable({ id, data });

  return (
    <BottomSheet
      ref={setNodeRef}
      className={typeof className === "function" ? className(isOver) : className}
      {...props}
    >
      {children}
    </BottomSheet>
  );
}

export interface DroppableBottomSheetProps extends Omit<BottomSheetProps, "className" | "children"> {
  id: string;
  data: Data;
  className?: string | ((isOver: boolean) => string);
  children: ReactNode;
}

export function DraggableTileShell({
  id,
  data,
  hidden,
  className,
  dragDisabled = false,
  onSingleActivate,
  onDoubleActivate,
  children,
  ...props
}: Readonly<DraggableTileShellProps>) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data, disabled: dragDisabled });
  const press = usePressActions({ onSingle: onSingleActivate, onDouble: onDoubleActivate });

  function pointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    press.onPointerDown(event);
    listeners?.onPointerDown?.(event);
  }

  function pointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    press.onPointerMove(event);
  }

  function pointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    press.onPointerUp(event);
  }

  function pointerCancel() {
    press.onPointerCancel();
  }

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...props}
      className={cn(className, (hidden || isDragging) && "opacity-0")}
      onClick={press.onClick}
      onKeyDown={listeners?.onKeyDown}
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerCancel={pointerCancel}
    >
      {children}
    </div>
  );
}

export interface DraggableTileShellProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  id: string;
  data: Data;
  hidden: boolean;
  dragDisabled?: boolean;
  onSingleActivate?(): void;
  onDoubleActivate?(): void;
  children: ReactNode;
}
