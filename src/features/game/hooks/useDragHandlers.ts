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
import { invalidDropReturnMs } from "~/features/game/components/constants";
import { boardCellKey } from "~/features/game/components/helpers/boardCellId";
import { canMergeBoardItems } from "~/features/game/components/helpers/canMergeBoardItems";
import { canStashBoardItem } from "~/features/game/components/helpers/canStashBoardItem";
import { resolveInventoryDestination } from "~/features/game/components/helpers/resolveInventoryDestination";
import type { DragData, DropData } from "~/features/game/components/types";
import { useGameUiStore } from "~/features/game/state/gameUiStore";
import { useGameFeedback } from "./useGameFeedback";
import type { GameMutations } from "./useGameMutations";

export function useDragHandlers(game: GameView | null | undefined, mutations: GameMutations) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const { markInvalid, pulseInventory, pulseBoard, pulseMerge, pulseDragOrigin, showActionError } = useGameFeedback();
  const setSelection = useGameUiStore((state) => state.setSelection);
  const setActiveDrag = useGameUiStore((state) => state.setActiveDrag);
  const setActiveOverId = useGameUiStore((state) => state.setActiveOverId);
  const setCommittedDrag = useGameUiStore((state) => state.setCommittedDrag);
  const setReturningDrag = useGameUiStore((state) => state.setReturningDrag);

  const runDrop = useCallback(
    async (action: () => Promise<unknown>, source: DragData, invalidId?: string, onSuccess?: () => void) => {
      setCommittedDrag(source);
      setReturningDrag(null);
      setActiveDrag(null);

      try {
        await action();
        onSuccess?.();
        setSelection(null);
      } catch (error) {
        setCommittedDrag(null);
        showActionError(error, invalidId);
        return;
      }

      setCommittedDrag(null);
    },
    [setActiveDrag, setCommittedDrag, setReturningDrag, setSelection, showActionError],
  );

  const rejectDrop = useCallback(
    (source: DragData, invalidId?: string) => {
      setReturningDrag(source);
      setActiveDrag(null);
      markInvalid(invalidId);
      window.setTimeout(() => {
        setReturningDrag(null);
        pulseDragOrigin(game, source);
      }, invalidDropReturnMs + 120);
    },
    [game, markInvalid, pulseDragOrigin, setActiveDrag, setReturningDrag],
  );

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

    const reject = (invalidId = overId ?? String(event.active.id)) => rejectDrop(active, invalidId);
    if (!over) {
      reject(String(event.active.id));
      return;
    }

    void match([active, over] as const)
      .with([{ type: "inventory" }, { type: "board-cell" }], ([source, target]) => {
        if (target.boardItemId) {
          reject(overId);
          return;
        }
        void runDrop(
          () => mutations.placeInventory.mutateAsync({ slotIndex: source.slotIndex, x: target.x, y: target.y }),
          active,
          overId,
          () => pulseBoard(boardCellKey(target.x, target.y)),
        );
      })
      .with([{ type: "inventory" }, { type: "inventory-slot" }], ([source, target]) => {
        if (source.slotIndex === target.slotIndex) {
          reject(overId);
          return;
        }
        void runDrop(
          () => mutations.swapInventory.mutateAsync({ sourceSlotIndex: source.slotIndex, targetSlotIndex: target.slotIndex }),
          active,
          overId,
          () => pulseInventory(target.slotIndex),
        );
      })
      .with([{ type: "board" }, { type: "board-cell" }], ([source, target]) => {
        if (source.boardItemId === target.boardItemId) {
          reject(overId);
          return;
        }

        if (target.boardItemId) {
          if (!canMergeBoardItems(game, source.boardItemId, target.boardItemId)) {
            reject(overId);
            return;
          }

          void runDrop(
            () => mutations.mergeBoard.mutateAsync({ sourceBoardItemId: source.boardItemId, targetBoardItemId: target.boardItemId! }),
            active,
            overId,
            () => pulseMerge(target.boardItemId!),
          );
          return;
        }

        void runDrop(
          () => mutations.moveBoard.mutateAsync({ boardItemId: source.boardItemId, x: target.x, y: target.y }),
          active,
          overId,
          () => pulseBoard(boardCellKey(target.x, target.y)),
        );
      })
      .with([{ type: "board" }, { type: "inventory-slot" }], ([source, target]) => {
        const boardItem = game.boardItemsById[source.boardItemId];
        if (!boardItem) {
          reject(overId);
          return;
        }

        if (!canStashBoardItem(game, source.boardItemId, Date.now())) {
          reject(source.boardItemId);
          return;
        }

        const targetSlotIndex = resolveInventoryDestination(game, boardItem.itemId, target.slotIndex);
        if (targetSlotIndex === null) {
          reject(overId);
          return;
        }

        void runDrop(
          () => mutations.stashBoard.mutateAsync({ boardItemId: source.boardItemId, slotIndex: targetSlotIndex }),
          active,
          `inventory:${targetSlotIndex}`,
          () => pulseInventory(targetSlotIndex),
        );
      })
      .otherwise(() => reject(overId));
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
    rejectDrop,
    runDrop,
    setActiveDrag,
    setActiveOverId,
  ]);

  return { sensors, handleDragStart, handleDragOver, handleDragCancel, handleDragEnd };
}
