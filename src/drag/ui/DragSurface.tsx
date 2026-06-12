import { useDraggable, useDroppable, type Data } from "@dnd-kit/core";
import { useCallback, type HTMLAttributes, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { cn } from "~/shared/cn";
import type { DraggablePayload, DroppablePayload } from "~/drag/hook/useDraggableControl";
import { usePressActions } from "~/shared/hook/usePressActions";

export function DroppableSurface<Target>({
  id,
  nodeId = id,
  payload,
  className,
  children,
  nodeRef,
  ...props
}: Readonly<DroppableSurfaceProps<Target>>) {
  const data = { ...payload, targetNodeId: payload.targetNodeId ?? nodeId } satisfies DroppablePayload<Target>;
  const { setNodeRef, isOver } = useDroppable({ id, data: data as unknown as Data });
  const setRefs = useCallback((node: HTMLDivElement | null) => {
    setNodeRef(node);
    nodeRef?.(node);
  }, [nodeRef, setNodeRef]);

  return (
    <div
      ref={setRefs}
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
  nodeRef?(node: HTMLDivElement | null): void;
  children: ReactNode;
}

export function DraggableSurface<ItemId extends string, Source, Overlay = unknown>({
  id,
  nodeId = id,
  payload,
  hidden,
  className,
  dragDisabled = false,
  delaySingleWhenDouble = false,
  onSingleActivate,
  onDoubleActivate,
  children,
  ...props
}: Readonly<DraggableSurfaceProps<ItemId, Source, Overlay>>) {
  const data = { ...payload, sourceNodeId: payload.sourceNodeId ?? nodeId } satisfies DraggablePayload<ItemId, Source, Overlay>;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data: data as unknown as Data, disabled: dragDisabled });
  const press = usePressActions({
    onSingle: onSingleActivate,
    onDouble: onDoubleActivate,
    delaySingleWhenDouble,
    isDisabled: dragDisabled,
  });
  const pressProps = press.pressProps as HTMLAttributes<HTMLDivElement>;

  function pointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    pressProps.onPointerDown?.(event);
    listeners?.onPointerDown?.(event);
  }

  function keyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    pressProps.onKeyDown?.(event);
    listeners?.onKeyDown?.(event);
  }

  return (
    <div
      ref={setNodeRef}
      data-drag-node-id={nodeId}
      {...attributes}
      {...props}
      {...pressProps}
      className={cn(className, (hidden || (isDragging && data.hideWhenActive !== false)) && "pointer-events-none opacity-0")}
      onKeyDown={keyDown}
      onPointerDown={pointerDown}
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
  delaySingleWhenDouble?: boolean;
  onSingleActivate?(): void;
  onDoubleActivate?(): void;
  children: ReactNode;
}
