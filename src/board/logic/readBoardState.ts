import type { BoardItemState } from "~/play/logic/playTypes";
import { parseJson } from "~/shared/parseJson";

export namespace readBoardState {
	export interface Row {
		stateJson: string;
	}
}

export const readBoardState = (row: Pick<readBoardState.Row, "stateJson">) =>
	parseJson<BoardItemState>(row.stateJson || "{}");
