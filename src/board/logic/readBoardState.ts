import type { BoardItemState } from "~/board/view/BoardItemStateSchema";
import { parseJson } from "~/shared/parseJson";

export namespace readBoardState {
	export interface Row {
		stateJson: string;
	}
}

export const readBoardState = (row: Pick<readBoardState.Row, "stateJson">) =>
	parseJson<BoardItemState>(row.stateJson || "{}");
