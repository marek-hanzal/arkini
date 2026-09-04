import { Effect } from "effect";
import { match } from "ts-pattern";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type {
	TileMotionCue,
	TileSpawnMotionCue,
	TileSwapMotionCue,
} from "~/tile-presentation/type/TileMotionCue";
import type { MainActorStore } from "~/tile-rendering/service/MainActorStore";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import { destroyTileActorFx } from "~/tile-rendering/fx/destroyTileActorFx";
import type { ActorAnimator } from "~/tile-rendering/service/ActorAnimator";
import { restoreActorExitFx } from "~/tile-rendering/fx/restoreActorExitFx";
import { startActorEnterFx } from "~/tile-rendering/fx/startActorEnterFx";
import type { PixiScenePalette } from "~/tile-rendering/type/PixiScenePalette";
import type { MagneticField } from "~/tile-motion/service/MagneticField";
import type {
	InteractionClaim,
	MotionRuntime,
	MotionSnapshot,
} from "~/tile-motion/service/MotionRuntime";
import { finalizeMotionActorsFx } from "~/tile-motion/fx/finalizeMotionActorsFx";
import { runMotionCueFx } from "~/tile-motion/fx/runMotionCueFx";
import { chaseTargetFx } from "~/tile-motion/fx/chaseTargetFx";
import { syncMotionPresentationFx } from "~/tile-motion/fx/syncMotionPresentationFx";
import type { QuantityPresentation } from "~/tile-motion/type/QuantityPresentation";
import type { MotionRedirect, TargetRoute } from "~/tile-motion/type/MotionTarget";
import type { PixiApplicationOwner } from "~/tile-rendering/service/PixiApplicationOwner";
import type { TextureStore } from "~/tile-rendering/fx/createTextureStoreFx";
import type { MainSurface } from "~/game-scene/service/MainSurface";
import { updateTileMotionLanesFn } from "~/tile-motion/fn/updateTileMotionLanesFn";

export namespace createMotionRuntimeFx {
	export interface Props {
		readonly actorStore: MainActorStore;
		readonly animator: ActorAnimator;
		readonly application: PixiApplicationOwner;
		readonly magneticField: MagneticField;
		readonly readPaletteFn: () => PixiScenePalette;
		readonly surface: MainSurface;
		readonly textures: TextureStore;
	}
}

const emptyMotionLanes = {
	active: [],
	pending: [],
} satisfies updateTileMotionLanesFn.State;

const maximumRememberedCueKeys = 256;
const maximumRememberedTargetRedirects = 256;

/** Projects drag ownership without turning presentation work into a click lock. */
const readInteractionClaimsFn = (cues: ReadonlyArray<TileMotionCue>) => {
	const claims = new Map<string, InteractionClaim>();
	for (const cue of cues) {
		match(cue)
			.with(
				{
					kind: "spawn",
				},
				(spawn) => {
					claims.set(spawn.actorId, "handoff");
				},
			)
			.with(
				{
					kind: "stack",
				},
				() => {},
			)
			.with(
				{
					kind: "input",
				},
				(input) => {
					claims.set(input.sourceActorId, "activation-only");
				},
			)
			.with(
				{
					kind: "swap",
				},
				(swap) => {
					for (const actorId of [
						swap.actorId,
						swap.counterpartActorId,
					]) {
						claims.set(actorId, "handoff");
					}
				},
			)
			.exhaustive();
	}
	return claims;
};

/** Returns every canonical actor whose presentation lifecycle is retained by one motion cue. */
const readTileMotionActorClaimsFn = (cue: TileMotionCue) =>
	match(cue)
		.with(
			{
				kind: "spawn",
			},
			(spawn) =>
				new Set([
					spawn.actorId,
					spawn.originActorId,
				]),
		)
		.with(
			{
				kind: "stack",
			},
			(stack) =>
				new Set([
					stack.originActorId,
				]),
		)
		.with(
			{
				kind: "input",
			},
			(input) =>
				new Set([
					input.sourceActorId,
					input.targetActorId,
				]),
		)
		.with(
			{
				kind: "swap",
			},
			(swap) =>
				new Set([
					swap.actorId,
					swap.counterpartActorId,
				]),
		)
		.exhaustive();

interface ReadUnsettledTileInputSourceQuantitiesProps {
	readonly cues: ReadonlyArray<TileMotionCue>;
	readonly revealedCueKeys?: ReadonlySet<string>;
}

