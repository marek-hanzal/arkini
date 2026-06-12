import {
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type Modifier,
} from "@dnd-kit/core";
import { useCallback, useMemo, useRef, useState } from "react";
import { waitForPaint } from "../util/async";
import { without } from "../util/collection";
import { cssEscape, queryRect } from "../util/dom";
import type { RectLike } from "../types";

export interface DraggablePayload<ItemId extends string = string, Source = unknown, Overlay = unknown> {
  /** Stable key of the visual source. Used only for hiding/showing DOM during committed state. */
  sourceId: string;
  /** Node measured when a rejected drop flies back. */
  sourceNodeId: string;
  /** Asset/item key used by the app-provided animation renderer. */
  itemId: ItemId;
  /** App-owned source data. The control never inspects it. */
  source: Source;
  /** Extra app-owned overlay data. The control never inspects it. */
  overlay?: Overlay;
  /** Multi-stack sources can stay visible while dragged; single visual objects usually hide. */
  hideWhenActive?: boolean;
}

export interface DroppablePayload<Target = unknown> {
  /** Stable key of the drop target. */
  targetId: string;
  /** Node measured by generic animations. */
  targetNodeId: string;
  /** App-owned target data. The control never inspects it. */
  target: Target;
}

export interface DraggableAnimation<ItemId extends string = string, Kind extends string = string, Overlay = unknown> {
  itemId: ItemId;
  kind?: Kind;
  fromNodeId?: string;
  toNodeId?: string;
  from?: RectLike;
  to?: RectLike;
  /** Resolve the animation start from the final drag overlay rect instead of the original source node. */
  fromDrag?: boolean;
  /** App-owned visual metadata forwarded to the animation renderer. */
  overlay?: Overlay;
}

export interface ResolvedDraggableAnimation<ItemId extends string = string, Kind extends string = string, Overlay = unknown> {
  itemId: ItemId;
  kind?: Kind;
  from: RectLike;
  to: RectLike;
  overlay?: Overlay;
}

export type DropPlan<ItemId extends string = string, Kind extends string = string, Overlay = unknown> =
  | { type: "ignore" }
  | { type: "reject"; feedback?(): void | Promise<void>; animateReturn?: boolean }
  | {
    type: "accept";
    /** Source ids hidden while commit/animations are being resolved. */
    hide?: string[];
    /** Generic pre/post move animations. */
    animations?: DraggableAnimation<ItemId, Kind, Overlay>[];
    animationTiming?: "beforeCommit" | "afterCommit";
    commit(): Promise<unknown> | unknown;
    feedback?(): void | Promise<void>;
  };

export interface DropContext<ItemId extends string = string, Source = unknown, Target = unknown, Overlay = unknown> {
  source: DraggablePayload<ItemId, Source, Overlay>;
  target: DroppablePayload<Target> | null;
}

export interface UseDraggableControlOptions<ItemId extends string = string, Source = unknown, Target = unknown, Overlay = unknown, Kind extends string = string> {
  resolveDrop(context: DropContext<ItemId, Source, Target, Overlay>): DropPlan<ItemId, Kind, Overlay> | Promise<DropPlan<ItemId, Kind, Overlay>>;
  animate(animation: ResolvedDraggableAnimation<ItemId, Kind, Overlay>): Promise<void> | void;
  schedule?(operation: () => Promise<void>): Promise<void>;
  onError?(error: unknown, context: DropContext<ItemId, Source, Target, Overlay>): void | Promise<void>;
  getDragBoundaryNodeId?(source: DraggablePayload<ItemId, Source, Overlay>): string | null | undefined;
  activationDistance?: number;
}

/**
 * Generic drag/drop workflow.
 *
 * This hook deliberately knows nothing about domain rules, surfaces, or
 * persistence. It only owns dnd-kit state, source
 * hiding, generic return animation, generic app-provided move animations, and
 * the accept/reject/commit lifecycle returned by `resolveDrop`.
 */
