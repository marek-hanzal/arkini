import { Effect } from "effect";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { LocationScopeEnumSchema } from "~/bridge/tile/LocationScopeEnumSchema";
import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type {
	PixiAnimationDriver,
	PixiAnimationSpring,
} from "~/ui/pixi/animation/PixiAnimationDriver";
import type {
	PixiTileMagneticField,
	PixiTileMagneticFieldSample,
	PixiTileMagneticSourceKind,
} from "~/ui/pixi/magnet/PixiTileMagneticField";
import { readPixiTileMagneticDisplacementFx } from "~/ui/pixi/magnet/readPixiTileMagneticDisplacementFx";

export namespace createPixiTileMagneticFieldFx {
	export interface Props {
		readonly actorStore: PixiMainSceneActorStore;
		readonly animationDriver: PixiAnimationDriver;
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

interface ActiveMagneticSample extends PixiTileMagneticFieldSample {
	readonly sourceKind: PixiTileMagneticSourceKind;
}

const readSourceKey = (sourceKind: PixiTileMagneticSourceKind, sourceActorId: string) =>
	`${sourceKind}:${sourceActorId}`;

/**
 * Uses one shared set of Motion springs for drag and engine-driven magnetic sources.
 *
 * Source samples compose instead of overwriting each other. Actor rectangles come from their live
 * presentation pose while offsets remain child-local, so a moving receiver cannot invert its own
 * field through stale canonical geometry.
 */
export const createPixiTileMagneticFieldFx = Effect.fn("createPixiTileMagneticFieldFx")(
	({ actorStore, animationDriver }: createPixiTileMagneticFieldFx.Props) =>
		Effect.sync((): PixiTileMagneticField => {
			const springs = new Map<string, ActorSpring>();
			const samples = new Map<string, ActiveMagneticSample>();
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
				if (!spring.actor.container.destroyed) spring.actor.offsetLayer.position.set(0);
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
							actor.offsetLayer.x = value;
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
								actor.offsetLayer.y = value;
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
				for (const [key, sample] of samples) {
					if (sample.sourceKind === "drag") samples.delete(key);
				}
				applySamples();
			};

			const readActorRect = (actor: PixiTileActor) => {
				const scale = actor.container.scale.x;
				return {
					height: actor.size * scale,
					width: actor.size * scale,
					x: actor.container.x - actor.container.pivot.x * scale,
					y: actor.container.y - actor.container.pivot.y * scale,
				};
			};

			const readSourceRect = (sample: ActiveMagneticSample) => {
				const sourceActor = actorStore.actors.get(sample.sourceActorId);
				const sourceSize =
					sample.sourceSize ??
					(sourceActor === undefined
						? null
						: sourceActor.size * sourceActor.container.scale.x);
				return sourceSize === null
					? null
					: {
							height: sourceSize,
							width: sourceSize,
							x: sample.sourceX,
							y: sample.sourceY,
						};
			};

			function applySamples() {
				removeStaleSprings();
				const activeSamples = Array.from(samples.values(), (sample) => ({
					sample,
					sourceRect: readSourceRect(sample),
				})).filter(
					(
						source,
					): source is {
						readonly sample: ActiveMagneticSample;
						readonly sourceRect: NonNullable<ReturnType<typeof readSourceRect>>;
					} => source.sourceRect !== null,
				);
				for (const actor of actorStore.actors.values()) {
					if (actor.item.location.scope !== LocationScopeEnumSchema.enum.Board) {
						const spring = springs.get(actor.item.id);
						if (spring !== undefined) {
							RendererRuntime.runSync(spring.x.setTargetFx(0));
							RendererRuntime.runSync(spring.y.setTargetFx(0));
						}
						continue;
					}
					let displacementX = 0;
					let displacementY = 0;
					const actorRect = readActorRect(actor);
					for (const { sample, sourceRect } of activeSamples) {
						const displacement = RendererRuntime.runSync(
							readPixiTileMagneticDisplacementFx({
								actorId: actor.item.id,
								actorRect,
								attractedActorId: sample.attractedActorId,
								eligibleAttractionActorIds: sample.eligibleAttractionActorIds,
								sourceActorId: sample.sourceActorId,
								sourceDirection: sample.sourceDirection,
								sourceRect,
							}),
						);
						displacementX += displacement.x;
						displacementY += displacement.y;
					}
					const spring = springs.get(actor.item.id);
					if (displacementX === 0 && displacementY === 0 && spring === undefined) {
						continue;
					}
					const activeSpring = spring ?? readSpring(actor);
					RendererRuntime.runSync(activeSpring.x.setTargetFx(displacementX));
					RendererRuntime.runSync(activeSpring.y.setTargetFx(displacementY));
				}
			}

			const release = (sourceKind: PixiTileMagneticSourceKind, sourceActorId: string) => {
				samples.delete(readSourceKey(sourceKind, sourceActorId));
				applySamples();
			};

			const update = (sample: PixiTileMagneticFieldSample) => {
				const activeSample = {
					...sample,
					sourceKind: sample.sourceKind ?? "drag",
				} satisfies ActiveMagneticSample;
				samples.set(
					readSourceKey(activeSample.sourceKind, activeSample.sourceActorId),
					activeSample,
				);
				applySamples();
			};

			const close = () => {
				if (closed) return;
				closed = true;
				samples.clear();
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
			};

			return {
				pruneFx: Effect.sync(() => removeStaleSprings()),
				releaseFx: Effect.fn("PixiTileMagneticField.releaseFx")(
					({ sourceActorId, sourceKind }) =>
						Effect.sync(() => {
							if (closed) return;
							release(sourceKind, sourceActorId);
						}),
				),
				resetFx: Effect.sync(() => reset()),
				updateFx: Effect.fn("PixiTileMagneticField.updateFx")((sample) =>
					Effect.sync(() => {
						if (closed) return;
						update(sample);
					}),
				),
				closeFx: Effect.sync(close),
			};
		}),
);
