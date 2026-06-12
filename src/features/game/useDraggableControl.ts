import {
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useState } from "react";
import { resolveMergeRule, type ItemId } from "~/domains/game-data";
import type { GameView } from "~/domains/database";
import { cellKey, cssEscape, queryRect, tileVisualRect, wait, without } from "./helpers";
import { flyMs, type CommittedDrag, type DragData, type DropData, type FlyerKind, type RectLike } from "./types";

export interface DraggableControlItemShape {
  id: string;
}

export interface UseDraggableControlOptions<Item extends DraggableControlItemShape> {
  game: GameView | null | undefined;
  items: Record<string, Item> | null | undefined;
  actions: DraggableControlActions;
  feedback: DraggableControlFeedback;
  addFlyer(itemId: string, from: RectLike, to: RectLike, kind?: FlyerKind): void;
}

export interface DraggableControlActions {
  placeInventory(input: { slotIndex: number; x: number; y: number }): Promise<unknown>;
  moveBoard(input: { boardItemId: string; x: number; y: number }): Promise<unknown>;
  stashBoard(input: { boardItemId: string; slotIndex?: number }): Promise<unknown>;
  swapInventory(input: { sourceSlotIndex: number; targetSlotIndex: number }): Promise<unknown>;
  mergeBoard(input: { sourceBoardItemId: string; targetBoardItemId: string }): Promise<unknown>;
}

export interface DraggableControlFeedback {
  pulseBoardCell(key: string): void;
  pulseMergeCell(key: string): void;
  pulseInventorySlot(slotIndex: number): void;
  flashInvalidTarget(source: DragData, target: DropData, game: GameView): void;
  showError(error: unknown): void;
}

/**
 * One drag/drop workflow for every game surface.
 *
 * Board cells and inventory slots only describe their DragData/DropData shape.
 * This hook owns the shared dnd-kit state, committed-source hiding, rejected-drop
 * return animation and swap animation, so grids do not invent slightly different
 * physics like tiny frontend monarchies. App development, apparently.
 */
