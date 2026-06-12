import {
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useState } from "react";
import { cssEscape, queryRect, tileVisualRect, wait, without } from "./helpers";
import type { RectLike } from "./types";

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

export interface DraggableAnimation<ItemId extends string = string, Kind extends string = string> {
  itemId: ItemId;
  kind?: Kind;
  fromNodeId?: string;
  toNodeId?: string;
  from?: RectLike;
  to?: RectLike;
}

export interface ResolvedDraggableAnimation<ItemId extends string = string, Kind extends string = string> {
  itemId: ItemId;
  kind?: Kind;
  from: RectLike;
  to: RectLike;
}

export type DropPlan<ItemId extends string = string, Kind extends string = string> =
  | { type: "ignore" }
  | { type: "reject"; feedback?(): void | Promise<void>; animateReturn?: boolean }
  | {
    type: "accept";
    /** Source ids hidden while commit/animations are being resolved. */
    hide?: string[];
    /** Generic pre/post move animations. */
    animations?: DraggableAnimation<ItemId, Kind>[];
    animationTiming?: "beforeCommit" | "afterCommit";
    commit(): Promise<unknown> | unknown;
    feedback?(): void | Promise<void>;
  };

export interface DropContext<ItemId extends string = string, Source = unknown, Target = unknown, Overlay = unknown> {
  source: DraggablePayload<ItemId, Source, Overlay>;
  target: DroppablePayload<Target> | null;
}

export interface UseDraggableControlOptions<ItemId extends string = string, Source = unknown, Target = unknown, Overlay = unknown, Kind extends string = string> {
  resolveDrop(context: DropContext<ItemId, Source, Target, Overlay>): DropPlan<ItemId, Kind> | Promise<DropPlan<ItemId, Kind>>;
  animate(animation: ResolvedDraggableAnimation<ItemId, Kind>): void;
  onError?(error: unknown, context: DropContext<ItemId, Source, Target, Overlay>): void | Promise<void>;
  animationMs?: number;
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
  animationMs = 320,
  activationDistance = 5,
}: UseDraggableControlOptions<ItemId, Source, Target, Overlay, Kind>) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: activationDistance } }));
  const [activeDrag, setActiveDrag] = useState<DraggablePayload<ItemId, Source, Overlay> | null>(null);
  const [hiddenSourceIds, setHiddenSourceIds] = useState(() => new Set<string>());
  const [dragPreviewRect, setDragPreviewRect] = useState<Pick<RectLike, "width" | "height"> | null>(null);

  function handleDragStart(event: DragStartEvent) {
    clearHiddenSources();
    setActiveDrag(event.active.data.current as DraggablePayload<ItemId, Source, Overlay> | null);
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
      setActiveDrag(null);
      return;
    }

    try {
      await runPlan(context, await resolveDrop(context), dragRect);
    } catch (error) {
      await failDrop(error, context, dragRect);
    }
  }

  async function runPlan(context: DropContext<ItemId, Source, Target, Overlay>, plan: DropPlan<ItemId, Kind>, dragRect: RectLike | null) {
    if (plan.type === "ignore") {
      setActiveDrag(null);
      return;
    }

    if (plan.type === "reject") {
      if (plan.animateReturn !== false) await animateReturn(context.source, dragRect);
      else setActiveDrag(null);
      await plan.feedback?.();
      return;
    }

    setActiveDrag(null);
    hideSources(plan.hide ?? []);

    if (plan.animations?.length && plan.animationTiming !== "afterCommit") {
      await playAnimations(plan.animations);
    }

    await plan.commit();

    if (plan.animations?.length && plan.animationTiming === "afterCommit") {
      await playAnimations(plan.animations);
    }

    await plan.feedback?.();
    clearHiddenSources();
  }

  async function failDrop(error: unknown, context: DropContext<ItemId, Source, Target, Overlay>, dragRect: RectLike | null) {
    clearHiddenSources();
    await animateReturn(context.source, dragRect);
    await onError?.(error, context);
  }

  async function playAnimations(animations: DraggableAnimation<ItemId, Kind>[]) {
    const resolved = animations.map(resolveAnimation).filter((animation): animation is ResolvedDraggableAnimation<ItemId, Kind> => Boolean(animation));
    for (const animation of resolved) animate(animation);
    if (resolved.length > 0) await wait(animationMs);
  }

  function resolveAnimation(animation: DraggableAnimation<ItemId, Kind>): ResolvedDraggableAnimation<ItemId, Kind> | null {
    const from = animation.from ?? rectForNode(animation.fromNodeId);
    const to = animation.to ?? rectForNode(animation.toNodeId);
    if (!from || !to) return null;
    return { itemId: animation.itemId, kind: animation.kind, from, to };
  }

  async function animateReturn(source: DraggablePayload<ItemId, Source, Overlay>, dragRect: RectLike | null) {
    const from = dragRect ? tileVisualRect(dragRect) : null;
    const to = rectForNode(source.sourceNodeId);

    if (!from || !to) {
      setActiveDrag(null);
      return;
    }

    if (source.hideWhenActive !== false) hideSources([source.sourceId]);
    setActiveDrag(null);
    animate({ itemId: source.itemId, from, to });
    await wait(animationMs);
    clearHiddenSources();
  }

  function rectForNode(nodeId: string | undefined) {
    if (!nodeId) return null;
    const rect = queryRect(`[data-drag-node-id="${cssEscape(nodeId)}"]`);
    return rect ? tileVisualRect(rect) : null;
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
