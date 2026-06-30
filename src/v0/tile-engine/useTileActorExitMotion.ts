import { type RefObject, useLayoutEffect } from "react";
import { DebugTimeline } from "~/v0/diagnostics/DebugTimeline";
import { findTileEngineActorById } from "~/v0/tile-engine/findTileEngineActorById";
import { rectFromElement } from "~/v0/tile-engine/rect";
import { targetDelta } from "~/v0/tile-engine/targetDelta";
import { translate3d } from "~/v0/tile-engine/TileVisualSnapshot";
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
	const toTileId = exit?.toTileId;
	const hasExit = Boolean(exit);

	useLayoutEffect(() => {
		if (!hasExit) return;

		const actorElement = actorRef.current;
		const element = readActorVisual(actorElement);
		if (!actorElement || !element) return;

		DebugTimeline.record({
			scope: "tile-engine",
			event: "motion.exit.start",
			detail: {
				groupId,
				kind,
				tileId,
				delayMs,
				durationMs,
				toTileId,
			},
		});

		const scope = tilePresenceMotionScope(tileId);
		const token = createTilePresenceMotionToken({
			groupId,
			kind: "exit",
			tileId,
		});
		const clearPresenceMotion = markTilePresenceMotion(element, token);
		const targetElement =
			toTileId && toTileId !== tileId ? findTileEngineActorById(toTileId) : null;
		const flyDelta = targetElement
			? targetDelta({
					origin: rectFromElement(actorElement),
					target: rectFromElement(targetElement),
				})
			: null;
		const keyframes =
			kind === "fly-to-tile" && flyDelta
				? {
						opacity: [
							1,
							0.95,
							0,
						],
						transform: [
							"translate3d(0px, 0px, 0px) scale(1)",
							`${translate3d(flyDelta.x * 0.72, flyDelta.y * 0.72)} scale(0.82)`,
							`${translate3d(flyDelta.x, flyDelta.y)} scale(0.5)`,
						],
					}
				: kind === "replace-out"
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
				toTileId,
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
		toTileId,
	]);
};