/**
 * Keeps each input source at the quantity shown by its oldest unsettled delivery.
 *
 * A source may feed several slots in immediately committed transitions. Only completion of the
 * preceding whole-stack round trip is allowed to reveal the next canonical quantity.
 */
const readUnsettledTileInputSourceQuantitiesFn = ({
	cues,
	revealedCueKeys = new Set(),
}: ReadUnsettledTileInputSourceQuantitiesProps): ReadonlyMap<string, number> => {
	const quantities = new Map<string, number>();
	for (const cue of cues) {
		if (cue.kind !== "input" || quantities.has(cue.sourceActorId)) continue;
		quantities.set(
			cue.sourceActorId,
			revealedCueKeys.has(`${cue.sequence}:${cue.eventIndex}`)
				? cue.resultingQuantity
				: cue.previousQuantity,
		);
	}
	return quantities;
};

interface ReadQuantityPresentationProps {
	readonly cues: ReadonlyArray<TileMotionCue>;
	readonly resolvedTargetActorIdByCueKey: ReadonlyMap<string, string>;
	readonly revealedInputCueKeys: ReadonlySet<string>;
}

/**
 * Replays pending quantity choreography in cue order.
 *
 * A later input's previous quantity already includes earlier stack events. Subtracting only stacks
 * queued before that input prevents either committed event from becoming visible before contact.
 */
const readQuantityPresentationFn = ({
	cues,
	resolvedTargetActorIdByCueKey,
	revealedInputCueKeys,
}: ReadQuantityPresentationProps): ReadonlyMap<string, QuantityPresentation> => {
	const presentations = new Map<string, QuantityPresentation>();
	const inputQuantities = readUnsettledTileInputSourceQuantitiesFn({
		cues,
		revealedCueKeys: revealedInputCueKeys,
	});
	const firstInputIndexByActorId = new Map<string, number>();
	for (const [index, cue] of cues.entries()) {
		if (cue.kind !== "input" || firstInputIndexByActorId.has(cue.sourceActorId)) continue;
		firstInputIndexByActorId.set(cue.sourceActorId, index);
	}
	const hiddenStackQuantities = new Map<string, number>();
	for (const [index, cue] of cues.entries()) {
		if (cue.kind !== "stack") continue;
		const actorId =
			resolvedTargetActorIdByCueKey.get(`${cue.sequence}:${cue.eventIndex}`) ??
			cue.targetActorId;
		const firstInputIndex = firstInputIndexByActorId.get(actorId);
		if (firstInputIndex !== undefined && index >= firstInputIndex) continue;
		hiddenStackQuantities.set(
			actorId,
			(hiddenStackQuantities.get(actorId) ?? 0) + cue.quantity,
		);
	}
	for (const [actorId, quantity] of inputQuantities) {
		presentations.set(actorId, {
			kind: "exact",
			quantity: Math.max(1, quantity - (hiddenStackQuantities.get(actorId) ?? 0)),
		});
		hiddenStackQuantities.delete(actorId);
	}
	for (const [actorId, quantity] of hiddenStackQuantities) {
		presentations.set(actorId, {
			kind: "subtract",
			quantity,
		});
	}
	return presentations;
};

const readMotionAnimationKeysFn = ({ cue, cueKey }: { cue: TileMotionCue; cueKey: string }) =>
	match(cue)
		.with(
			{
				kind: "spawn",
			},
			() => [
				`motion:${cueKey}`,
			],
		)
		.with(
			{
				kind: "stack",
			},
			() => [
				`motion:${cueKey}`,
			],
		)
		.with(
			{
				kind: "input",
			},
			() => [
				`motion:${cueKey}:consume`,
				`motion:${cueKey}`,
			],
		)
		.with(
			{
				kind: "swap",
			},
			(swap) => [
				`motion:${cueKey}:${swap.actorId}`,
				`motion:${cueKey}:${swap.counterpartActorId}`,
			],
		)
		.exhaustive();

interface DetachedSwapLeg {
	readonly actorId: string;
	readonly cueKey: string;
	readonly ownerKey: string;
}

interface CueLifecycle {
	readonly activeSwapLegActorIds: Set<string>;
	inputRemainderRevealed: boolean;
	payloadActor: PixiTileActor | null;
	started: boolean;
}

