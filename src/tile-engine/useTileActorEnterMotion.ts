import { type RefObject, useLayoutEffect } from "react";
import type { TileEnterMotionSchema } from "~/tile-engine/TileEnterMotionSchema";
import { findTileEngineActorById } from "~/tile-engine/findTileEngineActorById";
import { rectFromElement } from "~/tile-engine/rect";
import { targetDelta } from "~/tile-engine/targetDelta";
import { translate3d } from "~/tile-engine/TileVisualSnapshot";
import {
	cancelTileMotion,
	startTileStyleMotion,
	tilePresenceMotionScope,
} from "~/tile-engine/TileMotionRuntime";
import { TileEngineTiming } from "~/tile-engine/TileEngineTiming";
import {
	createTilePresenceMotionToken,
	markTilePresenceMotion,
} from "~/tile-engine/TilePresenceMotionMarker";

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
				: kind === "flip-in"
					? {
							opacity: [
								0,
								0.72,
								1,
							],
							filter: [
								"brightness(1.18) drop-shadow(0 10px 18px rgb(255 255 255 / 0.18))",
								"brightness(1.32) drop-shadow(0 18px 24px rgb(168 85 247 / 0.36))",
								"brightness(1) drop-shadow(0 0 0 rgb(168 85 247 / 0))",
							],
							transform: [
								"perspective(640px) translate3d(0px, 5px, 0px) rotateY(-86deg) scale(0.82)",
								"perspective(640px) translate3d(0px, -12px, 0px) rotateY(-22deg) scale(1.18)",
								"perspective(640px) translate3d(0px, 0px, 0px) rotateY(0deg) scale(1)",
							],
						}
					: kind === "fade-in" || kind === "replace-in"
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
		const token = createTilePresenceMotionToken({
			groupId,
			kind: "enter",
			tileId,
		});
		const clearPresenceMotion = markTilePresenceMotion(visualElement, token);
		void startTileStyleMotion({
			scope,
			element: visualElement,
			keyframes,
			delay: delayMs / 1000,
			duration: (durationMs ?? TileEngineTiming.presenceDurationSeconds * 1000) / 1000,
			ease: TileEngineTiming.moveEase,
		}).then((result) => {
			clearPresenceMotion();
			if (result.status !== "completed") return;
			visualElement.style.filter = "";
			visualElement.style.opacity = "";
			visualElement.style.transform = "";
		});

		return () => {
			cancelTileMotion(scope);
			clearPresenceMotion();
		};
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
