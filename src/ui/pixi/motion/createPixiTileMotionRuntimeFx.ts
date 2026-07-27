import { Effect } from "effect";
import { match } from "ts-pattern";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type {
	TileMotionCue,
	TileSpawnMotionCue,
	TileSwapMotionCue,
} from "~/bridge/tile/motion/TileMotionCue";
import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import { destroyPixiTileActorFx } from "~/ui/pixi/actor/destroyPixiTileActorFx";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { startPixiTileActorFadeInFx } from "~/ui/pixi/animation/startPixiTileActorFadeInFx";
import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";
import type { TileSceneHandoff } from "~/ui/pixi/handoff/TileSceneHandoff";
import type { TileSceneHandoffStore } from "~/ui/pixi/handoff/createTileSceneHandoffStoreFx";
import type { PixiTileMagneticField } from "~/ui/pixi/magnet/PixiTileMagneticField";
import type {
	PixiTileMotionRuntime,
	PixiTileMotionSnapshot,
} from "~/ui/pixi/motion/PixiTileMotionRuntime";
import { finalizePixiTileMotionActorsFx } from "~/ui/pixi/motion/finalizePixiTileMotionActorsFx";
import { readPixiTileInteractionClaimsFx } from "~/ui/pixi/motion/readPixiTileInteractionClaimsFx";
import { readPixiTileMotionAnimationKeysFx } from "~/ui/pixi/motion/readPixiTileMotionAnimationKeysFx";
import { runPixiTileMotionCueFx } from "~/ui/pixi/motion/runPixiTileMotionCueFx";
import { settlePixiTileMotionActorFx } from "~/ui/pixi/motion/settlePixiTileMotionActorFx";
import { syncPixiTileMotionQuantitiesFx } from "~/ui/pixi/motion/syncPixiTileMotionQuantitiesFx";
import type {
	PixiTileMotionTargetRedirect,
	PixiTileMotionTargetRoute,
} from "~/ui/pixi/motion/PixiTileMotionTargetRoute";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import type { PixiTextureStore } from "~/ui/pixi/runtime/createPixiTextureStoreFx";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";
import type { TileMotionLanesState } from "~/ui/tile/motion/TileMotionLanesState";
import { readTileMotionActorClaimsFx } from "~/ui/tile/motion/readTileMotionActorClaimsFx";
import { readUnsettledTileInputSourceQuantitiesFx } from "~/ui/tile/motion/readUnsettledTileInputSourceQuantitiesFx";
import { readUnsettledTileStackQuantitiesFx } from "~/ui/tile/motion/readUnsettledTileStackQuantitiesFx";
import { updateTileMotionLanesFx } from "~/ui/tile/motion/updateTileMotionLanesFx";

export namespace createPixiTileMotionRuntimeFx {
	export interface Props {
		readonly actorStore: PixiMainSceneActorStore;
		readonly animator: PixiActorAnimator;
		readonly application: PixiApplicationOwner;
		readonly handoffs: TileSceneHandoffStore;
		readonly magneticField: PixiTileMagneticField;
		readonly readPalette: () => PixiScenePalette;
		readonly surface: PixiMainSceneSurface;
		readonly textures: PixiTextureStore;
	}
}

const emptyMotionLanes = {
	active: [],
	pending: [],
} satisfies TileMotionLanesState;

const maximumRememberedCueKeys = 256;
const maximumRememberedTargetRedirects = 256;

interface PixiDetachedSwapLeg {
	readonly actorId: string;
	readonly cueKey: string;
	readonly ownerKey: string;
}

/**
 * Owns ordered presentation-cue lanes, idempotency, interaction claims, and completion cleanup.
 *
 * Cues are already compiled from committed engine facts. This runtime may serialize conflicting
 * presentation work and retain cross-scene geometry, but it must never reinterpret a cue as a new
 * gameplay mutation. Closing cancels every keyed writer before destroying transient actors.
 */
