import { resolveItemMergeRule } from "~/manifest/server/resolveItemMergeRule";
import type { GameView } from "~/play/server/playTypes";
import type { ItemId } from "~/manifest/server/manifestId";
import { cellKey } from "~/board/util/cell";
import { boardContainerNodeId } from "~/board/boardIdentity";
import { inventoryContainerNodeId, inventorySlotNodeId, inventorySourceId } from "~/inventory/inventoryIdentity";
import {
  type FlyerKind,
  type RectLike,
  type GameDragData,
  type GameDragSource,
  type GameDropTarget,
  type GameVisualMeta,
} from "~/play/types";
import {
  useDraggableControl,
  type DraggableAnimation,
  type DraggablePayload,
  type DroppablePayload,
  type DropContext,
  type DropPlan,
} from "~/drag/hook/useDraggableControl";

export interface GameDragActions {
  placeInventory(input: { slotIndex: number; x: number; y: number }): Promise<unknown>;
  moveBoard(input: { boardItemId: string; x: number; y: number }): Promise<unknown>;
  stashBoard(input: { boardItemId: string; slotIndex?: number }): Promise<unknown>;
  swapInventory(input: { sourceSlotIndex: number; targetSlotIndex: number }): Promise<unknown>;
  mergeBoard(input: { sourceBoardItemId: string; targetBoardItemId: string }): Promise<unknown>;
}

export interface GameDragFeedback {
  pulseMergeCell(key: string | null): void;
  flashBoardCell(key: string | null, tone: "error"): void;
  flashInventorySlot(slotIndex: number | null, tone: "error"): void;
  showError(error: unknown): void;
}

export function usePlayDraggableControl({
  game,
  actions,
  feedback,
  addFlyer,
  schedule,
}: Readonly<{
  game: GameView | null | undefined;
  actions: GameDragActions;
  feedback: GameDragFeedback;
  addFlyer(itemId: string, from: RectLike, to: RectLike, kind?: FlyerKind, meta?: GameVisualMeta): Promise<void>;
  schedule(label: string, operation: () => Promise<void>): Promise<void>;
}>) {
  const control = useDraggableControl<string, GameDragSource, GameDropTarget, GameVisualMeta, FlyerKind>({
    schedule: (operation) => schedule("drag/drop", operation),
    resolveDrop: (context) => resolveGameDrop(context, game, actions, feedback),
    animate: (animation) => addFlyer(animation.itemId, animation.from, animation.to, animation.kind, animation.overlay),
    onError(error, context) {
      flashGameDrop(context, game, feedback);
      feedback.showError(error);
    },
    getDragBoundaryNodeId: getGameDragBoundaryNodeId,
  });

  const activeItem = control.activeDrag && game ? (game.items[control.activeDrag.itemId] ?? null) : null;

  return { ...control, activeItem };
}

function resolveGameDrop(
  context: DropContext<string, GameDragSource, GameDropTarget, GameVisualMeta>,
  game: GameView | null | undefined,
  actions: GameDragActions,
  feedback: GameDragFeedback,
): DropPlan<string, FlyerKind, GameVisualMeta> {
  if (!game || !context.target) return reject(() => flashGameDrop(context, game, feedback));

  const source = context.source.source;
  const target = context.target.target;
  const route = `${source.kind}->${target.kind}`;

  switch (route) {
    case "inventory->cell":
      return inventoryToCell(context as GameDropContext<"inventory", "cell">, actions, feedback);
    case "inventory->inventory-slot":
      return inventoryToInventory(context as GameDropContext<"inventory", "inventory-slot">, game, actions, feedback);
    case "board->cell":
      return boardToCell(context as GameDropContext<"board", "cell">, game, actions, feedback);
    case "board->inventory-slot":
      return boardToInventorySlot(context as GameDropContext<"board", "inventory-slot">, game, actions, feedback);
    case "board->inventory-bin":
      return boardToInventoryBin(context as GameDropContext<"board", "inventory-bin">, actions);
    default:
      return reject(() => flashGameDrop(context, game, feedback));
  }
}

type SourceKind = GameDragSource["kind"];
type TargetKind = GameDropTarget["kind"];
type GameDropContext<Source extends SourceKind, Target extends TargetKind> = {
  source: DraggablePayload<string, Extract<GameDragSource, { kind: Source }>, GameVisualMeta>;
  target: DroppablePayload<Extract<GameDropTarget, { kind: Target }>>;
};

function inventoryToCell(
  { source, target }: GameDropContext<"inventory", "cell">,
  actions: GameDragActions,
  feedback: GameDragFeedback,
): DropPlan<string, FlyerKind, GameVisualMeta> {
  if (target.target.boardItemId) return reject(() => feedback.flashBoardCell(cellKey(target.target.x, target.target.y), "error"));

  return accept({
    hide: hiddenSource(source),
    animations: [dragToTargetAnimation(source, target)],
    commit: () => actions.placeInventory({ slotIndex: source.source.slotIndex, x: target.target.x, y: target.target.y }),
  });
}

function inventoryToInventory(
  context: GameDropContext<"inventory", "inventory-slot">,
  game: GameView,
  actions: GameDragActions,
  feedback: GameDragFeedback,
): DropPlan<string, FlyerKind, GameVisualMeta> {
  const { source, target } = context;
  if (source.source.slotIndex === target.target.slotIndex) return { type: "ignore" };

  const targetStack = game.inventoryBySlotIndex[target.target.slotIndex]?.stack ?? null;
  const animations = inventoryMoveAnimations(context, targetStack);
  const hide = [
    source.sourceId,
    ...(targetStack && targetStack.itemId !== source.itemId ? [inventorySourceId(target.target.slotIndex)] : []),
  ];

  return accept({
    hide,
    animations,
    commit: () => actions.swapInventory({ sourceSlotIndex: source.source.slotIndex, targetSlotIndex: target.target.slotIndex }),
  });
}

