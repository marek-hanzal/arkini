import { animate } from "motion";
import { type RefObject, useLayoutEffect, useRef } from "react";
import { DebugTimeline } from "~/v0/debug/DebugTimeline";
import type { TileExitMotionSchema } from "~/v0/tile-engine/TileExitMotionSchema";
import { TileEngineTiming } from "~/v0/tile-engine/TileEngineTiming";

export namespace useTileActorExitMotion {
	export interface Props {
		actorRef: RefObject<HTMLDivElement | null>;
		exit?: TileExitMotionSchema.Type;
		tileId: string;
	}
}

export const useTileActorExitMotion = ({
	actorRef,
	exit,
	tileId,
}: useTileActorExitMotion.Props) => {
	const lastExitKeyRef = useRef<string | null>(null);

	useLayoutEffect(() => {
		if (!exit) {
			lastExitKeyRef.current = null;
			return;
		}

		const exitKey = [
			exit.groupId ?? "group:none",
			exit.kind ?? "merge-out",
			exit.delayMs ?? 0,
			exit.durationMs ?? "duration:default",
		].join(":");
		if (lastExitKeyRef.current === exitKey) return;
		lastExitKeyRef.current = exitKey;

		const element = actorRef.current;
		if (!element) return;

		const kind = exit.kind ?? "merge-out";
		DebugTimeline.record({
			scope: "tile-engine",
			event: "motion.exit.start",
			detail: {
				groupId: exit.groupId,
				kind,
				tileId,
				delayMs: exit.delayMs ?? 0,
				durationMs: exit.durationMs,
			},
		});

		void animate(
			element,
			{
				opacity: [
					1,
					0,
				],
				transform: [
					"translate3d(0px, 0px, 0px) scale(1)",
					"translate3d(0px, 0px, 0px) scale(0.72)",
				],
			},
			{
				delay: (exit.delayMs ?? 0) / 1000,
				duration: (exit.durationMs ?? TileEngineTiming.moveDurationSeconds * 1000) / 1000,
				ease: TileEngineTiming.moveEase,
			},
		).then(() =>
			DebugTimeline.record({
				scope: "tile-engine",
				event: "motion.exit.end",
				detail: {
					groupId: exit.groupId,
					tileId,
				},
			}),
		);
	}, [
		actorRef,
		exit,
		tileId,
	]);
};
