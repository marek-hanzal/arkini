import {
  PointerSensor,
  useSensor,
  useSensors,
  type DragCancelEvent,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useCallback } from "react";
import { match } from "ts-pattern";
import type { GameView } from "~/domains/database";
import { cellKey } from "~/features/game/components/helpers/cellKey";
import { canMerge } from "~/features/game/components/helpers/canMerge";
import { canStash } from "~/features/game/components/helpers/canStash";
import { findInventorySlot } from "~/features/game/components/helpers/findInventorySlot";
import type { DragData, DropData } from "~/features/game/components/types";
import { useGameUiStore } from "~/features/game/state/gameUiStore";
import { useGameFeedback } from "./useGameFeedback";
import { useDropActions } from "./useDropActions";
import type { GameMutations } from "./useGameMutations";

export function useDragHandlers(game: GameView | null | undefined, mutations: GameMutations) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const { markInvalid, pulseInventory, pulseBoard, pulseMerge } = useGameFeedback();
  const { commit, reject } = useDropActions(game);
  const setActiveDrag = useGameUiStore((state) => state.setActiveDrag);
  const setActiveOverId = useGameUiStore((state) => state.setActiveOverId);
  const setReturningDrag = useGameUiStore((state) => state.setReturningDrag);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDrag(event.active.data.current as DragData | null);
    setReturningDrag(null);
    setActiveOverId(null);
  }, [setActiveDrag, setActiveOverId, setReturningDrag]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    setActiveOverId(event.over ? String(event.over.id) : null);
  }, [setActiveOverId]);

  const handleDragCancel = useCallback((_event: DragCancelEvent) => {
    setActiveDrag(null);
    setReturningDrag(null);
    setActiveOverId(null);
  }, [setActiveDrag, setActiveOverId, setReturningDrag]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const active = event.active.data.current as DragData | undefined;
    const over = event.over?.data.current as DropData | undefined;
    const overId = event.over ? String(event.over.id) : undefined;
    setActiveOverId(null);

    if (!active || !game) {
      setActiveDrag(null);
      markInvalid(overId ?? String(event.active.id));
      return;
    }

    const rejectActive = (invalidId = overId ?? String(event.active.id)) => reject(active, invalidId);
    if (!over) {
      rejectActive(String(event.active.id));
      return;
    }

    void match([active, over] as const)
      .with([{ type: "inventory" }, { type: "board-cell" }], ([source, target]) => {
        if (target.boardItemId) {
          rejectActive(overId);
          return;
        }
        void commit(
          () => mutations.placeInventory.mutateAsync({ slotIndex: source.slotIndex, x: target.x, y: target.y }),
          active,
          overId,
          () => pulseBoard(cellKey(target.x, target.y)),
        );
      })
      .with([{ type: "inventory" }, { type: "inventory-slot" }], ([source, target]) => {
        if (source.slotIndex === target.slotIndex) {
          rejectActive(overId);
          return;
        }
        void commit(
          () => mutations.swapInventory.mutateAsync({ sourceSlotIndex: source.slotIndex, targetSlotIndex: target.slotIndex }),
          active,
          overId,
          () => pulseInventory(target.slotIndex),
        );
      })
      .with([{ type: "board" }, { type: "board-cell" }], ([source, target]) => {
        if (source.boardItemId === target.boardItemId) {
          rejectActive(overId);
          return;
        }

        if (target.boardItemId) {
          if (!canMerge(game, source.boardItemId, target.boardItemId)) {
            rejectActive(overId);
            return;
          }

          void commit(
            () => mutations.mergeBoard.mutateAsync({ sourceBoardItemId: source.boardItemId, targetBoardItemId: target.boardItemId! }),
            active,
            overId,
            () => pulseMerge(target.boardItemId!),
          );
          return;
        }

        void commit(
          () => mutations.moveBoard.mutateAsync({ boardItemId: source.boardItemId, x: target.x, y: target.y }),
          active,
          overId,
          () => pulseBoard(cellKey(target.x, target.y)),
        );
      })
      .with([{ type: "board" }, { type: "inventory-slot" }], ([source, target]) => {
        const boardItem = game.boardItemsById[source.boardItemId];
        if (!boardItem) {
          rejectActive(overId);
          return;
        }

        if (!canStash(game, source.boardItemId, Date.now())) {
          rejectActive(source.boardItemId);
          return;
        }

        const targetSlotIndex = findInventorySlot(game, boardItem.itemId, target.slotIndex);
        if (targetSlotIndex === null) {
          rejectActive(overId);
          return;
        }

        void commit(
          () => mutations.stashBoard.mutateAsync({ boardItemId: source.boardItemId, slotIndex: targetSlotIndex }),
          active,
          `inventory:${targetSlotIndex}`,
          () => pulseInventory(targetSlotIndex),
        );
      })
      .otherwise(() => rejectActive(overId));
  }, [
    game,
    markInvalid,
    mutations.mergeBoard,
    mutations.moveBoard,
    mutations.placeInventory,
    mutations.stashBoard,
    mutations.swapInventory,
    pulseBoard,
    pulseInventory,
    pulseMerge,
    reject,
    commit,
    setActiveDrag,
    setActiveOverId,
  ]);

  return { sensors, handleDragStart, handleDragOver, handleDragCancel, handleDragEnd };
}
