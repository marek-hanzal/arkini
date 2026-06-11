import { create } from "zustand";
import type { BuildCell, DragData, Flyout, Selection } from "~/features/game/components/types";

export namespace useGameUiStore {
  export interface State {
    selection: Selection;
    activeDrag: DragData | null;
    activeOverId: string | null;
    committedDrag: DragData | null;
    returningDrag: DragData | null;
    invalidTargetId: string | null;
    inventoryPulseSlot: number | null;
    boardPulseCell: string | null;
    mergePulseBoardItemId: string | null;
    flyout: Flyout | null;
    hiddenBoardItemIds: ReadonlySet<string>;
    buildCell: BuildCell;
    splashReady: boolean;
    nowMs: number;
  }

  export interface Actions {
    setSelection(selection: Selection): void;
    setActiveDrag(activeDrag: DragData | null): void;
    setActiveOverId(activeOverId: string | null): void;
    setCommittedDrag(committedDrag: DragData | null): void;
    setReturningDrag(returningDrag: DragData | null): void;
    setInvalidTargetId(invalidTargetId: string | null): void;
    setInventoryPulseSlot(inventoryPulseSlot: number | null): void;
    setBoardPulseCell(boardPulseCell: string | null): void;
    setMergePulseBoardItemId(mergePulseBoardItemId: string | null): void;
    setFlyout(flyout: Flyout | null): void;
    setHiddenBoardItemIds(hiddenBoardItemIds: ReadonlySet<string> | ((current: ReadonlySet<string>) => ReadonlySet<string>)): void;
    setBuildCell(buildCell: BuildCell): void;
    setSplashReady(splashReady: boolean): void;
    setNowMs(nowMs: number): void;
    clearDragState(): void;
  }

  export type Store = State & Actions;
}

const emptyBoardItemIds = new Set<string>();

export const useGameUiStore = create<useGameUiStore.Store>((set) => ({
  selection: null,
  activeDrag: null,
  activeOverId: null,
  committedDrag: null,
  returningDrag: null,
  invalidTargetId: null,
  inventoryPulseSlot: null,
  boardPulseCell: null,
  mergePulseBoardItemId: null,
  flyout: null,
  hiddenBoardItemIds: emptyBoardItemIds,
  buildCell: null,
  splashReady: false,
  nowMs: Date.now(),

  setSelection: (selection) => set({ selection }),
  setActiveDrag: (activeDrag) => set({ activeDrag }),
  setActiveOverId: (activeOverId) => set({ activeOverId }),
  setCommittedDrag: (committedDrag) => set({ committedDrag }),
  setReturningDrag: (returningDrag) => set({ returningDrag }),
  setInvalidTargetId: (invalidTargetId) => set({ invalidTargetId }),
  setInventoryPulseSlot: (inventoryPulseSlot) => set({ inventoryPulseSlot }),
  setBoardPulseCell: (boardPulseCell) => set({ boardPulseCell }),
  setMergePulseBoardItemId: (mergePulseBoardItemId) => set({ mergePulseBoardItemId }),
  setFlyout: (flyout) => set({ flyout }),
  setHiddenBoardItemIds: (hiddenBoardItemIds) =>
    set((state) => ({
      hiddenBoardItemIds:
        typeof hiddenBoardItemIds === "function" ? hiddenBoardItemIds(state.hiddenBoardItemIds) : hiddenBoardItemIds,
    })),
  setBuildCell: (buildCell) => set({ buildCell }),
  setSplashReady: (splashReady) => set({ splashReady }),
  setNowMs: (nowMs) => set({ nowMs }),
  clearDragState: () => set({ activeDrag: null, activeOverId: null, returningDrag: null }),
}));
