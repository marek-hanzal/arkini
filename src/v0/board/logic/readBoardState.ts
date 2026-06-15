import type { BoardItemState } from "~/v0/board/view/BoardItemStateSchema";
import { parseJson } from "~/v0/serialization/parseJson";

export namespace readBoardState {
	export interface Row {
		stateJson: string;
	}
}

export const readBoardState = (row: Pick<readBoardState.Row, "stateJson">) =>
	parseJson<BoardItemState>(row.stateJson || "{}");
