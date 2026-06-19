import { type RefObject, useEffect } from "react";
import { DebugTimeline } from "~/v0/debug/DebugTimeline";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";

export namespace useTileActorFeedbackDebug {
	export interface Props {
		actorRef: RefObject<HTMLDivElement | null>;
		dragging: boolean;
		dropFeedback: TileEngine.ActiveDropFeedback | null;
		tileId: string;
		slotId: string;
	}
}

export const useTileActorFeedbackDebug = ({
	actorRef,
	dragging,
	dropFeedback,
	tileId,
	slotId,
}: useTileActorFeedbackDebug.Props) => {
	useEffect(() => {
		if (!dragging && !dropFeedback) return;

		const visual = actorRef.current?.querySelector<HTMLElement>("[data-ak-tile-engine-visual]");
		const visualStyle = visual ? window.getComputedStyle(visual) : null;

		DebugTimeline.record({
			scope: "tile-engine",
			event: "tile.feedback.render",
			detail: {
				tileId,
				slotId,
				dragging,
				feedback: dropFeedback,
				actorDataset: actorRef.current
					? {
							dragging: actorRef.current.dataset.akTileEngineDragging,
							dropFeedback: actorRef.current.dataset.akTileEngineDropFeedback,
							dropFeedbackVariant:
								actorRef.current.dataset.akTileEngineDropFeedbackVariant,
						}
					: null,
				visualDataset: visual
					? {
							feedbackVisual: visual.dataset.akTileEngineVisual,
						}
					: null,
				visualComputed: visualStyle
					? {
							transform: visualStyle.transform,
							transitionProperty: visualStyle.transitionProperty,
							animationName: visualStyle.animationName,
						}
					: null,
			},
		});
	}, [
		actorRef,
		dragging,
		dropFeedback,
		tileId,
		slotId,
	]);
};