export const createPixiTileMotionRuntimeFx = Effect.fn("createPixiTileMotionRuntimeFx")(function* ({
	actorStore,
	animator,
	application,
	handoffs,
	magneticField,
	readPalette,
	surface,
	textures,
}: createPixiTileMotionRuntimeFx.Props) {
	let closed = false;
	let motionLanes: TileMotionLanesState = emptyMotionLanes;
	const knownCueKeys = new Set<string>();
	const startedCueKeys = new Set<string>();
	const claimedHandoffs = new Map<string, TileSceneHandoff>();
	const transientActorByCueKey = new Map<string, PixiTileActor>();
	const activeMagneticSourceActorIds = new Set<string>();
	const activeSwapLegActorIdsByCueKey = new Map<string, Set<string>>();
	const detachedSwapLegByActorId = new Map<string, PixiDetachedSwapLeg>();
	const targetRedirectByActorId = new Map<string, PixiTileMotionTargetRedirect>();

	const readCueKey = (cue: TileMotionCue) => `${cue.sequence}:${cue.eventIndex}`;
	const readCueHandoffKey = (cue: TileMotionCue) => `${cue.sequence}:${cue.originActorId}`;
	const readCues = () => [
		...motionLanes.active,
		...motionLanes.pending,
	];

	const retainNewestCueKeys = () => {
		while (knownCueKeys.size > maximumRememberedCueKeys) {
			const oldest = knownCueKeys.values().next().value;
			if (oldest === undefined) return;
			knownCueKeys.delete(oldest);
		}
	};

	const retainNewestTargetRedirects = () => {
		while (targetRedirectByActorId.size > maximumRememberedTargetRedirects) {
			const oldest = targetRedirectByActorId.keys().next().value;
			if (oldest === undefined) return;
			targetRedirectByActorId.delete(oldest);
		}
	};

	const readTargetRoute = (
		actorId: string,
		location: PixiTileMotionTargetRoute["location"],
	): PixiTileMotionTargetRoute => {
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

	const readInteractionClaims = () => {
		const claims = RendererRuntime.runSync(readPixiTileInteractionClaimsFx(readCues()));
		for (const actorId of detachedSwapLegByActorId.keys()) {
			claims.set(actorId, "handoff");
		}
		return claims;
	};

	const readRetainedActorIds = () => {
		const actorIds = new Set(detachedSwapLegByActorId.keys());
		for (const cue of readCues()) {
			for (const actorId of RendererRuntime.runSync(readTileMotionActorClaimsFx(cue))) {
				actorIds.add(actorId);
			}
		}
		return actorIds;
	};

	const readUnsettledQuantities = () => {
		const quantities = RendererRuntime.runSync(
			readUnsettledTileStackQuantitiesFx({
				cues: readCues(),
			}),
		);
		const targetLocationByActorId = new Map(
			readCues().flatMap((cue) =>
				cue.kind === "stack"
					? [
							[
								cue.targetActorId,
								cue.targetLocation,
							] as const,
						]
					: [],
			),
		);
		const routedQuantities = new Map<string, number>();
		for (const [actorId, quantity] of quantities) {
			const location = targetLocationByActorId.get(actorId);
			const routedActorId =
				location === undefined ? actorId : readTargetRoute(actorId, location).actorId;
			routedQuantities.set(
				routedActorId,
				(routedQuantities.get(routedActorId) ?? 0) + quantity,
			);
		}
		return routedQuantities;
	};

	const readUnsettledInputSourceQuantities = () =>
		RendererRuntime.runSync(
			readUnsettledTileInputSourceQuantitiesFx({
				cues: readCues(),
			}),
		);

	const syncQuantities = () => {
		RendererRuntime.runSync(
			syncPixiTileMotionQuantitiesFx({
				actorStore,
				animator,
				application,
				readPalette,
				surface,
				textures,
				unsettledInputSourceQuantities: readUnsettledInputSourceQuantities(),
				unsettledQuantities: readUnsettledQuantities(),
			}),
		);
	};

	const releaseMagneticSource = (actorId: string) => {
		if (!activeMagneticSourceActorIds.delete(actorId)) return;
		RendererRuntime.runSync(
			magneticField.releaseFx({
				sourceActorId: actorId,
				sourceKind: "motion",
			}),
		);
	};

	function completeCue(cue: TileMotionCue) {
		const cueKey = readCueKey(cue);
		if (closed || !startedCueKeys.delete(cueKey)) return;
		const transient = transientActorByCueKey.get(cueKey);
		transientActorByCueKey.delete(cueKey);
		if (
			transient !== undefined &&
			transient.item.id === `motion:${cueKey}` &&
			!transient.container.destroyed
		) {
			RendererRuntime.runSync(animator.cancelActorFx(transient));
			RendererRuntime.runSync(destroyPixiTileActorFx(transient));
		}
		motionLanes =
			detachedSwapLegByActorId.size > 0
				? {
						active: motionLanes.active.filter(
							(activeCue) => readCueKey(activeCue) !== readCueKey(cue),
						),
						pending: motionLanes.pending,
					}
				: RendererRuntime.runSync(
						updateTileMotionLanesFx({
							action: {
								cue,
								type: "complete",
							},
							state: motionLanes,
						}),
					);
		const completedHandoffKey = readCueHandoffKey(cue);
		const handoffStillClaimed = readCues().some(
			(candidate) => readCueHandoffKey(candidate) === completedHandoffKey,
		);
		if (!handoffStillClaimed) claimedHandoffs.delete(completedHandoffKey);
		const stillClaimedActorIds = readRetainedActorIds();
		RendererRuntime.runSync(
			finalizePixiTileMotionActorsFx({
				actorIds: RendererRuntime.runSync(readTileMotionActorClaimsFx(cue)),
				actorStore,
				animator,
				application,
				readPalette,
				stillClaimedActorIds,
				surface,
				textures,
			}),
		);
		syncQuantities();
		if (
			cue.kind === "input" &&
			!stillClaimedActorIds.has(cue.sourceActorId) &&
			actorStore.canonicalItems.has(cue.sourceActorId)
		) {
			const sourceActor = actorStore.actors.get(cue.sourceActorId);
			if (sourceActor !== undefined && !sourceActor.container.destroyed) {
				RendererRuntime.runSync(
					startPixiTileActorFadeInFx({
						actor: sourceActor,
						animator,
					}),
				);
			}
		}
		if (detachedSwapLegByActorId.size === 0) startCues();
	}

	function readClaimedHandoff(cue: TileMotionCue) {
		const handoffKey = readCueHandoffKey(cue);
		const claimed = claimedHandoffs.get(handoffKey);
		if (claimed !== undefined) return claimed;
		const handoff = RendererRuntime.runSync(handoffs.takeFx(cue.originActorId));
		if (handoff !== null) claimedHandoffs.set(handoffKey, handoff);
		return handoff;
	}

	function startSwapLeg(cueKey: string, actorId: string) {
		const activeActorIds = activeSwapLegActorIdsByCueKey.get(cueKey);
		if (activeActorIds !== undefined) {
			activeActorIds.add(actorId);
			return;
		}
		activeSwapLegActorIdsByCueKey.set(
			cueKey,
			new Set([
				actorId,
			]),
		);
	}

	function settleSwapLeg(cueKey: string, actorId: string) {
		const activeActorIds = activeSwapLegActorIdsByCueKey.get(cueKey);
		activeActorIds?.delete(actorId);
		if (activeActorIds?.size === 0) activeSwapLegActorIdsByCueKey.delete(cueKey);
		const detached = detachedSwapLegByActorId.get(actorId);
		if (detached?.cueKey !== cueKey) return;
		detachedSwapLegByActorId.delete(actorId);
		RendererRuntime.runSync(
			finalizePixiTileMotionActorsFx({
				actorIds: new Set([
					actorId,
				]),
				actorStore,
				animator,
				application,
				readPalette,
				stillClaimedActorIds: readRetainedActorIds(),
				surface,
				textures,
			}),
		);
		if (detachedSwapLegByActorId.size > 0) return;
		motionLanes = RendererRuntime.runSync(
			updateTileMotionLanesFx({
				action: {
					cues: [],
					type: "enqueue",
				},
				state: motionLanes,
			}),
		);
		syncQuantities();
		startCues();
	}

	function startCue(cue: TileMotionCue) {
		const cueKey = readCueKey(cue);
		const readSourceSurvives = () => {
			if (cue.kind !== "input") return false;
			if (cue.sourceItem === undefined) {
				return actorStore.canonicalItems.has(cue.sourceActorId);
			}
			const latest = readCues()
				.filter(
					(candidate) =>
						candidate.kind === "input" && candidate.sourceActorId === cue.sourceActorId,
				)
				.at(-1);
			return latest?.kind === "input" && latest.resultingQuantity > 0;
		};
		RendererRuntime.runSync(
			runPixiTileMotionCueFx({
				actorStore,
				animator,
				application,
				cue,
				cueKey,
				magneticField,
				onComplete: () => completeCue(cue),
				onMagneticSourceAcquired: (actorId) => {
					activeMagneticSourceActorIds.add(actorId);
				},
				onMagneticSourceReleased: (actorId) => {
					activeMagneticSourceActorIds.delete(actorId);
				},
				onSwapLegSettled: (actorId) => {
					settleSwapLeg(cueKey, actorId);
				},
				onSwapLegStarted: (actorId) => {
					startSwapLeg(cueKey, actorId);
				},
				onTransientCreated: (actor) => {
					transientActorByCueKey.set(cueKey, actor);
				},
				readHandoff: () =>
					claimedHandoffs.get(readCueHandoffKey(cue)) ?? readClaimedHandoff(cue),
				readPalette,
				readSourceSurvives,
				readTargetRoute,
				surface,
				textures,
			}),
		);
	}

	function startCues() {
		for (const cue of motionLanes.active) {
			const cueKey = readCueKey(cue);
			if (startedCueKeys.has(cueKey)) continue;
			startedCueKeys.add(cueKey);
			startCue(cue);
		}
	}

	const settleReleasedActor = (actorId: string) =>
		Effect.gen(function* () {
			const actor = actorStore.actors.get(actorId);
			const canonical = actorStore.canonicalItems.get(actorId);
			if (actor === undefined || canonical === undefined || actor.container.destroyed) return;
			const target = yield* surface.readActorPoseFx(canonical);
			if (target === null) return;
			yield* settlePixiTileMotionActorFx({
				actor,
				animator,
				fallbackTarget: target,
				onSettled: () => {
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

	const isInterruptibleCueForActor = (
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
		beginInteractionHandoffFx: Effect.fn("PixiTileMotionRuntime.beginInteractionHandoffFx")(
			(actorId) =>
				Effect.gen(function* () {
					if (closed) return false;
					const detached = detachedSwapLegByActorId.get(actorId);
					const handedOffDetached = detached !== undefined;
					if (detached !== undefined) {
						yield* animator.cancelFx(detached.ownerKey);
						detachedSwapLegByActorId.delete(actorId);
						const activeActorIds = activeSwapLegActorIdsByCueKey.get(detached.cueKey);
						activeActorIds?.delete(actorId);
						if (activeActorIds?.size === 0) {
							activeSwapLegActorIdsByCueKey.delete(detached.cueKey);
						}
						releaseMagneticSource(actorId);
					}
					const cues = readCues();
					const superseded = cues.filter(
						(cue): cue is TileSpawnMotionCue | TileSwapMotionCue =>
							isInterruptibleCueForActor(cue, actorId),
					);
					if (superseded.length === 0) {
						if (!handedOffDetached) return false;
						if (detachedSwapLegByActorId.size === 0) {
							motionLanes = yield* updateTileMotionLanesFx({
								action: {
									cues: [],
									type: "enqueue",
								},
								state: motionLanes,
							});
							syncQuantities();
							startCues();
						}
						return true;
					}
					const supersededCueKeys = new Set(superseded.map(readCueKey));
					const hasBlockingClaim = cues.some(
						(cue) =>
							!supersededCueKeys.has(readCueKey(cue)) &&
							RendererRuntime.runSync(readTileMotionActorClaimsFx(cue)).has(actorId),
					);
					if (hasBlockingClaim) return false;

					const activeCounterpartIds = new Set<string>();
					const completedCounterpartIds = new Set<string>();
					const pendingCounterpartIds = new Set<string>();
					const activeSpawnActorIds = new Set<string>();
					const pendingSpawnActorIds = new Set<string>();
					for (const cue of superseded) {
						const cueKey = readCueKey(cue);
						const started = startedCueKeys.delete(cueKey);
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
										const activeActorIds =
											activeSwapLegActorIdsByCueKey.get(cueKey);
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
										if (activeActorIds?.size === 0) {
											activeSwapLegActorIdsByCueKey.delete(cueKey);
										}
									}),
							)
							.exhaustive();
						if (started) releaseMagneticSource(actorId);
						transientActorByCueKey.delete(cueKey);
					}
					const filteredMotionLanes = {
						active: motionLanes.active.filter(
							(cue) => !supersededCueKeys.has(readCueKey(cue)),
						),
						pending: motionLanes.pending.filter(
							(cue) => !supersededCueKeys.has(readCueKey(cue)),
						),
					};
					motionLanes =
						detachedSwapLegByActorId.size > 0
							? filteredMotionLanes
							: yield* updateTileMotionLanesFx({
									action: {
										cues: [],
										type: "enqueue",
									},
									state: filteredMotionLanes,
								});

					for (const cue of superseded) {
						const handoffKey = readCueHandoffKey(cue);
						if (
							!readCues().some(
								(candidate) => readCueHandoffKey(candidate) === handoffKey,
							)
						) {
							claimedHandoffs.delete(handoffKey);
						}
					}

					const stillClaimedActorIds = readRetainedActorIds();
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
						yield* finalizePixiTileMotionActorsFx({
							actorIds: settleActorIds,
							actorStore,
							animator,
							application,
							readPalette,
							stillClaimedActorIds,
							surface,
							textures,
						});
						yield* Effect.forEach(settleActorIds, settleReleasedActor, {
							discard: true,
						});
					}
					for (const pendingSpawnActorId of pendingSpawnActorIds) {
						if (activeSpawnActorIds.has(pendingSpawnActorId)) continue;
						const pendingSpawnActor = actorStore.actors.get(pendingSpawnActorId);
						if (
							pendingSpawnActor === undefined ||
							pendingSpawnActor.container.destroyed
						) {
							continue;
						}
						yield* startPixiTileActorFadeInFx({
							actor: pendingSpawnActor,
							animator,
						});
					}
					syncQuantities();
					if (detachedSwapLegByActorId.size === 0) startCues();
					return true;
				}),
		),
		enqueueFx: Effect.fn("PixiTileMotionRuntime.enqueueFx")((cues) =>
			Effect.sync(() => {
				if (closed || cues.length === 0) return;
				const uniqueCues = cues.filter((cue) => {
					const cueKey = readCueKey(cue);
					if (knownCueKeys.has(cueKey)) return false;
					knownCueKeys.add(cueKey);
					return true;
				});
				retainNewestCueKeys();
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
						: RendererRuntime.runSync(
								updateTileMotionLanesFx({
									action: {
										cues: uniqueCues,
										type: "enqueue",
									},
									state: motionLanes,
								}),
							);
			}),
		),
		redirectTargetFx: Effect.fn("PixiTileMotionRuntime.redirectTargetFx")((redirect) =>
			Effect.sync(() => {
				if (closed || redirect.sourceActorId === redirect.targetActorId) {
					return;
				}
				targetRedirectByActorId.delete(redirect.sourceActorId);
				targetRedirectByActorId.set(redirect.sourceActorId, redirect);
				retainNewestTargetRedirects();
			}),
		),
		readSnapshotFx: Effect.sync(
			(): PixiTileMotionSnapshot => ({
				interactionClaimByActorId: readInteractionClaims(),
				retainedActorIds: readRetainedActorIds(),
				spawnCueByActorId: new Map(
					readCues().flatMap((cue) =>
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
				unsettledInputSourceQuantities: readUnsettledInputSourceQuantities(),
				unsettledQuantities: readUnsettledQuantities(),
			}),
		),
		startFx: Effect.sync(() => startCues()),
		syncQuantitiesFx: Effect.sync(() => syncQuantities()),
		closeFx: Effect.gen(function* () {
			if (closed) return;
			closed = true;
			for (const cue of motionLanes.active) {
				const cueKey = readCueKey(cue);
				if (!startedCueKeys.has(cueKey)) continue;
				const animationKeys = yield* readPixiTileMotionAnimationKeysFx({
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
			for (const transientActor of transientActorByCueKey.values()) {
				yield* animator.cancelActorFx(transientActor);
				yield* destroyPixiTileActorFx(transientActor);
			}
			for (const actorId of [
				...activeMagneticSourceActorIds,
			]) {
				releaseMagneticSource(actorId);
			}
			motionLanes = emptyMotionLanes;
			knownCueKeys.clear();
			startedCueKeys.clear();
			claimedHandoffs.clear();
			transientActorByCueKey.clear();
			activeMagneticSourceActorIds.clear();
			activeSwapLegActorIdsByCueKey.clear();
			detachedSwapLegByActorId.clear();
			targetRedirectByActorId.clear();
		}),
	} satisfies PixiTileMotionRuntime;
});
