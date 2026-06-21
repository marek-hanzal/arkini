import { type RefObject, useLayoutEffect } from "react";
import { DebugTimeline } from "~/v0/debug/DebugTimeline";
import { TileEngineTiming } from "~/v0/tile-engine/TileEngineTiming";
import type { TileFeedbackMotionSchema } from "~/v0/tile-engine/TileFeedbackMotionSchema";
import {
	cancelTileMotion,
	startTileStyleMotion,
	tileFeedbackMotionScope,
} from "~/v0/tile-engine/TileMotionRuntime";

export namespace useTileActorFeedbackMotion {
	export interface Props {
		actorRef: RefObject<HTMLDivElement | null>;
		feedback?: TileFeedbackMotionSchema.Type;
		tileId: string;
	}
}

const readActorVisual = (actor: HTMLElement | null) =>
	actor?.querySelector<HTMLElement>("[data-ak-tile-engine-visual]") ?? null;

export const useTileActorFeedbackMotion = ({
	actorRef,
	feedback,
	tileId,
}: useTileActorFeedbackMotion.Props) => {
	const kind = feedback?.kind ?? "bounce";
	const delayMs = feedback?.delayMs ?? 0;
	const durationMs = feedback?.durationMs;
	const groupId = feedback?.groupId;
	const hasFeedback = Boolean(feedback);

	useLayoutEffect(() => {
		if (!hasFeedback) return;

		const actorElement = actorRef.current;
		const element = readActorVisual(actorElement);
		if (!actorElement || !element) return;

		DebugTimeline.record({
			scope: "tile-engine",
			event: "motion.feedback.start",
			detail: {
				groupId,
				kind,
				tileId,
			},
		});

		const scope = tileFeedbackMotionScope(tileId);
		void startTileStyleMotion({
			scope,
			element,
			keyframes: {
				transform: [
					"translate3d(0px, 0px, 0px) scale(1)",
					"translate3d(0px, -1px, 0px) scale(1.1)",
					"translate3d(0px, 0px, 0px) scale(0.97)",
					"translate3d(0px, 0px, 0px) scale(1)",
				],
			},
			delay: delayMs / 1000,
			duration: (durationMs ?? 260) / 1000,
			ease: TileEngineTiming.moveEase,
			meta: {
				feedbackKind: kind,
				groupId,
				kind: "feedback",
				tileId,
			},
		}).then((result) => {
			if (result.status !== "completed") return;
			element.style.transform = "";
			DebugTimeline.record({
				scope: "tile-engine",
				event: "motion.feedback.end",
				detail: {
					groupId,
					tileId,
				},
			});
		});

		return () => {
			cancelTileMotion(scope, "feedback-cleanup");
		};
	}, [
		actorRef,
		delayMs,
		durationMs,
		groupId,
		hasFeedback,
		kind,
		tileId,
	]);
};
