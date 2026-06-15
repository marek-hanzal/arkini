import type { BoardItemState } from "~/v0/board/view/BoardItemStateSchema";

export const isEmptyInventoryState = (state: BoardItemState) => Object.keys(state).length === 0;
