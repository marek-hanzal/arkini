import { createBoardTileBounceFeedbackRequest } from "~/v0/play/game-engine-visual/createBoardTileBounceFeedbackRequest";
import { registerTileEngineMotionRequests } from "~/v0/tile-engine";

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
