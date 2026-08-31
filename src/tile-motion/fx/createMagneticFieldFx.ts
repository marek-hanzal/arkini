import { Effect } from "effect";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import type { MainActorStore } from "~/tile-rendering/service/MainActorStore";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import type { AnimationDriver, AnimationSpring } from "~/tile-rendering/service/AnimationDriver";
import type {
	MagneticField,
	MagneticSample,
	MagneticSourceKind,
} from "~/tile-motion/service/MagneticField";

export namespace createMagneticFieldFx {
	export interface Props {
		readonly actorStore: MainActorStore;
		readonly animationDriver: AnimationDriver;
		/** Injectable structural counters for focused performance tests. */
		readonly onApplyFn?: () => void;
		readonly onDisplacementEvaluationFn?: (actorId: string, sourceActorId: string) => void;
		readonly onSpringTargetWriteFn?: (actorId: string) => void;
		readonly scheduleApplyFn: (applyFn: () => void) => () => void;
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

const readStableDirectionFn = (actorId: string, sourceActorId: string) => {
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

const readMagneticDisplacementFn = ({
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
				: (sourceDirection ?? readStableDirectionFn(actorId, sourceActorId));
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
	readonly x: AnimationSpring;
	readonly y: AnimationSpring;
}

const crowdSpring = {
	stiffness: 360,
	damping: 32,
	mass: 0.72,
	restDelta: 0.05,
	restSpeed: 0.05,
} as const;

interface ActiveMagneticSample extends MagneticSample {
	readonly sourceKind: MagneticSourceKind;
}

const compareTextFn = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);

const compareSourceFn = (left: ActiveMagneticSample, right: ActiveMagneticSample) =>
	compareTextFn(left.sourceKind, right.sourceKind) ||
	compareTextFn(left.sourceActorId, right.sourceActorId) ||
	compareTextFn(left.sourceInstanceId, right.sourceInstanceId);

const readSourceKeyFn = (
	sourceKind: MagneticSourceKind,
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
		onApplyFn,
		onDisplacementEvaluationFn,
		onSpringTargetWriteFn,
		scheduleApplyFn,
	}: createMagneticFieldFx.Props) =>
		Effect.sync((): MagneticField => {
			const springs = new Map<string, ActorSpring>();
			const samples = new Map<string, ActiveMagneticSample>();
			const sourceMembershipListeners = new Set<(sourceKind: MagneticSourceKind) => void>();
			let affectedActorIds = new Set<string>();
			let cancelScheduledApplyFn: (() => void) | null = null;
			let closed = false;
			let dirty = false;
			let scheduleGeneration = 0;

			const closeSpringFn = (spring: ActorSpring) => {
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

			const readSpringFn = (actor: PixiTileActor) => {
				const existing = springs.get(actor.item.id);
				if (existing?.actor === actor) return existing;
				if (existing !== undefined) {
					springs.delete(actor.item.id);
					closeSpringFn(existing);
				}
				const x = RendererRuntime.runSync(
					animationDriver.createSpringFx({
						initialValue: 0,
						onUpdateFn: (value) => {
							if (closed || actor.container.destroyed) return;
							actor.offsetLayer.x = value;
						},
						options: crowdSpring,
					}),
				);
				let y: AnimationSpring;
				try {
					y = RendererRuntime.runSync(
						animationDriver.createSpringFx({
							initialValue: 0,
							onUpdateFn: (value) => {
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

			const removeStaleSpringsFn = () => {
				for (const [actorId, spring] of springs) {
					if (actorStore.actors.get(actorId) === spring.actor) continue;
					springs.delete(actorId);
					affectedActorIds.delete(actorId);
					closeSpringFn(spring);
				}
			};

			const resetFn = () => {
				removeStaleSpringsFn();
				let released = false;
				for (const [key, sample] of samples) {
					if (sample.sourceKind !== "drag") continue;
					samples.delete(key);
					released = true;
				}
				if (released) requestApply();
			};

			const readActorRectFn = (actor: PixiTileActor) => {
				const scale = actor.container.scale.x;
				return {
					height: actor.size * scale,
					width: actor.size * scale,
					x: actor.container.x - actor.container.pivot.x * scale,
					y: actor.container.y - actor.container.pivot.y * scale,
				};
			};

			const readSourceRectFn = (sample: ActiveMagneticSample) => {
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

			const setSpringTargetFn = (
				spring: ActorSpring,
				displacementX: number,
				displacementY: number,
			) => {
				if (spring.targetX !== displacementX || spring.targetY !== displacementY) {
					onSpringTargetWriteFn?.(spring.actor.item.id);
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
				onApplyFn?.();
				const activeSamples = Array.from(samples.values())
					.sort(compareSourceFn)
					.map((sample) => ({
						sample,
						sourceRect: readSourceRectFn(sample),
					}))
					.filter(
						(
							source,
						): source is {
							readonly sample: ActiveMagneticSample;
							readonly sourceRect: MagneticRect;
						} => source.sourceRect !== null,
					);
				const activeSourceActorIds = new Set(
					activeSamples.map(({ sample }) => sample.sourceActorId),
				);
				const actorRects = new Map<string, MagneticRect>();
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
							actorRect = readActorRectFn(actor);
							actorRects.set(actorId, actorRect);
						}
						onDisplacementEvaluationFn?.(actorId, sample.sourceActorId);
						const displacement = readMagneticDisplacementFn({
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
					if (spring !== undefined) setSpringTargetFn(spring, 0, 0);
				}
				const nextAffectedActorIds = new Set<string>();
				for (const [actorId, displacement] of displacements) {
					const actor = actorStore.actors.get(actorId);
					if (actor === undefined) continue;
					setSpringTargetFn(readSpringFn(actor), displacement.x, displacement.y);
					nextAffectedActorIds.add(actorId);
				}
				affectedActorIds = nextAffectedActorIds;
			}

			function requestApply() {
				if (closed) return;
				dirty = true;
				if (cancelScheduledApplyFn !== null) return;
				const generation = ++scheduleGeneration;
				let ranSynchronously = false;
				try {
					const cancelFn = scheduleApplyFn(() => {
						ranSynchronously = true;
						if (generation !== scheduleGeneration) return;
						cancelScheduledApplyFn = null;
						if (!closed && dirty) {
							dirty = false;
							applySamples();
						}
					});
					if (!ranSynchronously && generation === scheduleGeneration && !closed) {
						cancelScheduledApplyFn = cancelFn;
					}
				} catch (cause) {
					cancelScheduledApplyFn = null;
					throw cause;
				}
			}

			const flushFn = () => {
				if (closed || !dirty) return;
				scheduleGeneration += 1;
				cancelScheduledApplyFn?.();
				cancelScheduledApplyFn = null;
				dirty = false;
				applySamples();
			};

			const releaseFn = (
				sourceKind: MagneticSourceKind,
				sourceActorId: string,
				sourceInstanceId: string,
			) => {
				if (samples.delete(readSourceKeyFn(sourceKind, sourceActorId, sourceInstanceId))) {
					for (const listenFn of sourceMembershipListeners) listenFn(sourceKind);
					requestApply();
				}
			};

			const releaseSourcesFn = (sourceKind: MagneticSourceKind) => {
				let released = false;
				for (const [key, sample] of samples) {
					if (sample.sourceKind !== sourceKind) continue;
					samples.delete(key);
					released = true;
				}
				if (released) {
					for (const listenFn of sourceMembershipListeners) listenFn(sourceKind);
					requestApply();
				}
			};

			const updateFn = (sample: MagneticSample) => {
				const activeSample = {
					...sample,
					sourceKind: sample.sourceKind ?? "drag",
				} satisfies ActiveMagneticSample;
				const sourceKey = readSourceKeyFn(
					activeSample.sourceKind,
					activeSample.sourceActorId,
					activeSample.sourceInstanceId,
				);
				const entered = !samples.has(sourceKey);
				samples.set(sourceKey, activeSample);
				if (entered) {
					for (const listenFn of sourceMembershipListeners)
						listenFn(activeSample.sourceKind);
				}
				requestApply();
			};

			const closeFn = () => {
				if (closed) return;
				closed = true;
				scheduleGeneration += 1;
				cancelScheduledApplyFn?.();
				cancelScheduledApplyFn = null;
				dirty = false;
				samples.clear();
				sourceMembershipListeners.clear();
				affectedActorIds.clear();
				const failures: unknown[] = [];
				for (const spring of springs.values()) {
					try {
						closeSpringFn(spring);
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
				flushFx: Effect.sync(flushFn),
				pruneFx: Effect.sync(() => removeStaleSpringsFn()),
				readActiveSourceActorIdsFx: Effect.sync(() =>
					Array.from(samples.values())
						.sort(compareSourceFn)
						.map(({ sourceActorId }) => sourceActorId),
				),
				releaseFx: Effect.fn("MagneticField.releaseFx")(
					({ sourceActorId, sourceInstanceId, sourceKind }) =>
						Effect.sync(() => {
							if (closed) return;
							releaseFn(sourceKind, sourceActorId, sourceInstanceId);
						}),
				),
				releaseSourcesFx: Effect.fn("MagneticField.releaseSourcesFx")((sourceKind) =>
					Effect.sync(() => {
						if (closed) return;
						releaseSourcesFn(sourceKind);
					}),
				),
				resetFx: Effect.sync(() => resetFn()),
				subscribeSourceMembershipFx: (listenFn) =>
					Effect.sync(() => {
						if (closed) return () => {};
						sourceMembershipListeners.add(listenFn);
						return () => {
							sourceMembershipListeners.delete(listenFn);
						};
					}),
				updateFx: Effect.fnUntraced(function* (sample) {
					if (closed) return;
					updateFn(sample);
				}),
				closeFx: Effect.sync(closeFn),
			};
		}),
);
