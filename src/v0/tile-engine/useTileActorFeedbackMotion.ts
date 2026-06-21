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
				filter: [
					"brightness(1) drop-shadow(0 0 0 rgb(168 85 247 / 0))",
					"brightness(1.22) drop-shadow(0 10px 14px rgb(168 85 247 / 0.32))",
					"brightness(1.12) drop-shadow(0 5px 8px rgb(168 85 247 / 0.22))",
					"brightness(1.16) drop-shadow(0 7px 10px rgb(168 85 247 / 0.26))",
					"brightness(1) drop-shadow(0 0 0 rgb(168 85 247 / 0))",
				],
				transform: [
					"translate3d(0px, 0px, 0px) scale(1)",
					"translate3d(0px, -6px, 0px) scale(1.34)",
					"translate3d(0px, 2px, 0px) scale(0.9)",
					"translate3d(0px, -2px, 0px) scale(1.12)",
					"translate3d(0px, 0px, 0px) scale(1)",
				],
			},
			delay: delayMs / 1000,
			duration: (durationMs ?? TileEngineTiming.feedbackDurationSeconds * 1000) / 1000,
			ease: TileEngineTiming.moveEase,
			meta: {
				feedbackKind: kind,
				groupId,
				kind: "feedback",
				tileId,
			},
		}).then((result) => {
			if (result.status !== "completed") return;
			element.style.filter = "";
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
