import { DebugTimeline } from "~/v0/debug/DebugTimeline";
import { type RefObject, useLayoutEffect } from "react";
import type { TileEnterMotionSchema } from "~/v0/tile-engine/TileEnterMotionSchema";
import { findTileEngineActorById } from "~/v0/tile-engine/findTileEngineActorById";
import { rectFromElement } from "~/v0/tile-engine/rect";
import { targetDelta } from "~/v0/tile-engine/targetDelta";
import { translate3d } from "~/v0/tile-engine/TileVisualSnapshot";
import { startTileStyleMotion, tilePresenceMotionScope } from "~/v0/tile-engine/TileMotionRuntime";
import { TileEngineTiming } from "~/v0/tile-engine/TileEngineTiming";

export namespace useTileActorEnterMotion {
	export interface Props {
		actorRef: RefObject<HTMLDivElement | null>;
		enter?: TileEnterMotionSchema.Type;
		tileId: string;
	}
}

const readActorVisual = (actor: HTMLElement | null) =>
	actor?.querySelector<HTMLElement>("[data-ak-tile-engine-visual]") ?? null;

export const useTileActorEnterMotion = ({
	actorRef,
	enter,
	tileId,
}: useTileActorEnterMotion.Props) => {
	const kind = enter?.kind ?? "fade-in";
	const delayMs = enter?.delayMs ?? 0;
	const durationMs = enter?.durationMs;
	const fromTileId = enter?.fromTileId;
	const groupId = enter?.groupId;
	const sequenceIndex = enter?.sequenceIndex;
	const hasEnter = Boolean(enter);

	useLayoutEffect(() => {
		if (!hasEnter) return;

		const actorElement = actorRef.current;
		const visualElement = readActorVisual(actorElement);
		if (!actorElement || !visualElement) return;

		DebugTimeline.record({
			scope: "tile-engine",
			event: "motion.enter.start",
			detail: {
				kind,
				tileId,
				delayMs,
				durationMs,
				sequenceIndex,
			},
		});

		const originElement =
			fromTileId && fromTileId !== tileId ? findTileEngineActorById(fromTileId) : null;
		const spawnDelta = originElement
			? targetDelta({
					origin: rectFromElement(actorElement),
					target: rectFromElement(originElement),
				})
			: null;

		const keyframes =
			kind === "spawn-from-tile" && spawnDelta
				? {
						opacity: [
							0,
							1,
						],
						transform: [
							`${translate3d(spawnDelta.x, spawnDelta.y)} scale(0.68)`,
							"translate3d(0px, 0px, 0px) scale(1)",
						],
					}
				: kind === "fade-in"
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
									"translate3d(0px, 0px, 0px) scale(0.9)",
									"translate3d(0px, 0px, 0px) scale(1)",
								],
							}
						: {
								opacity: [
									0,
									1,
								],
								transform: [
									"translate3d(0px, 8px, 0px) scale(0.88)",
									"translate3d(0px, 0px, 0px) scale(1)",
								],
							};

		const scope = tilePresenceMotionScope(tileId);
		visualElement.dataset.akTileEnginePresenceMotion = "true";
		void startTileStyleMotion({
			scope,
			element: visualElement,
			keyframes,
			delay: delayMs / 1000,
			duration: (durationMs ?? TileEngineTiming.presenceDurationSeconds * 1000) / 1000,
			ease: TileEngineTiming.moveEase,
			meta: {
				kind: "enter",
				enterKind: kind,
				fromTileId,
				groupId,
				sequenceIndex,
				tileId,
			},
		}).then((result) => {
			delete visualElement.dataset.akTileEnginePresenceMotion;
			if (result.status !== "completed") return;
			visualElement.style.opacity = "";
			visualElement.style.transform = "";
			DebugTimeline.record({
				scope: "tile-engine",
				event: "motion.enter.end",
				detail: {
					groupId,
					tileId,
				},
			});
		});
	}, [
		actorRef,
		delayMs,
		durationMs,
		fromTileId,
		groupId,
		hasEnter,
		kind,
		sequenceIndex,
		tileId,
	]);
};
