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

export namespace createMagneticFieldFx {
	export interface Props {
		readonly actorStore: PixiMainSceneActorStore;
		readonly animationDriver: PixiAnimationDriver;
		/** Injectable structural counters for focused performance tests. */
		readonly onApply?: () => void;
		readonly onDisplacementEvaluation?: (actorId: string, sourceActorId: string) => void;
		readonly onSpringTargetWrite?: (actorId: string) => void;
		readonly scheduleApply: (apply: () => void) => () => void;
	}
}

interface MagneticRect {
	readonly height: number;
	readonly width: number;
	readonly x: number;
	readonly y: number;
}

interface MagneticDisplacementProps {
	readonly actorId: string;
	readonly actorRect: MagneticRect;
	readonly attractedActorId: string | null;
	readonly eligibleAttractionActorIds: ReadonlySet<string>;
	readonly sourceActorId: string;
	readonly sourceDirection: {
		readonly x: number;
		readonly y: number;
	} | null;
	readonly sourceRect: MagneticRect;
}

const attractionDisplacementRatio = 0.045;
const influenceRadiusRatio = 1.5;
const minimumDirectionMagnitude = 0.001;
const repulsionDisplacementRatio = 0.14;

const readStableDirection = (actorId: string, sourceActorId: string) => {
	let hash = 2166136261;
	for (const character of `${sourceActorId}\u0000${actorId}`) {
		hash ^= character.charCodeAt(0);
		hash = Math.imul(hash, 16777619);
	}
	const angle = ((hash >>> 0) / 4_294_967_295) * Math.PI * 2;
	return {
		x: Math.cos(angle),
		y: Math.sin(angle),
	};
};

const readMagneticDisplacement = ({
	actorId,
	actorRect,
	attractedActorId,
	eligibleAttractionActorIds,
	sourceActorId,
	sourceDirection,
	sourceRect,
}: MagneticDisplacementProps) => {
	if (actorId === sourceActorId)
		return {
			x: 0,
			y: 0,
		};
	const attracted = attractedActorId === actorId;
	if (!attracted && eligibleAttractionActorIds.has(actorId))
		return {
			x: 0,
			y: 0,
		};
	const relative = {
		x: actorRect.x + actorRect.width / 2 - (sourceRect.x + sourceRect.width / 2),
		y: actorRect.y + actorRect.height / 2 - (sourceRect.y + sourceRect.height / 2),
	};
	const distance = Math.hypot(relative.x, relative.y);
	const influenceRadius =
		Math.max(sourceRect.width, sourceRect.height, actorRect.width, actorRect.height) *
		influenceRadiusRatio;
	if (influenceRadius <= 0 || distance >= influenceRadius)
		return {
			x: 0,
			y: 0,
		};

	const direction =
		distance > minimumDirectionMagnitude
			? {
					x: relative.x / distance,
					y: relative.y / distance,
				}
			: attracted
				? {
						x: 0,
						y: 0,
					}
				: (sourceDirection ?? readStableDirection(actorId, sourceActorId));
	const proximity = 1 - distance / influenceRadius;
	const smoothProximity = proximity * proximity * (3 - 2 * proximity);
	const maximumDisplacement =
		Math.min(actorRect.width, actorRect.height) *
		(attracted ? attractionDisplacementRatio : repulsionDisplacementRatio);
	const magnitude = maximumDisplacement * smoothProximity * (attracted ? -1 : 1);
	return {
		x: direction.x * magnitude,
		y: direction.y * magnitude,
	};
};

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

const compareText = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);

const compareSource = (left: ActiveMagneticSample, right: ActiveMagneticSample) =>
	compareText(left.sourceKind, right.sourceKind) ||
	compareText(left.sourceActorId, right.sourceActorId) ||
	compareText(left.sourceInstanceId, right.sourceInstanceId);

const readSourceKey = (
	sourceKind: PixiTileMagneticSourceKind,
	sourceActorId: string,
	sourceInstanceId: string,
) =>
	JSON.stringify([
		sourceKind,
		sourceActorId,
		sourceInstanceId,
	]);

/**
 * Uses one shared set of Motion springs for drag and engine-driven magnetic sources.
 *
 * Source samples compose instead of overwriting each other. Actor rectangles come from their live
 * presentation pose while offsets remain child-local, so a moving receiver cannot invert its own
 * field through stale canonical geometry.
 */
