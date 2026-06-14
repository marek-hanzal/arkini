import type { BoardItemState } from "~/play/logic/playTypes";
import { json } from "~/shared/json";
import { parseJson } from "~/shared/parseJson";
import { emptyInventoryStateJson } from "./emptyInventoryStateJson";
import { isEmptyInventoryState } from "./isEmptyInventoryState";

export const normalizeInventoryStateJson = (stateJson: string | undefined) => {
	if (!stateJson) return emptyInventoryStateJson;
	const state = parseJson<BoardItemState>(stateJson);
	return isEmptyInventoryState(state) ? emptyInventoryStateJson : json(state);
};
