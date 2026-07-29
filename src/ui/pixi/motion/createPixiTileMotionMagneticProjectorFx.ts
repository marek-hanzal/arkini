import { Effect } from "effect";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiActorPresentedPose } from "~/ui/pixi/animation/PixiActorAnimator";
import type { PixiTileMagneticField } from "~/ui/pixi/magnet/PixiTileMagneticField";

export namespace createPixiTileMotionMagneticProjectorFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly attractedActorId: string | null;
		readonly eligibleAttractionActorIds: ReadonlySet<string>;
		readonly magneticField: PixiTileMagneticField;
		readonly readAttraction?: () => {
			readonly attractedActorId: string | null;
			readonly eligibleAttractionActorIds: ReadonlySet<string>;
		};
	}

	export interface Result {
		readonly projectPose: (pose: PixiActorPresentedPose) => void;
		readonly release: () => void;
	}
}

/**
 * Projects one engine-owned pose through the same shared magnetic field as direct drag.
 *
 * The first presented frame acquires a keyed motion source. Release is idempotent so natural
 * settlement, interaction handoff, actor disappearance, and runtime teardown can race safely.
 */
export const createPixiTileMotionMagneticProjectorFx = Effect.fn(
	"createPixiTileMotionMagneticProjectorFx",
)(
	({
		actor,
		attractedActorId,
		eligibleAttractionActorIds,
		magneticField,
		readAttraction,
	}: createPixiTileMotionMagneticProjectorFx.Props) =>
		Effect.sync((): createPixiTileMotionMagneticProjectorFx.Result => {
			const sourceActorId = actor.item.id;
			let acquired = false;
			let previousPose = {
				scaleX: actor.container.scale.x,
				scaleY: actor.container.scale.y,
				x: actor.container.x - actor.container.pivot.x * actor.container.scale.x,
				y: actor.container.y - actor.container.pivot.y * actor.container.scale.y,
			};
			return {
				projectPose: (pose) => {
					const scaleX = pose.scaleX ?? pose.scale ?? previousPose.scaleX;
					const scaleY = pose.scaleY ?? pose.scale ?? previousPose.scaleY;
					const sourcePose = {
						scaleX,
						scaleY,
						x: pose.x - actor.container.pivot.x * scaleX,
						y: pose.y - actor.container.pivot.y * scaleY,
					};
					const travel = {
						x: sourcePose.x - previousPose.x,
						y: sourcePose.y - previousPose.y,
					};
					const travelMagnitude = Math.hypot(travel.x, travel.y);
					if (!acquired) {
						acquired = true;
					}
					const attraction = readAttraction?.() ?? {
						attractedActorId,
						eligibleAttractionActorIds,
					};
					RendererRuntime.runSync(
						magneticField.updateFx({
							attractedActorId: attraction.attractedActorId,
							eligibleAttractionActorIds: attraction.eligibleAttractionActorIds,
							sourceActorId,
							sourceDirection:
								travelMagnitude <= 0.001
									? null
									: {
											x: travel.x / travelMagnitude,
											y: travel.y / travelMagnitude,
										},
							sourceItem: actor.item,
							sourceKind: "motion",
							sourceHeight: actor.height * scaleY,
							sourceWidth: actor.width * scaleX,
							sourceX: sourcePose.x,
							sourceY: sourcePose.y,
						}),
					);
					previousPose = sourcePose;
				},
				release: () => {
					if (!acquired) return;
					acquired = false;
					RendererRuntime.runSync(
						magneticField.releaseFx({
							sourceActorId,
							sourceKind: "motion",
						}),
					);
				},
			};
		}),
);