function boardToCell(
  { source, target }: GameDropContext<"board", "cell">,
  game: GameView,
  actions: GameDragActions,
  feedback: GameDragFeedback,
): DropPlan<string, FlyerKind, GameVisualMeta> {
  if (target.target.boardItemId === source.source.boardItemId) return { type: "ignore" };

  if (!target.target.boardItemId) {
    return accept({
      hide: [source.sourceId],
      animations: [dragToTargetAnimation(source, target)],
      commit: () => actions.moveBoard({ boardItemId: source.source.boardItemId, x: target.target.x, y: target.target.y }),
    });
  }

  const targetBoardItemId = target.target.boardItemId;
  const targetItem = game.boardItemsById[targetBoardItemId];
  if (!targetItem || !resolveItemMergeRule(source.itemId as ItemId, targetItem.itemId as ItemId)) {
    return reject(() => feedback.flashBoardCell(cellKey(target.target.x, target.target.y), "error"));
  }

  return accept({
    hide: [source.sourceId],
    animations: [dragToTargetAnimation(source, target)],
    commit: () => actions.mergeBoard({ sourceBoardItemId: source.source.boardItemId, targetBoardItemId }),
    feedback: () => feedback.pulseMergeCell(cellKey(target.target.x, target.target.y)),
  });
}

function boardToInventorySlot(
  { source, target }: GameDropContext<"board", "inventory-slot">,
  game: GameView,
  actions: GameDragActions,
  feedback: GameDragFeedback,
): DropPlan<string, FlyerKind, GameVisualMeta> {
  const targetStack = game.inventoryBySlotIndex[target.target.slotIndex]?.stack ?? null;
  const targetItem = targetStack ? game.items[targetStack.itemId] : null;
  const cannotStack = targetStack && (targetStack.itemId !== source.itemId || !targetItem || targetStack.quantity >= targetItem.maxStackSize);

  if (cannotStack) {
    return reject(() => feedback.flashInventorySlot(target.target.slotIndex, "error"));
  }

  return accept({
    hide: [source.sourceId],
    animations: [dragToTargetAnimation(source, target)],
    commit: () => actions.stashBoard({ boardItemId: source.source.boardItemId, slotIndex: target.target.slotIndex }),
  });
}

function boardToInventoryBin(
  { source }: GameDropContext<"board", "inventory-bin">,
  actions: GameDragActions,
): DropPlan<string, FlyerKind, GameVisualMeta> {
  return accept({
    hide: [source.sourceId],
    commit: () => actions.stashBoard({ boardItemId: source.source.boardItemId }),
  });
}

function inventoryMoveAnimations(
  context: GameDropContext<"inventory", "inventory-slot">,
  targetStack: { itemId: string; quantity: number } | null,
): DraggableAnimation<string, FlyerKind, GameVisualMeta>[] {
  const { source, target } = context;
  const animations: DraggableAnimation<string, FlyerKind, GameVisualMeta>[] = [dragToTargetAnimation(source, target)];

  if (targetStack && targetStack.itemId !== source.itemId) {
    animations.push({
      itemId: targetStack.itemId,
      fromNodeId: target.targetNodeId,
      toNodeId: inventorySlotNodeId(source.source.slotIndex),
      overlay: { quantity: targetStack.quantity },
    });
  }

  return animations;
}

function dragToTargetAnimation(
  source: DraggablePayload<string, GameDragSource, GameVisualMeta>,
  target: DroppablePayload<GameDropTarget>,
  kind: FlyerKind = "move",
): DraggableAnimation<string, FlyerKind, GameVisualMeta> {
  return {
    itemId: source.itemId,
    fromDrag: true,
    toNodeId: target.targetNodeId,
    kind,
    overlay: source.overlay,
  };
}

function getGameDragBoundaryNodeId(source: DraggablePayload<string, GameDragSource, GameVisualMeta>) {
  return source.source.kind === "board" ? boardContainerNodeId : inventoryContainerNodeId;
}

type AcceptPlan = Omit<Extract<DropPlan<string, FlyerKind, GameVisualMeta>, { type: "accept" }>, "type">;

function accept(plan: AcceptPlan): DropPlan<string, FlyerKind, GameVisualMeta> {
  return { type: "accept", animationTiming: "afterCommit", ...plan, hide: (plan.hide ?? []).filter(Boolean) };
}

function reject(feedback?: () => void): DropPlan<string, FlyerKind, GameVisualMeta> {
  return { type: "reject", feedback };
}

function hiddenSource(source: GameDragData) {
  return source.hideWhenActive === false ? [] : [source.sourceId];
}

function flashGameDrop(
  context: DropContext<string, GameDragSource, GameDropTarget, GameVisualMeta>,
  game: GameView | null | undefined,
  feedback: GameDragFeedback,
) {
  flashSource(context.source.source, game, feedback);

  const target = context.target?.target;
  if (!target) return;
  if (target.kind === "cell") feedback.flashBoardCell(cellKey(target.x, target.y), "error");
  if (target.kind === "inventory-slot") feedback.flashInventorySlot(target.slotIndex, "error");
}

function flashSource(source: GameDragSource, game: GameView | null | undefined, feedback: GameDragFeedback) {
  if (source.kind === "inventory") {
    feedback.flashInventorySlot(source.slotIndex, "error");
    return;
  }

  const boardItem = game?.boardItemsById[source.boardItemId];
  feedback.flashBoardCell(boardItem ? cellKey(boardItem.x, boardItem.y) : null, "error");
}
