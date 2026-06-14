import { mergeFx } from "~/board/fx/mergeFx";
import { moveFx } from "~/board/fx/moveFx";
import { swapFx } from "~/board/fx/swapFx";
import { runEffect } from "~/play/logic/runEffect";

export namespace moveBoardItem {
	export interface Props {
		boardItemId: string;
		x: number;
		y: number;
	}
}

export const moveBoardItem = ({ boardItemId, x, y }: moveBoardItem.Props) =>
	runEffect(
		moveFx({
			boardItemId,
			x,
			y,
		}),
	);

export namespace swapBoardItems {
	export interface Props {
		sourceBoardItemId: string;
		targetBoardItemId: string;
	}
}

export const swapBoardItems = ({ sourceBoardItemId, targetBoardItemId }: swapBoardItems.Props) =>
	runEffect(
		swapFx({
			sourceBoardItemId,
			targetBoardItemId,
		}),
	);

export namespace mergeBoardItems {
	export interface Props {
		sourceBoardItemId: string;
		targetBoardItemId: string;
	}
}

export const mergeBoardItems = ({ sourceBoardItemId, targetBoardItemId }: mergeBoardItems.Props) =>
	runEffect(
		mergeFx({
			sourceBoardItemId,
			targetBoardItemId,
		}),
	);
