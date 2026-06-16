import { animate } from "motion";
import { DebugTimeline } from "~/v0/debug/DebugTimeline";
import { type RefObject, useLayoutEffect, useRef } from "react";
import type { TileEnterMotionSchema } from "~/v0/tile-engine/TileEnterMotionSchema";
import { TileEngineTiming } from "~/v0/tile-engine/TileEngineTiming";

export namespace useTileActorEnterMotion {
	export interface Props {
		actorRef: RefObject<HTMLDivElement | null>;
		enter?: TileEnterMotionSchema.Type;
		tileId: string;
	}
}

export const useTileActorEnterMotion = ({
	actorRef,
	enter,
	tileId,
}: useTileActorEnterMotion.Props) => {
	const lastEnterKeyRef = useRef<string | null>(null);

	useLayoutEffect(() => {
		if (!enter) {
			lastEnterKeyRef.current = null;
			return;
		}

		const enterKey = [
			enter.groupId ?? "group:none",
			enter.kind ?? "fade-in",
			enter.delayMs ?? 0,
			enter.durationMs ?? "duration:default",
		].join(":");
		if (lastEnterKeyRef.current === enterKey) return;
		lastEnterKeyRef.current = enterKey;

		const element = actorRef.current;
		if (!element) return;

		const kind = enter.kind ?? "fade-in";
		DebugTimeline.record({
			scope: "tile-engine",
			event: "motion.enter.start",
			detail: {
				kind,
				tileId,
				delayMs: enter.delayMs ?? 0,
				durationMs: enter.durationMs,
			},
		});

		const keyframes =
			kind === "fade-in"
				? {
						opacity: [
							0,
							1,
						],
					}
				: kind === "merge-in"
					? {
							opacity: [
								0,
								1,
							],
							transform: [
								"translate3d(0px, 0px, 0px) scale(0.72)",
								"translate3d(0px, 0px, 0px) scale(1)",
							],
						}
					: {
							opacity: [
								0,
								1,
							],
							transform: [
								"translate3d(0px, 8px, 0px) scale(0.72)",
								"translate3d(0px, 0px, 0px) scale(1)",
							],
						};

		void animate(element, keyframes, {
			delay: (enter.delayMs ?? 0) / 1000,
			duration: (enter.durationMs ?? TileEngineTiming.moveDurationSeconds * 1000) / 1000,
			ease: TileEngineTiming.moveEase,
		}).then(() =>
			DebugTimeline.record({
				scope: "tile-engine",
				event: "motion.enter.end",
				detail: {
					groupId: enter.groupId,
					tileId,
				},
			}),
		);
	}, [
		actorRef,
		enter,
		tileId,
	]);
};
