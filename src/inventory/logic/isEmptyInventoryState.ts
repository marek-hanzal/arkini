import type { BoardItemState } from "~/board/view/BoardItemStateSchema";

export const isEmptyInventoryState = (state: BoardItemState) => Object.keys(state).length === 0;
