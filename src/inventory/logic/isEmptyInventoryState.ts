import type { BoardItemState } from "~/play/logic/playTypes";

export const isEmptyInventoryState = (state: BoardItemState) => Object.keys(state).length === 0;
