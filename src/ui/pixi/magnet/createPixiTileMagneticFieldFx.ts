import { Effect } from "effect";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { LocationScopeEnumSchema } from "~/bridge/tile/LocationScopeEnumSchema";
import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type {
	PixiAnimationDriver,
	PixiAnimationSpring,
} from "~/ui/pixi/animation/PixiAnimationDriver";
import type { PixiTileMagneticField } from "~/ui/pixi/magnet/PixiTileMagneticField";
import { readPixiTileMagneticDisplacementFx } from "~/ui/pixi/magnet/readPixiTileMagneticDisplacementFx";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";

export namespace createPixiTileMagneticFieldFx {
	export interface Props {
		readonly actorStore: PixiMainSceneActorStore;
		readonly animationDriver: PixiAnimationDriver;
		readonly surface: PixiMainSceneSurface;
	}
}

interface ActorSpring {
	readonly actor: PixiTileActor;
	readonly x: PixiAnimationSpring;
	readonly y: PixiAnimationSpring;
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
	({ actorStore, animationDriver, surface }: createPixiTileMagneticFieldFx.Props) =>
		Effect.sync((): PixiTileMagneticField => {
			const springs = new Map<string, ActorSpring>();
			let closed = false;

			const closeSpring = (spring: ActorSpring) => {
				const failures: unknown[] = [];
				for (const closeFx of [
					spring.x.closeFx,
					spring.y.closeFx,
				]) {
					try {
						RendererRuntime.runSync(closeFx);
					} catch (cause) {
						failures.push(cause);
					}
				}
				if (!spring.actor.container.destroyed) spring.actor.crowdLayer.position.set(0);
				if (failures.length > 0) {
					throw new AggregateError(failures, "Pixi magnetic spring cleanup failed.");
				}
			};

			const readSpring = (actor: PixiTileActor) => {
				const existing = springs.get(actor.item.id);
				if (existing?.actor === actor) return existing;
				if (existing !== undefined) {
					springs.delete(actor.item.id);
					closeSpring(existing);
				}
				const x = RendererRuntime.runSync(
					animationDriver.createSpringFx({
						initialValue: 0,
						onUpdate: (value) => {
							if (closed || actor.container.destroyed) return;
							actor.crowdLayer.x = value;
						},
						options: crowdSpring,
					}),
				);
				let y: PixiAnimationSpring;
				try {
					y = RendererRuntime.runSync(
						animationDriver.createSpringFx({
							initialValue: 0,
							onUpdate: (value) => {
								if (closed || actor.container.destroyed) return;
								actor.crowdLayer.y = value;
							},
							options: crowdSpring,
						}),
					);
				} catch (cause) {
					RendererRuntime.runSync(x.closeFx);
					throw cause;
				}
				const spring = {
					actor,
					x,
					y,
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
					RendererRuntime.runSync(spring.x.setTargetFx(0));
					RendererRuntime.runSync(spring.y.setTargetFx(0));
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
								if (spring !== undefined) {
									RendererRuntime.runSync(spring.x.setTargetFx(0));
									RendererRuntime.runSync(spring.y.setTargetFx(0));
								}
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
									eligibleAttractionActorIds: sample.eligibleAttractionActorIds,
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
							RendererRuntime.runSync(spring.x.setTargetFx(displacement.x));
							RendererRuntime.runSync(spring.y.setTargetFx(displacement.y));
						}
					}),
				),
				closeFx: Effect.sync(() => {
					if (closed) return;
					closed = true;
					const failures: unknown[] = [];
					for (const spring of springs.values()) {
						try {
							closeSpring(spring);
						} catch (cause) {
							failures.push(cause);
						}
					}
					springs.clear();
					if (failures.length > 0) {
						throw new AggregateError(failures, "Pixi magnetic field cleanup failed.");
					}
				}),
			};
		}),
);
