import type { BoardItemState } from "~/v0/board/view/BoardItemStateSchema";
import { parseJson } from "~/v0/style/parseJson";
import { normalizeInventoryStateJson } from "./normalizeInventoryStateJson";

export const readInventoryState = (stateJson: string | undefined): BoardItemState =>
	parseJson<BoardItemState>(normalizeInventoryStateJson(stateJson));
