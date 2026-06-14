import { mergeFx } from "~/board/fx/mergeFx";
import { runEffect } from "~/play/logic/runEffect";

export namespace merge {
	export interface Props {
		sourceBoardItemId: string;
		targetBoardItemId: string;
	}
}

export const merge = ({ sourceBoardItemId, targetBoardItemId }: merge.Props) =>
	runEffect(
		mergeFx({
			sourceBoardItemId,
			targetBoardItemId,
		}),
	);
