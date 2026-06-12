import { useDraggable, useDroppable, type Data } from "@dnd-kit/core";
import type { HTMLAttributes, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { cn } from "~/lib/cn";
import type { DraggablePayload, DroppablePayload } from "../useDraggableControl";
import { usePressActions } from "../usePressActions";

export function DroppableSurface<Target>({
  id,
  nodeId = id,
  payload,
  className,
  children,
  ...props
}: Readonly<DroppableSurfaceProps<Target>>) {
  const data = { ...payload, targetNodeId: payload.targetNodeId ?? nodeId } satisfies DroppablePayload<Target>;
  const { setNodeRef, isOver } = useDroppable({ id, data: data as unknown as Data });

  return (
    <div
      ref={setNodeRef}
      data-drag-node-id={nodeId}
      className={typeof className === "function" ? className(isOver) : className}
      {...props}
    >
      {children}
    </div>
  );
}

export interface DroppableSurfaceProps<Target> extends Omit<HTMLAttributes<HTMLDivElement>, "className" | "children"> {
  id: string;
  nodeId?: string;
  payload: DroppablePayload<Target>;
  className?: string | ((isOver: boolean) => string);
  children: ReactNode;
}

export function DraggableSurface<ItemId extends string, Source, Overlay = unknown>({
  id,
  nodeId = id,
  payload,
  hidden,
  className,
  dragDisabled = false,
  onSingleActivate,
  onDoubleActivate,
  children,
  ...props
}: Readonly<DraggableSurfaceProps<ItemId, Source, Overlay>>) {
  const data = { ...payload, sourceNodeId: payload.sourceNodeId ?? nodeId } satisfies DraggablePayload<ItemId, Source, Overlay>;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data: data as unknown as Data, disabled: dragDisabled });
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

  function keyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    listeners?.onKeyDown?.(event);
  }

  return (
    <div
      ref={setNodeRef}
      data-drag-node-id={nodeId}
      {...attributes}
      {...props}
      className={cn(className, (hidden || isDragging) && "opacity-0")}
      onClick={press.onClick}
      onKeyDown={keyDown}
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerCancel={pointerCancel}
    >
      {children}
    </div>
  );
}

export interface DraggableSurfaceProps<ItemId extends string, Source, Overlay = unknown> extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  id: string;
  nodeId?: string;
  payload: DraggablePayload<ItemId, Source, Overlay>;
  hidden: boolean;
  dragDisabled?: boolean;
  onSingleActivate?(): void;
  onDoubleActivate?(): void;
  children: ReactNode;
}
