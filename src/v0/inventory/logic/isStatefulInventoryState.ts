import type { BoardItemState } from "~/v0/board/view/BoardItemStateSchema";

export const isStatefulInventoryState = (state: BoardItemState | undefined) =>
	Object.keys(state ?? {}).length > 0;
