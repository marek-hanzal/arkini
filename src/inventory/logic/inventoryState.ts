import type { BoardItemState } from "~/play/logic/playTypes";
import { json, parseJson } from "~/shared/json";

export const emptyInventoryStateJson = json({});

export function isEmptyInventoryStateJson(stateJson: string | undefined) {
	return normalizeInventoryStateJson(stateJson) === emptyInventoryStateJson;
}

export function normalizeInventoryStateJson(stateJson: string | undefined) {
	if (!stateJson) return emptyInventoryStateJson;
	const state = parseJson<BoardItemState>(stateJson);
	return isEmptyInventoryState(state) ? emptyInventoryStateJson : json(state);
}

export function readInventoryState(stateJson: string | undefined): BoardItemState {
	return parseJson<BoardItemState>(normalizeInventoryStateJson(stateJson));
}

export function isEmptyInventoryState(state: BoardItemState) {
	return Object.keys(state).length === 0;
}
