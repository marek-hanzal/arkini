import { swapFx } from "~/board/fx/swapFx";
import { runEffect } from "~/play/logic/runEffect";

export namespace swap {
	export interface Props {
		sourceBoardItemId: string;
		targetBoardItemId: string;
	}
}

export const swap = ({ sourceBoardItemId, targetBoardItemId }: swap.Props) =>
	runEffect(
		swapFx({
			sourceBoardItemId,
			targetBoardItemId,
		}),
	);
