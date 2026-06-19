import { useEffect, type RefObject } from "react";
import { DebugTimeline } from "~/v0/debug/DebugTimeline";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";

export namespace useTileSlotFeedbackDebug {
	export interface Props<TTile> {
		ref: RefObject<HTMLDivElement | null>;
		slotId: string;
		dropId: string;
		isOver: boolean;
		slotFeedback: TileEngine.ActiveDropFeedback | null;
		targetTile?: TileEngine.Tile<TTile>;
	}
}

export const useTileSlotFeedbackDebug = <TTile>({
	ref,
	slotId,
	dropId,
	isOver,
	slotFeedback,
	targetTile,
}: useTileSlotFeedbackDebug.Props<TTile>) => {
	useEffect(() => {
		if (!slotFeedback) return;

		DebugTimeline.record({
			scope: "tile-engine",
			event: "slot.feedback.render",
			detail: {
				slotId,
				dropId,
				isOver,
				feedback: slotFeedback,
				targetTileId: targetTile?.id,
				slotDataset: ref.current
					? {
							dropFeedback: ref.current.dataset.akTileEngineDropFeedback,
							dropFeedbackVariant:
								ref.current.dataset.akTileEngineDropFeedbackVariant,
						}
					: null,
			},
		});
	}, [
		dropId,
		isOver,
		ref,
		slotFeedback,
		slotId,
		targetTile?.id,
	]);
};
