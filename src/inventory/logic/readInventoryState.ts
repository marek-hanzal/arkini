import type { BoardItemState } from "~/play/logic/playTypes";
import { parseJson } from "~/shared/parseJson";
import { normalizeInventoryStateJson } from "./normalizeInventoryStateJson";

export const readInventoryState = (stateJson: string | undefined): BoardItemState =>
	parseJson<BoardItemState>(normalizeInventoryStateJson(stateJson));
