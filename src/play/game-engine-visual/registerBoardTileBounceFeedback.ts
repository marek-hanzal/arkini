import { createBoardTileBounceFeedbackRequest } from "~/play/game-engine-visual/createBoardTileBounceFeedbackRequest";
import { registerTileEngineMotionRequests } from "~/tile-engine";

export namespace registerBoardTileBounceFeedback {
	export interface Props {
		groupId: string;
		tileIds: readonly string[];
	}
}

export const registerBoardTileBounceFeedback = ({
	groupId,
	tileIds,
}: registerBoardTileBounceFeedback.Props) => {
	const uniqueTileIds = [
		...new Set(tileIds),
	];
	if (uniqueTileIds.length === 0) return;

	registerTileEngineMotionRequests({
		engineId: "board",
		requests: uniqueTileIds.map((tileId) =>
			createBoardTileBounceFeedbackRequest({
				groupId,
				tileId,
			}),
		),
	});
};