const createCueLifecycleFn = (): CueLifecycle => ({
	activeSwapLegActorIds: new Set(),
	inputRemainderRevealed: false,
	payloadActor: null,
	started: false,
});

/**
 * Owns ordered presentation-cue lanes, idempotency, interaction claims, and completion cleanup.
 *
 * Cues are already compiled from committed engine facts. This runtime may serialize conflicting
 * presentation work, but it must never reinterpret a cue as a new gameplay mutation. Closing
 * cancels every keyed writer before destroying identity-free payload actors.
 */
export const createMotionRuntimeFx = Effect.fn("createMotionRuntimeFx")(function* ({
	actorStore,
	animator,
	application,
	magneticField,
	readPaletteFn,
	surface,
	textures,
}: createMotionRuntimeFx.Props) {
	let closed = false;
	let motionLanes: updateTileMotionLanesFn.State = emptyMotionLanes;
	const knownCueKeys = new Set<string>();
	const cueLifecycleByKey = new Map<string, CueLifecycle>();
	const detachedSwapLegByActorId = new Map<string, DetachedSwapLeg>();
	const targetRedirectByActorId = new Map<string, MotionRedirect>();

	const readCueKeyFn = (cue: TileMotionCue) => `${cue.sequence}:${cue.eventIndex}`;
	const readCuesFn = () => [
		...motionLanes.active,
		...motionLanes.pending,
	];

	const retainNewestCueKeysFn = () => {
		while (knownCueKeys.size > maximumRememberedCueKeys) {
			const oldest = knownCueKeys.values().next().value;
			if (oldest === undefined) return;
			knownCueKeys.delete(oldest);
		}
	};

	const retainNewestTargetRedirectsFn = () => {
		while (targetRedirectByActorId.size > maximumRememberedTargetRedirects) {
			const oldest = targetRedirectByActorId.keys().next().value;
			if (oldest === undefined) return;
			targetRedirectByActorId.delete(oldest);
		}
	};

	const readTargetRouteFn = (actorId: string, location: TargetRoute["location"]): TargetRoute => {
		let currentActorId = actorId;
		let currentLocation = location;
		let redirected = false;
		const visitedActorIds = new Set<string>();
		while (!visitedActorIds.has(currentActorId)) {
			visitedActorIds.add(currentActorId);
			const redirect = targetRedirectByActorId.get(currentActorId);
			if (redirect === undefined || redirect.targetActorId === currentActorId) break;
			currentActorId = redirect.targetActorId;
			currentLocation = redirect.targetLocation;
			redirected = true;
		}
		return {
			actorId: currentActorId,
			location: currentLocation,
			redirected,
		};
	};

	const readCurrentInteractionClaimsFn = () => {
		const claims = readInteractionClaimsFn(readCuesFn());
		for (const actorId of detachedSwapLegByActorId.keys()) {
			claims.set(actorId, "handoff");
		}
		return claims;
	};

	const readRetainedActorIdsFn = () => {
		const actorIds = new Set(detachedSwapLegByActorId.keys());
		for (const cue of readCuesFn()) {
			for (const actorId of readTileMotionActorClaimsFn(cue)) {
				actorIds.add(actorId);
			}
		}
		return actorIds;
	};

	const readCurrentQuantityPresentationFn = () => {
		const cues = readCuesFn();
		const revealedInputCueKeys = new Set(
			[
				...cueLifecycleByKey.entries(),
			].flatMap(([cueKey, lifecycle]) =>
				lifecycle.inputRemainderRevealed
					? [
							cueKey,
						]
					: [],
			),
		);
		return readQuantityPresentationFn({
			cues,
			resolvedTargetActorIdByCueKey: new Map(
				cues.flatMap((cue) =>
					cue.kind === "stack"
						? [
								[
									readCueKeyFn(cue),
									readTargetRouteFn(cue.targetActorId, cue.targetLocation)
										.actorId,
								],
							]
						: [],
				),
			),
			revealedInputCueKeys,
		});
	};

	const syncPresentationFn = () => {
		RendererRuntime.runSync(
			syncMotionPresentationFx({
				actorStore,
				animator,
				application,
				quantityPresentationByActorId: readCurrentQuantityPresentationFn(),
				readPaletteFn,
				surface,
				textures,
			}),
		);
	};

	const releaseDetachedCueLifecycleIfSettledFn = (cueKey: string) => {
		const lifecycle = cueLifecycleByKey.get(cueKey);
		if (lifecycle === undefined || lifecycle.activeSwapLegActorIds.size > 0) return;
		const hasDetachedLeg = [
			...detachedSwapLegByActorId.values(),
		].some((detached) => detached.cueKey === cueKey);
		if (!hasDetachedLeg) cueLifecycleByKey.delete(cueKey);
	};

	function completeCue(cue: TileMotionCue) {
		const cueKey = readCueKeyFn(cue);
		const lifecycle = cueLifecycleByKey.get(cueKey);
		if (closed || lifecycle?.started !== true) return;
		cueLifecycleByKey.delete(cueKey);
		const payload = lifecycle.payloadActor;
		if (payload !== null && !payload.container.destroyed) {
			RendererRuntime.runSync(animator.cancelActorFx(payload));
			RendererRuntime.runSync(destroyTileActorFx(payload));
		}
		motionLanes =
			detachedSwapLegByActorId.size > 0
				? {
						active: motionLanes.active.filter(
							(activeCue) => readCueKeyFn(activeCue) !== readCueKeyFn(cue),
						),
						pending: motionLanes.pending,
					}
				: updateTileMotionLanesFn({
						action: {
							cue,
							type: "complete",
						},
						state: motionLanes,
					});
		const stillClaimedActorIds = readRetainedActorIdsFn();
		RendererRuntime.runSync(
			finalizeMotionActorsFx({
				actorIds: readTileMotionActorClaimsFn(cue),
				actorStore,
				animator,
				application,
				readPaletteFn,
				stillClaimedActorIds,
				surface,
				textures,
			}),
		);
		syncPresentationFn();
		if (
			cue.kind === "input" &&
			!stillClaimedActorIds.has(cue.sourceActorId) &&
			actorStore.canonicalItems.has(cue.sourceActorId)
		) {
			const sourceActor = actorStore.actors.get(cue.sourceActorId);
			if (sourceActor !== undefined && !sourceActor.container.destroyed) {
				RendererRuntime.runSync(
					restoreActorExitFx({
						actor: sourceActor,
						animator,
					}),
				);
			}
		}
		if (detachedSwapLegByActorId.size === 0) startCues();
	}

	function startSwapLeg(cueKey: string, actorId: string) {
		const lifecycle = cueLifecycleByKey.get(cueKey);
		if (closed || lifecycle?.started !== true) return;
		lifecycle.activeSwapLegActorIds.add(actorId);
	}

	function settleSwapLeg(cueKey: string, actorId: string) {
		const lifecycle = cueLifecycleByKey.get(cueKey);
		if (closed || lifecycle === undefined) return;
		lifecycle.activeSwapLegActorIds.delete(actorId);
		const detached = detachedSwapLegByActorId.get(actorId);
		if (detached?.cueKey !== cueKey) return;
		detachedSwapLegByActorId.delete(actorId);
		releaseDetachedCueLifecycleIfSettledFn(cueKey);
		RendererRuntime.runSync(
			finalizeMotionActorsFx({
				actorIds: new Set([
					actorId,
				]),
				actorStore,
				animator,
				application,
				readPaletteFn,
				stillClaimedActorIds: readRetainedActorIdsFn(),
				surface,
				textures,
			}),
		);
		if (detachedSwapLegByActorId.size > 0) return;
		motionLanes = updateTileMotionLanesFn({
			action: {
				cues: [],
				type: "enqueue",
			},
			state: motionLanes,
		});
		syncPresentationFn();
		startCues();
	}

	function startCue(cue: TileMotionCue) {
		const cueKey = readCueKeyFn(cue);
		const readSourceSurvivesFn = () => {
			if (cue.kind !== "input") return false;
			if (cue.sourceItem === undefined) {
				return actorStore.canonicalItems.has(cue.sourceActorId);
			}
			const latest = readCuesFn()
				.filter(
					(candidate) =>
						candidate.kind === "input" && candidate.sourceActorId === cue.sourceActorId,
				)
				.at(-1);
			return latest?.kind === "input" && latest.resultingQuantity > 0;
		};
		RendererRuntime.runSync(
			runMotionCueFx({
				actorStore,
				animator,
				application,
				cue,
				cueKey,
				magneticField,
				onCompleteFn: () => completeCue(cue),
				onSwapLegSettledFn: (actorId) => {
					settleSwapLeg(cueKey, actorId);
				},
				onSwapLegStartedFn: (actorId) => {
					startSwapLeg(cueKey, actorId);
				},
				onPayloadCreatedFn: (actor) => {
					const lifecycle = cueLifecycleByKey.get(cueKey);
					if (lifecycle !== undefined) lifecycle.payloadActor = actor;
				},
				onInputRemainderRevealedFn: () => {
					const lifecycle = cueLifecycleByKey.get(cueKey);
					if (lifecycle === undefined) return;
					lifecycle.inputRemainderRevealed = true;
					syncPresentationFn();
				},
				readPaletteFn,
				readSourceSurvivesFn,
				readTargetRouteFn,
				surface,
				textures,
			}),
		);
	}

	function startCues() {
		for (const cue of motionLanes.active) {
			const cueKey = readCueKeyFn(cue);
			const lifecycle = cueLifecycleByKey.get(cueKey);
			if (lifecycle === undefined || lifecycle.started) continue;
			lifecycle.started = true;
			startCue(cue);
		}
	}

	const settleReleasedActorFx = (actorId: string) =>
		Effect.gen(function* () {
			const actor = actorStore.actors.get(actorId);
			const canonical = actorStore.canonicalItems.get(actorId);
			if (actor === undefined || canonical === undefined || actor.container.destroyed) return;
			const target = yield* surface.readActorPoseFx(canonical);
			if (target === null) return;
			yield* chaseTargetFx({
				actor,
				animator,
				fallbackTarget: target,
				onSettledFn: () => {
					if (actor.container.destroyed) return;
					const latest = actorStore.canonicalItems.get(actorId);
					if (latest === undefined) return;
					const latestPose = RendererRuntime.runSync(surface.readActorPoseFx(latest));
					latestPose?.layer.addChild(actor.container);
				},
				ownerKey: `motion-handoff-settle:${actor.instanceId}`,
				surface,
				targetLocation: canonical.location,
			});
		});

	const isInterruptibleCueForActorFn = (
		cue: TileMotionCue,
		actorId: string,
	): cue is TileSpawnMotionCue | TileSwapMotionCue =>
		match(cue)
			.with(
				{
					kind: "spawn",
				},
				(spawn) => spawn.actorId === actorId,
			)
			.with(
				{
					kind: "stack",
				},
				() => false,
			)
			.with(
				{
					kind: "input",
				},
				() => false,
			)
			.with(
				{
					kind: "swap",
				},
				(swap) => swap.actorId === actorId || swap.counterpartActorId === actorId,
			)
			.exhaustive();

	return {
		handoffSpawnsFx: Effect.fn("MotionRuntime.handoffSpawnsFx")(function* (
			actorIds: ReadonlySet<string>,
		) {
			if (closed) return;
			const superseded = readCuesFn().filter(
				(cue) => cue.kind === "spawn" && actorIds.has(cue.actorId),
			);
			if (superseded.length === 0) return;
			const keys = new Set(superseded.map(readCueKeyFn));
			const releasedActorIds = new Set<string>();
			for (const cue of superseded) {
				const key = readCueKeyFn(cue);
				const started = cueLifecycleByKey.get(key)?.started === true;
				// Retire before cancellation: callbacks must not settle or restart this cue.
				cueLifecycleByKey.delete(key);
				yield* animator.cancelFx(`motion:${key}`);
				if (!started && cue.kind === "spawn") {
					const actor = actorStore.actors.get(cue.actorId);
					if (actor !== undefined)
						yield* startActorEnterFx({
							actor,
							animator,
						});
				}
				for (const actorId of readTileMotionActorClaimsFn(cue)) {
					if (!actorIds.has(actorId)) releasedActorIds.add(actorId);
				}
			}
			motionLanes = {
				active: motionLanes.active.filter((cue) => !keys.has(readCueKeyFn(cue))),
				pending: motionLanes.pending.filter((cue) => !keys.has(readCueKeyFn(cue))),
			};
			if (detachedSwapLegByActorId.size === 0) {
				motionLanes = updateTileMotionLanesFn({
					action: {
						type: "enqueue",
						cues: [],
					},
					state: motionLanes,
				});
			}
			yield* finalizeMotionActorsFx({
				actorIds: releasedActorIds,
				actorStore,
				animator,
				application,
				readPaletteFn,
				stillClaimedActorIds: readRetainedActorIdsFn(),
				surface,
				textures,
			});
			// Reconciliation finishes the delivery takeover before startFx starts successors.
		}),
		beginInteractionHandoffFx: Effect.fn("MotionRuntime.beginInteractionHandoffFx")((actorId) =>
			Effect.gen(function* () {
				if (closed) return false;
				const detached = detachedSwapLegByActorId.get(actorId);
				const handedOffDetached = detached !== undefined;
				if (detached !== undefined) {
					yield* animator.cancelFx(detached.ownerKey);
					detachedSwapLegByActorId.delete(actorId);
					const lifecycle = cueLifecycleByKey.get(detached.cueKey);
					lifecycle?.activeSwapLegActorIds.delete(actorId);
					releaseDetachedCueLifecycleIfSettledFn(detached.cueKey);
				}
				const cues = readCuesFn();
				const superseded = cues.filter(
					(cue): cue is TileSpawnMotionCue | TileSwapMotionCue =>
						isInterruptibleCueForActorFn(cue, actorId),
				);
				if (superseded.length === 0) {
					if (!handedOffDetached) return false;
					if (detachedSwapLegByActorId.size === 0) {
						motionLanes = updateTileMotionLanesFn({
							action: {
								cues: [],
								type: "enqueue",
							},
							state: motionLanes,
						});
						syncPresentationFn();
						startCues();
					}
					return true;
				}
				const supersededCueKeys = new Set(superseded.map(readCueKeyFn));
				const hasBlockingClaim = cues.some(
					(cue) =>
						!supersededCueKeys.has(readCueKeyFn(cue)) &&
						readTileMotionActorClaimsFn(cue).has(actorId),
				);
				if (hasBlockingClaim) return false;

				const activeCounterpartIds = new Set<string>();
				const completedCounterpartIds = new Set<string>();
				const pendingCounterpartIds = new Set<string>();
				const activeSpawnActorIds = new Set<string>();
				const pendingSpawnActorIds = new Set<string>();
				for (const cue of superseded) {
					const cueKey = readCueKeyFn(cue);
					const lifecycle = cueLifecycleByKey.get(cueKey);
					const started = lifecycle?.started === true;
					if (lifecycle !== undefined) lifecycle.started = false;
					yield* match(cue)
						.with(
							{
								kind: "spawn",
							},
							(spawn) =>
								Effect.gen(function* () {
									if (!started) {
										pendingSpawnActorIds.add(spawn.actorId);
										return;
									}
									activeSpawnActorIds.add(spawn.actorId);
									yield* animator.cancelFx(`motion:${cueKey}`);
								}),
						)
						.with(
							{
								kind: "swap",
							},
							(swap) =>
								Effect.gen(function* () {
									const counterpartId =
										swap.actorId === actorId
											? swap.counterpartActorId
											: swap.actorId;
									if (!started) {
										pendingCounterpartIds.add(counterpartId);
										return;
									}
									yield* animator.cancelFx(`motion:${cueKey}:${actorId}`);
									const activeActorIds = lifecycle?.activeSwapLegActorIds;
									activeActorIds?.delete(actorId);
									if (activeActorIds?.has(counterpartId)) {
										activeCounterpartIds.add(counterpartId);
										detachedSwapLegByActorId.set(counterpartId, {
											actorId: counterpartId,
											cueKey,
											ownerKey: `motion:${cueKey}:${counterpartId}`,
										});
									} else {
										completedCounterpartIds.add(counterpartId);
									}
								}),
						)
						.exhaustive();
					if (lifecycle !== undefined) lifecycle.payloadActor = null;
				}
				const filteredMotionLanes = {
					active: motionLanes.active.filter(
						(cue) => !supersededCueKeys.has(readCueKeyFn(cue)),
					),
					pending: motionLanes.pending.filter(
						(cue) => !supersededCueKeys.has(readCueKeyFn(cue)),
					),
				};
				motionLanes =
					detachedSwapLegByActorId.size > 0
						? filteredMotionLanes
						: updateTileMotionLanesFn({
								action: {
									cues: [],
									type: "enqueue",
								},
								state: filteredMotionLanes,
							});
				for (const cueKey of supersededCueKeys) {
					releaseDetachedCueLifecycleIfSettledFn(cueKey);
				}

				const stillClaimedActorIds = readRetainedActorIdsFn();
				const settleActorIds = new Set(
					[
						...pendingCounterpartIds,
						...completedCounterpartIds,
					].filter(
						(counterpartId) =>
							counterpartId !== actorId &&
							!activeCounterpartIds.has(counterpartId) &&
							!stillClaimedActorIds.has(counterpartId),
					),
				);
				if (settleActorIds.size > 0) {
					yield* finalizeMotionActorsFx({
						actorIds: settleActorIds,
						actorStore,
						animator,
						application,
						readPaletteFn,
						stillClaimedActorIds,
						surface,
						textures,
					});
					yield* Effect.forEach(settleActorIds, settleReleasedActorFx, {
						discard: true,
					});
				}
				for (const pendingSpawnActorId of pendingSpawnActorIds) {
					if (activeSpawnActorIds.has(pendingSpawnActorId)) continue;
					const pendingSpawnActor = actorStore.actors.get(pendingSpawnActorId);
					if (pendingSpawnActor === undefined || pendingSpawnActor.container.destroyed) {
						continue;
					}
					yield* startActorEnterFx({
						actor: pendingSpawnActor,
						animator,
					});
				}
				syncPresentationFn();
				if (detachedSwapLegByActorId.size === 0) startCues();
				return true;
			}),
		),
		enqueueFx: Effect.fn("MotionRuntime.enqueueFx")((cues) =>
			Effect.sync(() => {
				if (closed || cues.length === 0) return;
				const uniqueCues = cues.filter((cue) => {
					const cueKey = readCueKeyFn(cue);
					if (knownCueKeys.has(cueKey)) return false;
					knownCueKeys.add(cueKey);
					cueLifecycleByKey.set(cueKey, createCueLifecycleFn());
					return true;
				});
				retainNewestCueKeysFn();
				if (uniqueCues.length === 0) return;
				motionLanes =
					detachedSwapLegByActorId.size > 0
						? {
								active: motionLanes.active,
								pending: [
									...motionLanes.pending,
									...uniqueCues,
								],
							}
						: updateTileMotionLanesFn({
								action: {
									cues: uniqueCues,
									type: "enqueue",
								},
								state: motionLanes,
							});
			}),
		),
		redirectTargetFx: Effect.fn("MotionRuntime.redirectTargetFx")((redirect) =>
			Effect.sync(() => {
				if (closed || redirect.sourceActorId === redirect.targetActorId) {
					return;
				}
				targetRedirectByActorId.delete(redirect.sourceActorId);
				targetRedirectByActorId.set(redirect.sourceActorId, redirect);
				retainNewestTargetRedirectsFn();
			}),
		),
		readSnapshotFx: Effect.sync(
			(): MotionSnapshot => ({
				interactionClaimByActorId: readCurrentInteractionClaimsFn(),
				retainedActorIds: readRetainedActorIdsFn(),
				spawnCueByActorId: new Map(
					readCuesFn().flatMap((cue) =>
						cue.kind === "spawn"
							? [
									[
										cue.actorId,
										cue,
									] as const,
								]
							: [],
					),
				),
				quantityPresentationByActorId: readCurrentQuantityPresentationFn(),
			}),
		),
		startFx: Effect.sync(() => startCues()),
		syncPresentationFx: Effect.sync(() => syncPresentationFn()),
		closeFx: Effect.gen(function* () {
			if (closed) return;
			closed = true;
			for (const cue of motionLanes.active) {
				const cueKey = readCueKeyFn(cue);
				if (cueLifecycleByKey.get(cueKey)?.started !== true) continue;
				const animationKeys = readMotionAnimationKeysFn({
					cue,
					cueKey,
				});
				for (const animationKey of animationKeys) {
					yield* animator.cancelFx(animationKey);
				}
			}
			for (const detached of detachedSwapLegByActorId.values()) {
				yield* animator.cancelFx(detached.ownerKey);
			}
			for (const { payloadActor } of cueLifecycleByKey.values()) {
				if (payloadActor === null) continue;
				yield* animator.cancelActorFx(payloadActor);
				yield* destroyTileActorFx(payloadActor);
			}
			yield* magneticField.releaseSourcesFx("motion");
			motionLanes = emptyMotionLanes;
			knownCueKeys.clear();
			cueLifecycleByKey.clear();
			detachedSwapLegByActorId.clear();
			targetRedirectByActorId.clear();
		}),
	} satisfies MotionRuntime;
});
