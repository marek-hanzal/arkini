import { Effect } from "effect";
import { type MotionValue, motionValue, springValue } from "motion/react";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { LocationScopeEnumSchema } from "~/bridge/tile/LocationScopeEnumSchema";
import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiTileMagneticField } from "~/ui/pixi/magnet/PixiTileMagneticField";
import { readPixiTileMagneticDisplacementFx } from "~/ui/pixi/magnet/readPixiTileMagneticDisplacementFx";
import type { DemandFrameLoop } from "~/ui/pixi/runtime/DemandFrameLoop";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";

export namespace createPixiTileMagneticFieldFx {
	export interface Props {
		readonly actorStore: PixiMainSceneActorStore;
		readonly frames: DemandFrameLoop;
		readonly surface: PixiMainSceneSurface;
	}
}

interface ActorSpring {
	readonly actor: PixiTileActor;
	readonly targetX: MotionValue<number>;
	readonly targetY: MotionValue<number>;
	readonly x: MotionValue<number>;
	readonly y: MotionValue<number>;
	readonly close: () => void;
}

const crowdSpring = {
	stiffness: 360,
	damping: 32,
	mass: 0.72,
	restDelta: 0.05,
	restSpeed: 0.05,
} as const;

/** Uses Motion springs to apply Board-only magnetic response without moving hit geometry. */
export const createPixiTileMagneticFieldFx = Effect.fn("createPixiTileMagneticFieldFx")(
	({ actorStore, frames, surface }: createPixiTileMagneticFieldFx.Props) =>
		Effect.sync((): PixiTileMagneticField => {
			const springs = new Map<string, ActorSpring>();
			let closed = false;

			const closeSpring = (spring: ActorSpring) => {
				spring.close();
				spring.x.destroy();
				spring.y.destroy();
				spring.targetX.destroy();
				spring.targetY.destroy();
				if (!spring.actor.container.destroyed) spring.actor.crowdLayer.position.set(0);
			};

			const readSpring = (actor: PixiTileActor) => {
				const existing = springs.get(actor.item.id);
				if (existing?.actor === actor) return existing;
				if (existing !== undefined) {
					closeSpring(existing);
					springs.delete(actor.item.id);
				}
				const targetX = motionValue(0);
				const targetY = motionValue(0);
				const x = springValue(targetX, crowdSpring);
				const y = springValue(targetY, crowdSpring);
				const removeX = x.on("change", (value) => {
					if (closed || actor.container.destroyed) return;
					actor.crowdLayer.x = value;
					RendererRuntime.runSync(frames.invalidateFx);
				});
				const removeY = y.on("change", (value) => {
					if (closed || actor.container.destroyed) return;
					actor.crowdLayer.y = value;
					RendererRuntime.runSync(frames.invalidateFx);
				});
				const spring = {
					actor,
					targetX,
					targetY,
					x,
					y,
					close: () => {
						removeX();
						removeY();
					},
				} satisfies ActorSpring;
				springs.set(actor.item.id, spring);
				return spring;
			};

			const removeStaleSprings = () => {
				for (const [actorId, spring] of springs) {
					if (actorStore.actors.get(actorId) === spring.actor) continue;
					springs.delete(actorId);
					closeSpring(spring);
				}
			};

			const reset = () => {
				removeStaleSprings();
				for (const spring of springs.values()) {
					spring.targetX.set(0);
					spring.targetY.set(0);
				}
			};

			return {
				pruneFx: Effect.sync(() => removeStaleSprings()),
				resetFx: Effect.sync(() => reset()),
				updateFx: Effect.fn("PixiTileMagneticField.updateFx")((sample) =>
					Effect.sync(() => {
						if (closed) return;
						removeStaleSprings();
						const sourceActor = actorStore.actors.get(sample.sourceActorId);
						if (sourceActor === undefined) {
							reset();
							return;
						}
						for (const actor of actorStore.actors.values()) {
							if (
								actor.item.id === sample.sourceActorId ||
								actor.item.location.scope !== LocationScopeEnumSchema.enum.Board
							) {
								const spring = springs.get(actor.item.id);
								spring?.targetX.set(0);
								spring?.targetY.set(0);
								continue;
							}
							const pose = RendererRuntime.runSync(
								surface.readActorPoseFx(actor.item),
							);
							if (pose === null) continue;
							const displacement = RendererRuntime.runSync(
								readPixiTileMagneticDisplacementFx({
									actorId: actor.item.id,
									actorRect: {
										height: pose.size,
										width: pose.size,
										x: pose.x,
										y: pose.y,
									},
									attractedActorId: sample.attractedActorId,
									sourceActorId: sample.sourceActorId,
									sourceDirection: sample.sourceDirection,
									sourceRect: {
										height: sourceActor.size,
										width: sourceActor.size,
										x: sample.sourceX,
										y: sample.sourceY,
									},
								}),
							);
							const spring = readSpring(actor);
							spring.targetX.set(displacement.x);
							spring.targetY.set(displacement.y);
						}
					}),
				),
				closeFx: Effect.sync(() => {
					if (closed) return;
					closed = true;
					for (const spring of springs.values()) closeSpring(spring);
					springs.clear();
				}),
			};
		}),
);
