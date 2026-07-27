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
import { readPixiTileMagneticDisplacement } from "~/ui/pixi/magnet/readPixiTileMagneticDisplacementFx";

export namespace createPixiTileMagneticFieldFx {
	export interface Props {
		readonly actorStore: PixiMainSceneActorStore;
		readonly animationDriver: PixiAnimationDriver;
		readonly scheduleApply?: (apply: () => void) => void;
	}
}

interface ActorSpring {
	readonly actor: PixiTileActor;
	targetX: number;
	targetY: number;
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
	({
		actorStore,
		animationDriver,
		scheduleApply = queueMicrotask,
	}: createPixiTileMagneticFieldFx.Props) =>
		Effect.sync((): PixiTileMagneticField => {
			const springs = new Map<string, ActorSpring>();
			const samples = new Map<string, ActiveMagneticSample>();
			let applyScheduled = false;
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
					targetX: 0,
					targetY: 0,
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
				let released = false;
				for (const [key, sample] of samples) {
					if (sample.sourceKind !== "drag") continue;
					samples.delete(key);
					released = true;
				}
				if (released) requestApply();
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

			const setSpringTarget = (
				spring: ActorSpring,
				displacementX: number,
				displacementY: number,
			) => {
				if (spring.targetX !== displacementX) {
					spring.targetX = displacementX;
					RendererRuntime.runSync(spring.x.setTargetFx(displacementX));
				}
				if (spring.targetY !== displacementY) {
					spring.targetY = displacementY;
					RendererRuntime.runSync(spring.y.setTargetFx(displacementY));
				}
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
						if (spring !== undefined) setSpringTarget(spring, 0, 0);
						continue;
					}
					let displacementX = 0;
					let displacementY = 0;
					const actorRect = readActorRect(actor);
					for (const { sample, sourceRect } of activeSamples) {
						const displacement = readPixiTileMagneticDisplacement({
							actorId: actor.item.id,
							actorRect,
							attractedActorId: sample.attractedActorId,
							eligibleAttractionActorIds: sample.eligibleAttractionActorIds,
							sourceActorId: sample.sourceActorId,
							sourceDirection: sample.sourceDirection,
							sourceRect,
						});
						displacementX += displacement.x;
						displacementY += displacement.y;
					}
					const spring = springs.get(actor.item.id);
					if (displacementX === 0 && displacementY === 0 && spring === undefined) {
						continue;
					}
					const activeSpring = spring ?? readSpring(actor);
					setSpringTarget(activeSpring, displacementX, displacementY);
				}
			}

			function requestApply() {
				if (closed || applyScheduled) return;
				applyScheduled = true;
				try {
					scheduleApply(() => {
						applyScheduled = false;
						if (!closed) applySamples();
					});
				} catch (cause) {
					applyScheduled = false;
					throw cause;
				}
			}

			const release = (sourceKind: PixiTileMagneticSourceKind, sourceActorId: string) => {
				if (samples.delete(readSourceKey(sourceKind, sourceActorId))) requestApply();
			};

			const releaseSources = (sourceKind: PixiTileMagneticSourceKind) => {
				let released = false;
				for (const [key, sample] of samples) {
					if (sample.sourceKind !== sourceKind) continue;
					samples.delete(key);
					released = true;
				}
				if (released) requestApply();
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
				requestApply();
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
				releaseSourcesFx: Effect.fn("PixiTileMagneticField.releaseSourcesFx")(
					(sourceKind) =>
						Effect.sync(() => {
							if (closed) return;
							releaseSources(sourceKind);
						}),
				),
				resetFx: Effect.sync(() => reset()),
				updateFx: Effect.fnUntraced(function* (sample) {
					if (closed) return;
					update(sample);
				}),
				closeFx: Effect.sync(close),
			};
		}),
);