export function useDraggableControl<Item extends DraggableControlItemShape>({
  game,
  items,
  actions,
  feedback,
  addFlyer,
}: UseDraggableControlOptions<Item>) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [activeDrag, setActiveDrag] = useState<DragData | null>(null);
  const [committedDrag, setCommittedDrag] = useState<CommittedDrag | null>(null);
  const [hiddenBoardIds, setHiddenBoardIds] = useState(() => new Set<string>());
  const [hiddenInventorySlots, setHiddenInventorySlots] = useState(() => new Set<number>());
  const [dragPreviewRect, setDragPreviewRect] = useState<Pick<RectLike, "width" | "height"> | null>(null);

  function handleDragStart(event: DragStartEvent) {
    setCommittedDrag(null);
    setActiveDrag(event.active.data.current as DragData | null);
    const rect = (event.active.rect.current.initial ?? event.active.rect.current.translated) as RectLike | null;
    setDragPreviewRect(rect ? { width: rect.width, height: rect.height } : null);
  }

  function handleDragCancel() {
    clearTransientDragState();
  }

  async function handleDragEnd(event: DragEndEvent) {
    const source = event.active.data.current as DragData | undefined;
    const target = event.over?.data.current as DropData | undefined;
    const dragRect = (event.active.rect.current.translated ?? event.active.rect.current.initial) as RectLike | null;
    setDragPreviewRect(null);

    if (!source || !target || !game) {
      setActiveDrag(null);
      return;
    }

    if (isRejectedBoardMerge(source, target)) {
      await animateRejectedDrop(source, dragRect);
      feedback.flashInvalidTarget(source, target, game);
      return;
    }

    setActiveDrag(null);

    try {
      await runDropAction(source, target);
    } catch (error) {
      setCommittedDrag(null);
      await animateRejectedDrop(source, dragRect);
      feedback.flashInvalidTarget(source, target, game);
      feedback.showError(error);
    }
  }

  async function runDropAction(source: DragData, target: DropData) {
    if (source.kind === "inventory" && target.kind === "cell") {
      if (target.boardItemId) throw new Error("Cell is occupied.");
      setCommittedDrag({ source, hideSource: source.quantity <= 1 });
      await actions.placeInventory({ slotIndex: source.slotIndex, x: target.x, y: target.y });
      feedback.pulseBoardCell(cellKey(target.x, target.y));
      setCommittedDrag(null);
      return;
    }

    if (source.kind === "inventory" && target.kind === "inventory-slot") {
      if (source.slotIndex === target.slotIndex) return;

      const targetSlot = game.inventoryBySlotIndex[target.slotIndex] ?? null;
      if (!targetSlot?.stack) {
        // Empty-slot moves should behave like board moves: commit the source,
        // write the new state, then reveal the updated view. Animating from the
        // pickup slot after the user already dragged the tile there is the kind
        // of visual lie that makes UI feel possessed.
        setCommittedDrag({ source, hideSource: source.quantity <= 1 });
        await actions.swapInventory({ sourceSlotIndex: source.slotIndex, targetSlotIndex: target.slotIndex });
        feedback.pulseInventorySlot(target.slotIndex);
        setCommittedDrag(null);
        return;
      }

      const hiddenSlots = await animateInventorySwap(source, target.slotIndex);
      try {
        await actions.swapInventory({ sourceSlotIndex: source.slotIndex, targetSlotIndex: target.slotIndex });
        feedback.pulseInventorySlot(target.slotIndex);
      } finally {
        for (const slotIndex of hiddenSlots) showInventorySlot(slotIndex);
        setCommittedDrag(null);
      }
      return;
    }

    if (source.kind === "board" && target.kind === "cell") {
      if (target.boardItemId === source.boardItemId) return;

      setCommittedDrag({ source, hideSource: true });
      if (target.boardItemId) {
        await actions.mergeBoard({ sourceBoardItemId: source.boardItemId, targetBoardItemId: target.boardItemId });
        feedback.pulseMergeCell(cellKey(target.x, target.y));
        setCommittedDrag(null);
        return;
      }

      await actions.moveBoard({ boardItemId: source.boardItemId, x: target.x, y: target.y });
      feedback.pulseBoardCell(cellKey(target.x, target.y));
      setCommittedDrag(null);
      return;
    }

    if (source.kind === "board" && target.kind === "inventory-slot") {
      setCommittedDrag({ source, hideSource: true });
      await actions.stashBoard({ boardItemId: source.boardItemId, slotIndex: target.slotIndex });
      feedback.pulseInventorySlot(target.slotIndex);
      setCommittedDrag(null);
      return;
    }

    if (source.kind === "board" && target.kind === "inventory-bin") {
      setCommittedDrag({ source, hideSource: true });
      await actions.stashBoard({ boardItemId: source.boardItemId });
      setCommittedDrag(null);
    }
  }

  async function animateInventorySwap(source: Extract<DragData, { kind: "inventory" }>, targetSlotIndex: number) {
    const sourceSlot = game?.inventoryBySlotIndex[source.slotIndex] ?? null;
    const targetSlot = game?.inventoryBySlotIndex[targetSlotIndex] ?? null;
    const sourceRect = queryRect(`[data-inventory-slot="${source.slotIndex}"]`);
    const targetRect = queryRect(`[data-inventory-slot="${targetSlotIndex}"]`);
    const hiddenSlots = [source.slotIndex];

    setCommittedDrag({ source, hideSource: true });
    if (!sourceSlot?.stack || !sourceRect || !targetRect) return hiddenSlots;

    hideInventorySlot(source.slotIndex);
    addFlyer(sourceSlot.stack.itemId, tileVisualRect(sourceRect), tileVisualRect(targetRect));

    const shouldSwapBack = Boolean(targetSlot?.stack && targetSlot.stack.itemId !== sourceSlot.stack.itemId);
    if (shouldSwapBack && targetSlot?.stack) {
      hiddenSlots.push(targetSlotIndex);
      hideInventorySlot(targetSlotIndex);
      addFlyer(targetSlot.stack.itemId, tileVisualRect(targetRect), tileVisualRect(sourceRect));
    }

    await wait(flyMs);
    return hiddenSlots;
  }

  async function animateRejectedDrop(source: DragData, dragRect: RectLike | null) {
    const from = dragRect ? tileVisualRect(dragRect) : null;
    if (!from) {
      setActiveDrag(null);
      return;
    }

    if (source.kind === "board") {
      const boardItem = game?.boardItemsById[source.boardItemId];
      const targetRect = boardItem ? queryRect(`[data-board-cell="${boardItem.x}:${boardItem.y}"]`) : null;
      if (!targetRect) {
        setActiveDrag(null);
        return;
      }

      hideBoardItem(source.boardItemId);
      setActiveDrag(null);
      addFlyer(source.itemId, from, tileVisualRect(targetRect));
      await wait(flyMs);
      showBoardItem(source.boardItemId);
      return;
    }

    const targetRect = queryRect(`[data-inventory-slot="${source.slotIndex}"]`);
    if (!targetRect) {
      setActiveDrag(null);
      return;
    }

    hideInventorySlot(source.slotIndex);
    setActiveDrag(null);
    addFlyer(source.itemId, from, tileVisualRect(targetRect));
    await wait(flyMs);
    showInventorySlot(source.slotIndex);
  }

  function isRejectedBoardMerge(source: DragData, target: DropData) {
    if (source.kind !== "board" || target.kind !== "cell" || !target.boardItemId) return false;
    if (target.boardItemId === source.boardItemId) return false;
    const targetItem = game?.boardItemsById[target.boardItemId];
    if (!targetItem) return false;
    return !resolveMergeRule(source.itemId as ItemId, targetItem.itemId as ItemId);
  }

  function hideBoardItem(id: string) {
    setHiddenBoardIds((current) => new Set(current).add(id));
  }

  function showBoardItem(id: string) {
    setHiddenBoardIds((current) => without(current, id));
  }

  function hideInventorySlot(slotIndex: number) {
    setHiddenInventorySlots((current) => new Set(current).add(slotIndex));
  }

  function showInventorySlot(slotIndex: number) {
    setHiddenInventorySlots((current) => without(current, slotIndex));
  }

  function commitSource(source: DragData, hideSource = true) {
    setCommittedDrag({ source, hideSource });
  }

  function clearCommittedDrag() {
    setCommittedDrag(null);
  }

  function clearTransientDragState() {
    setActiveDrag(null);
    setCommittedDrag(null);
    setDragPreviewRect(null);
  }

  const activeItem = activeDrag && items ? (items[activeDrag.itemId] ?? null) : null;

  return {
    contextProps: {
      sensors,
      onDragStart: handleDragStart,
      onDragEnd: handleDragEnd,
      onDragCancel: handleDragCancel,
    },
    activeDrag,
    activeItem,
    committedDrag,
    hiddenBoardIds,
    hiddenInventorySlots,
    dragPreviewRect,
    commitSource,
    clearCommittedDrag,
  };
}
