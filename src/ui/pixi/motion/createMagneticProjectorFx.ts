import { Effect } from "effect";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiActorPresentedPose } from "~/ui/pixi/animation/PixiActorAnimator";
import type { PixiTileMagneticField } from "~/ui/pixi/magnet/PixiTileMagneticField";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";

export namespace createMagneticProjectorFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly attractedActorId: string | null;
		readonly eligibleAttractionActorIds: ReadonlySet<string>;
		readonly magneticField: PixiTileMagneticField;
		readonly surface: PixiMainSceneSurface;
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
export const createMagneticProjectorFx = Effect.fn("createMagneticProjectorFx")(
	({
		actor,
		attractedActorId,
		eligibleAttractionActorIds,
		magneticField,
		readAttraction,
		surface,
	}: createMagneticProjectorFx.Props) =>
		Effect.sync((): createMagneticProjectorFx.Result => {
			const sourceActorId = actor.item.id;
			let acquired = false;
			let released = false;
			let previousPose = {
				scale: actor.container.scale.x,
				x: actor.container.x - actor.container.pivot.x * actor.container.scale.x,
				y: actor.container.y - actor.container.pivot.y * actor.container.scale.y,
			};
			return {
				projectPose: (pose) => {
					if (released) return;
					const scale = pose.scale ?? previousPose.scale;
					const sourcePose = {
						scale,
						x: pose.x - actor.container.pivot.x * scale,
						y: pose.y - actor.container.pivot.y * scale,
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
							candidateActorIds: RendererRuntime.runSync(
								surface.readLocalActorIdsFx({
									excludeActorId: sourceActorId,
									height: actor.size * scale,
									paddingRatio: 1.5,
									width: actor.size * scale,
									x: sourcePose.x,
									y: sourcePose.y,
								}),
							),
							eligibleAttractionActorIds: attraction.eligibleAttractionActorIds,
							sourceActorId,
							sourceInstanceId: actor.instanceId,
							sourceDirection:
								travelMagnitude <= 0.001
									? null
									: {
											x: travel.x / travelMagnitude,
											y: travel.y / travelMagnitude,
										},
							sourceKind: "motion",
							sourceSize: actor.size * scale,
							sourceX: sourcePose.x,
							sourceY: sourcePose.y,
						}),
					);
					previousPose = sourcePose;
				},
				release: () => {
					if (released) return;
					released = true;
					if (!acquired) return;
					acquired = false;
					RendererRuntime.runSync(
						magneticField.releaseFx({
							sourceActorId,
							sourceInstanceId: actor.instanceId,
							sourceKind: "motion",
						}),
					);
				},
			};
		}),
);
