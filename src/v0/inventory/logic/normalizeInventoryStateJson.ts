import type { BoardItemState } from "~/v0/board/view/BoardItemStateSchema";
import { json } from "~/v0/style/json";
import { parseJson } from "~/v0/style/parseJson";
import { emptyInventoryStateJson } from "./emptyInventoryStateJson";
import { isEmptyInventoryState } from "./isEmptyInventoryState";

export const normalizeInventoryStateJson = (stateJson: string | undefined) => {
	if (!stateJson) return emptyInventoryStateJson;
	const state = parseJson<BoardItemState>(stateJson);
	return isEmptyInventoryState(state) ? emptyInventoryStateJson : json(state);
};
