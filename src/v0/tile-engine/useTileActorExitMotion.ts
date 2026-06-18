import { type RefObject, useLayoutEffect } from "react";
import { DebugTimeline } from "~/v0/debug/DebugTimeline";
import type { TileExitMotionSchema } from "~/v0/tile-engine/TileExitMotionSchema";
import {
	cancelTileMotion,
	startTileStyleMotion,
	tilePresenceMotionScope,
} from "~/v0/tile-engine/TileMotionRuntime";
import { TileEngineTiming } from "~/v0/tile-engine/TileEngineTiming";
import {
	createTilePresenceMotionToken,
	markTilePresenceMotion,
} from "~/v0/tile-engine/TilePresenceMotionMarker";

export namespace useTileActorExitMotion {
	export interface Props {
		actorRef: RefObject<HTMLDivElement | null>;
		exit?: TileExitMotionSchema.Type;
		tileId: string;
	}
}

const readActorVisual = (actor: HTMLElement | null) =>
	actor?.querySelector<HTMLElement>("[data-ak-tile-engine-visual]") ?? null;

export const useTileActorExitMotion = ({
	actorRef,
	exit,
	tileId,
}: useTileActorExitMotion.Props) => {
	const kind = exit?.kind ?? "merge-out";
	const delayMs = exit?.delayMs ?? 0;
	const durationMs = exit?.durationMs;
	const groupId = exit?.groupId;
	const hasExit = Boolean(exit);

	useLayoutEffect(() => {
		if (!hasExit) return;

		const element = readActorVisual(actorRef.current);
		if (!element) return;

		DebugTimeline.record({
			scope: "tile-engine",
			event: "motion.exit.start",
			detail: {
				groupId,
				kind,
				tileId,
				delayMs,
				durationMs,
			},
		});

		const scope = tilePresenceMotionScope(tileId);
		const token = createTilePresenceMotionToken({
			groupId,
			kind: "exit",
			tileId,
		});
		const clearPresenceMotion = markTilePresenceMotion(element, token);
		const keyframes =
			kind === "replace-out"
				? {
						opacity: [
							1,
							0,
						],
					}
				: {
						opacity: [
							1,
							0,
						],
						transform: [
							"translate3d(0px, 0px, 0px) scale(1)",
							"translate3d(0px, 0px, 0px) scale(0.92)",
						],
					};

		void startTileStyleMotion({
			scope,
			element,
			keyframes,
			delay: delayMs / 1000,
			duration: (durationMs ?? TileEngineTiming.presenceDurationSeconds * 1000) / 1000,
			ease: TileEngineTiming.moveEase,
			meta: {
				kind: "exit",
				exitKind: kind,
				groupId,
				tileId,
			},
		}).then((result) => {
			clearPresenceMotion();
			if (result.status !== "completed") return;
			DebugTimeline.record({
				scope: "tile-engine",
				event: "motion.exit.end",
				detail: {
					groupId,
					tileId,
				},
			});
		});

		return () => {
			cancelTileMotion(scope, "presence-exit-cleanup");
			clearPresenceMotion();
		};
	}, [
		actorRef,
		delayMs,
		durationMs,
		groupId,
		hasExit,
		kind,
		tileId,
	]);
};
