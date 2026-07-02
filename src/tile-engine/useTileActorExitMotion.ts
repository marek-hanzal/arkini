import { type RefObject, useLayoutEffect } from "react";
import { findTileEngineActorById } from "~/tile-engine/findTileEngineActorById";
import { rectFromElement } from "~/tile-engine/rect";
import { targetDelta } from "~/tile-engine/targetDelta";
import { translate3d } from "~/tile-engine/TileVisualSnapshot";
import type { TileExitMotionSchema } from "~/tile-engine/TileExitMotionSchema";
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
				: kind === "flip-out"
					? {
							opacity: [
								1,
								0.42,
								0,
							],
							filter: [
								"brightness(1) drop-shadow(0 0 0 rgb(168 85 247 / 0))",
								"brightness(1.24) drop-shadow(0 14px 20px rgb(168 85 247 / 0.28))",
								"brightness(0.94) drop-shadow(0 0 0 rgb(168 85 247 / 0))",
							],
							transform: [
								"perspective(640px) translate3d(0px, 0px, 0px) rotateY(0deg) scale(1)",
								"perspective(640px) translate3d(0px, -10px, 0px) rotateY(34deg) scale(1.12)",
								"perspective(640px) translate3d(0px, 3px, 0px) rotateY(92deg) scale(0.82)",
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
		}).then((result) => {
			clearPresenceMotion();
			if (result.status !== "completed") return;
		});

		return () => {
			cancelTileMotion(scope);
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
