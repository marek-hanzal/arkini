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
	const pulseCount = feedback?.pulseCount ?? 1;

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
		const filterPattern = [
			"brightness(1) drop-shadow(0 0 0 rgb(168 85 247 / 0))",
			"brightness(1.32) drop-shadow(0 13px 18px rgb(168 85 247 / 0.42))",
			"brightness(1.08) drop-shadow(0 3px 6px rgb(168 85 247 / 0.2))",
			"brightness(1.26) drop-shadow(0 10px 14px rgb(168 85 247 / 0.34))",
			"brightness(1.1) drop-shadow(0 4px 7px rgb(168 85 247 / 0.18))",
			"brightness(1) drop-shadow(0 0 0 rgb(168 85 247 / 0))",
		];
		const transformPattern = [
			"translate3d(0px, 0px, 0px) scale(1)",
			"translate3d(0px, -8px, 0px) scale(1.4)",
			"translate3d(0px, 3px, 0px) scale(0.88)",
			"translate3d(0px, -4px, 0px) scale(1.2)",
			"translate3d(0px, 1px, 0px) scale(0.97)",
			"translate3d(0px, 0px, 0px) scale(1)",
		];
		const expandPulsePattern = (pattern: readonly string[]) =>
			Array.from({
				length: pulseCount,
			}).flatMap((_, index) => (index === 0 ? pattern : pattern.slice(1)));

		void startTileStyleMotion({
			scope,
			element,
			keyframes: {
				filter: expandPulsePattern(filterPattern),
				transform: expandPulsePattern(transformPattern),
			},
			delay: delayMs / 1000,
			duration:
				((durationMs ?? TileEngineTiming.feedbackDurationSeconds * 1000) * pulseCount) /
				1000,
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
		pulseCount,
		tileId,
	]);
};