export function useDraggableControl<ItemId extends string = string, Source = unknown, Target = unknown, Overlay = unknown, Kind extends string = string>({
  resolveDrop,
  animate,
  onError,
  schedule,
  getDragBoundaryNodeId,
  activationDistance = 5,
}: UseDraggableControlOptions<ItemId, Source, Target, Overlay, Kind>) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: activationDistance } }));
  const activeDragRef = useRef<DraggablePayload<ItemId, Source, Overlay> | null>(null);
  const dragBoundaryRectRef = useRef<RectLike | null>(null);
  const [activeDrag, setActiveDrag] = useState<DraggablePayload<ItemId, Source, Overlay> | null>(null);
  const [hiddenSourceIds, setHiddenSourceIds] = useState(() => new Set<string>());
  const [dragPreviewRect, setDragPreviewRect] = useState<Pick<RectLike, "width" | "height"> | null>(null);

  const restrictToDragBoundary = useCallback<Modifier>(({ transform, draggingNodeRect, activeNodeRect }) => {
    const draggingRect = draggingNodeRect ?? activeNodeRect;
    const boundaryRect = dragBoundaryRectRef.current;

    if (!draggingRect || !boundaryRect) return transform;

    const minX = boundaryRect.left - draggingRect.left;
    const maxX = boundaryRect.left + boundaryRect.width - draggingRect.left - draggingRect.width;
    const minY = boundaryRect.top - draggingRect.top;
    const maxY = boundaryRect.top + boundaryRect.height - draggingRect.top - draggingRect.height;

    return {
      ...transform,
      x: clamp(transform.x, minX, maxX),
      y: clamp(transform.y, minY, maxY),
    };
  }, []);
  const modifiers = useMemo(() => getDragBoundaryNodeId ? [restrictToDragBoundary] : [], [getDragBoundaryNodeId, restrictToDragBoundary]);

  function handleDragStart(event: DragStartEvent) {
    clearHiddenSources();
    const source = event.active.data.current as DraggablePayload<ItemId, Source, Overlay> | null;
    activeDragRef.current = source;
    dragBoundaryRectRef.current = source ? rectForBoundaryNode(getDragBoundaryNodeId?.(source)) : null;
    setActiveDrag(source);
    const rect = (event.active.rect.current.initial ?? event.active.rect.current.translated) as RectLike | null;
    setDragPreviewRect(rect ? { width: rect.width, height: rect.height } : null);
  }

  function handleDragCancel() {
    clearTransientState();
  }

  async function handleDragEnd(event: DragEndEvent) {
    const source = event.active.data.current as DraggablePayload<ItemId, Source, Overlay> | undefined;
    const target = (event.over?.data.current as DroppablePayload<Target> | undefined) ?? null;
    const context = source ? { source, target } : null;
    const dragRect = (event.active.rect.current.translated ?? event.active.rect.current.initial) as RectLike | null;
    setDragPreviewRect(null);

    if (!source || !context) {
      activeDragRef.current = null;
      dragBoundaryRectRef.current = null;
      setActiveDrag(null);
      return;
    }

    const operation = async () => {
      try {
        await runPlan(context, await resolveDrop(context), dragRect);
      } catch (error) {
        await failDrop(error, context, dragRect);
      }
    };

    if (schedule) await schedule(operation);
    else await operation();
  }

  async function runPlan(context: DropContext<ItemId, Source, Target, Overlay>, plan: DropPlan<ItemId, Kind, Overlay>, dragRect: RectLike | null) {
    if (plan.type === "ignore") {
      activeDragRef.current = null;
      dragBoundaryRectRef.current = null;
      setActiveDrag(null);
      return;
    }

    if (plan.type === "reject") {
      const feedback = runFeedback(plan.feedback);
      if (plan.animateReturn !== false) await animateReturn(context.source, dragRect);
      else {
        activeDragRef.current = null;
        dragBoundaryRectRef.current = null;
        setActiveDrag(null);
      }
      await feedback;
      return;
    }

    hideSources(plan.hide ?? []);
    activeDragRef.current = null;
    dragBoundaryRectRef.current = null;
    setActiveDrag(null);

    if (plan.animations?.length && plan.animationTiming !== "afterCommit") {
      await playAnimations(plan.animations, dragRect);
    }

    await plan.commit();

    if (plan.animations?.length && plan.animationTiming === "afterCommit") {
      await playAnimations(plan.animations, dragRect);
    }

    await waitForPaint();
    await plan.feedback?.();
    clearHiddenSources();
  }

  async function failDrop(error: unknown, context: DropContext<ItemId, Source, Target, Overlay>, dragRect: RectLike | null) {
    clearHiddenSources();
    const feedback = runFeedback(() => onError?.(error, context));
    await animateReturn(context.source, dragRect);
    await feedback;
  }

  async function playAnimations(animations: DraggableAnimation<ItemId, Kind, Overlay>[], dragRect: RectLike | null) {
    const resolved = animations.map((animation) => resolveAnimation(animation, dragRect)).filter((animation): animation is ResolvedDraggableAnimation<ItemId, Kind, Overlay> => Boolean(animation));
    await Promise.all(resolved.map((animation) => animate(animation)));
  }

  function resolveAnimation(animation: DraggableAnimation<ItemId, Kind, Overlay>, dragRect: RectLike | null): ResolvedDraggableAnimation<ItemId, Kind, Overlay> | null {
    const from = animation.from ?? (animation.fromDrag && dragRect ? dragRect : rectForNode(animation.fromNodeId));
    const to = animation.to ?? rectForNode(animation.toNodeId);
    if (!from || !to) return null;
    return { itemId: animation.itemId, kind: animation.kind, from, to, overlay: animation.overlay };
  }

  async function animateReturn(source: DraggablePayload<ItemId, Source, Overlay>, dragRect: RectLike | null) {
    const from = dragRect;
    const to = rectForNode(source.sourceNodeId);

    if (!from || !to) {
      activeDragRef.current = null;
      dragBoundaryRectRef.current = null;
      setActiveDrag(null);
      return;
    }

    if (source.hideWhenActive !== false) hideSources([source.sourceId]);
    activeDragRef.current = null;
    dragBoundaryRectRef.current = null;
    setActiveDrag(null);
    await animate({ itemId: source.itemId, from, to, overlay: source.overlay });
    clearHiddenSources();
  }

  function rectForNode(nodeId: string | undefined) {
    if (!nodeId) return null;
    const rect = queryRect(`[data-drag-node-id="${cssEscape(nodeId)}"]`);
    return rect;
  }

  function rectForBoundaryNode(nodeId: string | null | undefined) {
    if (!nodeId) return null;
    return queryRect(`[data-drag-boundary-id="${cssEscape(nodeId)}"]`) ?? queryRect(`[data-drag-node-id="${cssEscape(nodeId)}"]`);
  }

  function hideSources(ids: readonly string[]) {
    setHiddenSourceIds((current) => {
      const next = new Set(current);
      for (const id of ids) next.add(id);
      return next;
    });
  }

  function showSource(id: string) {
    setHiddenSourceIds((current) => without(current, id));
  }

  function clearHiddenSources() {
    setHiddenSourceIds(new Set());
  }

  function clearTransientState() {
    activeDragRef.current = null;
    dragBoundaryRectRef.current = null;
    setActiveDrag(null);
    setDragPreviewRect(null);
    clearHiddenSources();
  }

  function isSourceHidden(sourceId: string) {
    return hiddenSourceIds.has(sourceId) || (activeDrag?.hideWhenActive !== false && activeDrag?.sourceId === sourceId);
  }

  return {
    contextProps: {
      sensors,
      onDragStart: handleDragStart,
      onDragEnd: handleDragEnd,
      onDragCancel: handleDragCancel,
      modifiers,
    },
    activeDrag,
    hiddenSourceIds,
    dragPreviewRect,
    isSourceHidden,
    hideSources,
    showSource,
    clearHiddenSources,
  };
}

async function runFeedback(feedback: (() => void | Promise<void>) | undefined) {
  try {
    await feedback?.();
  } catch (error) {
    // Feedback must never turn a clean reject into another drag failure.
    void error;
  }
}

function clamp(value: number, min: number, max: number) {
  if (min > max) return min + (max - min) / 2;
  return Math.min(Math.max(value, min), max);
}