export const createMagneticFieldFx = Effect.fn("createMagneticFieldFx")(
	({
		actorStore,
		animationDriver,
		onApply,
		onDisplacementEvaluation,
		onSpringTargetWrite,
		scheduleApply,
	}: createMagneticFieldFx.Props) =>
		Effect.sync((): PixiTileMagneticField => {
			const springs = new Map<string, ActorSpring>();
			const samples = new Map<string, ActiveMagneticSample>();
			const sourceMembershipListeners = new Set<
				(sourceKind: PixiTileMagneticSourceKind) => void
			>();
			let affectedActorIds = new Set<string>();
			let cancelScheduledApply: (() => void) | null = null;
			let closed = false;
			let dirty = false;
			let scheduleGeneration = 0;

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
					affectedActorIds.delete(actorId);
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
				if (spring.targetX !== displacementX || spring.targetY !== displacementY) {
					onSpringTargetWrite?.(spring.actor.item.id);
				}
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
				onApply?.();
				const activeSamples = Array.from(samples.values())
					.sort(compareSource)
					.map((sample) => ({
						sample,
						sourceRect: readSourceRect(sample),
					}))
					.filter(
						(
							source,
						): source is {
							readonly sample: ActiveMagneticSample;
							readonly sourceRect: NonNullable<ReturnType<typeof readSourceRect>>;
						} => source.sourceRect !== null,
					);
				const activeSourceActorIds = new Set(
					activeSamples.map(({ sample }) => sample.sourceActorId),
				);
				const actorRects = new Map<string, ReturnType<typeof readActorRect>>();
				const displacements = new Map<
					string,
					{
						x: number;
						y: number;
					}
				>();
				for (const { sample, sourceRect } of activeSamples) {
					const candidateActorIds = new Set(sample.candidateActorIds);
					for (const sourceActorId of activeSourceActorIds) {
						candidateActorIds.add(sourceActorId);
					}
					if (sample.attractedActorId !== null) {
						candidateActorIds.add(sample.attractedActorId);
					}
					for (const actorId of Array.from(candidateActorIds).sort()) {
						if (actorId === sample.sourceActorId) continue;
						const actor = actorStore.actors.get(actorId);
						if (
							actor === undefined ||
							actor.item.location.scope !== LocationScopeEnumSchema.enum.Board
						) {
							continue;
						}
						let actorRect = actorRects.get(actorId);
						if (actorRect === undefined) {
							actorRect = readActorRect(actor);
							actorRects.set(actorId, actorRect);
						}
						onDisplacementEvaluation?.(actorId, sample.sourceActorId);
						const displacement = readMagneticDisplacement({
							actorId,
							actorRect,
							attractedActorId: sample.attractedActorId,
							eligibleAttractionActorIds: sample.eligibleAttractionActorIds,
							sourceActorId: sample.sourceActorId,
							sourceDirection: sample.sourceDirection,
							sourceRect,
						});
						if (displacement.x === 0 && displacement.y === 0) continue;
						const current = displacements.get(actorId);
						if (current === undefined) {
							displacements.set(actorId, displacement);
						} else {
							current.x += displacement.x;
							current.y += displacement.y;
						}
					}
				}
				for (const actorId of affectedActorIds) {
					if (displacements.has(actorId)) continue;
					const spring = springs.get(actorId);
					if (spring !== undefined) setSpringTarget(spring, 0, 0);
				}
				const nextAffectedActorIds = new Set<string>();
				for (const [actorId, displacement] of displacements) {
					const actor = actorStore.actors.get(actorId);
					if (actor === undefined) continue;
					setSpringTarget(readSpring(actor), displacement.x, displacement.y);
					nextAffectedActorIds.add(actorId);
				}
				affectedActorIds = nextAffectedActorIds;
			}

			function requestApply() {
				if (closed) return;
				dirty = true;
				if (cancelScheduledApply !== null) return;
				const generation = ++scheduleGeneration;
				let ranSynchronously = false;
				try {
					const cancel = scheduleApply(() => {
						ranSynchronously = true;
						if (generation !== scheduleGeneration) return;
						cancelScheduledApply = null;
						if (!closed && dirty) {
							dirty = false;
							applySamples();
						}
					});
					if (!ranSynchronously && generation === scheduleGeneration && !closed) {
						cancelScheduledApply = cancel;
					}
				} catch (cause) {
					cancelScheduledApply = null;
					throw cause;
				}
			}

			const flush = () => {
				if (closed || !dirty) return;
				scheduleGeneration += 1;
				cancelScheduledApply?.();
				cancelScheduledApply = null;
				dirty = false;
				applySamples();
			};

			const release = (
				sourceKind: PixiTileMagneticSourceKind,
				sourceActorId: string,
				sourceInstanceId: string,
			) => {
				if (samples.delete(readSourceKey(sourceKind, sourceActorId, sourceInstanceId))) {
					for (const listen of sourceMembershipListeners) listen(sourceKind);
					requestApply();
				}
			};

			const releaseSources = (sourceKind: PixiTileMagneticSourceKind) => {
				let released = false;
				for (const [key, sample] of samples) {
					if (sample.sourceKind !== sourceKind) continue;
					samples.delete(key);
					released = true;
				}
				if (released) {
					for (const listen of sourceMembershipListeners) listen(sourceKind);
					requestApply();
				}
			};

			const update = (sample: PixiTileMagneticFieldSample) => {
				const activeSample = {
					...sample,
					sourceKind: sample.sourceKind ?? "drag",
				} satisfies ActiveMagneticSample;
				const sourceKey = readSourceKey(
					activeSample.sourceKind,
					activeSample.sourceActorId,
					activeSample.sourceInstanceId,
				);
				const entered = !samples.has(sourceKey);
				samples.set(sourceKey, activeSample);
				if (entered) {
					for (const listen of sourceMembershipListeners) listen(activeSample.sourceKind);
				}
				requestApply();
			};

			const close = () => {
				if (closed) return;
				closed = true;
				scheduleGeneration += 1;
				cancelScheduledApply?.();
				cancelScheduledApply = null;
				dirty = false;
				samples.clear();
				sourceMembershipListeners.clear();
				affectedActorIds.clear();
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
				flushFx: Effect.sync(flush),
				pruneFx: Effect.sync(() => removeStaleSprings()),
				readActiveSourceActorIdsFx: Effect.sync(() =>
					Array.from(samples.values())
						.sort(compareSource)
						.map(({ sourceActorId }) => sourceActorId),
				),
				releaseFx: Effect.fn("PixiTileMagneticField.releaseFx")(
					({ sourceActorId, sourceInstanceId, sourceKind }) =>
						Effect.sync(() => {
							if (closed) return;
							release(sourceKind, sourceActorId, sourceInstanceId);
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
				subscribeSourceMembershipFx: (listen) =>
					Effect.sync(() => {
						if (closed) return () => {};
						sourceMembershipListeners.add(listen);
						return () => {
							sourceMembershipListeners.delete(listen);
						};
					}),
				updateFx: Effect.fnUntraced(function* (sample) {
					if (closed) return;
					update(sample);
				}),
				closeFx: Effect.sync(close),
			};
		}),
);
