import { Effect } from "effect";
import { match } from "ts-pattern";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type {
	TileMotionCue,
	TileRelocationMotionCue,
	TileSpawnMotionCue,
	TileSwapMotionCue,
} from "~/bridge/tile/motion/TileMotionCue";
import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import { destroyPixiTileActorFx } from "~/ui/pixi/actor/destroyPixiTileActorFx";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { startPixiTileActorFadeInFx } from "~/ui/pixi/animation/startPixiTileActorFadeInFx";
import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";
import type { PixiTileMagneticField } from "~/ui/pixi/magnet/PixiTileMagneticField";
import type {
	PixiTileMotionRuntime,
	PixiTileMotionSnapshot,
} from "~/ui/pixi/motion/PixiTileMotionRuntime";
import { finalizePixiTileMotionActorsFx } from "~/ui/pixi/motion/finalizePixiTileMotionActorsFx";
import { readPixiTileInteractionClaimsFx } from "~/ui/pixi/motion/readPixiTileInteractionClaimsFx";
import { readPixiTileMotionAnimationKeysFx } from "~/ui/pixi/motion/readPixiTileMotionAnimationKeysFx";
import { readPixiTileQuantityPresentationFx } from "~/ui/pixi/motion/readPixiTileQuantityPresentationFx";
import { runPixiTileMotionCueFx } from "~/ui/pixi/motion/runPixiTileMotionCueFx";
import { chasePixiTileMotionTargetFx } from "~/ui/pixi/motion/chasePixiTileMotionTargetFx";
import { syncPixiTileMotionPresentationFx } from "~/ui/pixi/motion/syncPixiTileMotionPresentationFx";
import type {
	PixiTileMotionTargetRedirect,
	PixiTileMotionTargetRoute,
} from "~/ui/pixi/motion/PixiTileMotionTargetRoute";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import type { PixiTextureStore } from "~/ui/pixi/runtime/createPixiTextureStoreFx";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";
import type { TileMotionLanesState } from "~/ui/tile/motion/TileMotionLanesState";
import { readTileMotionActorClaimsFx } from "~/ui/tile/motion/readTileMotionActorClaimsFx";
import { updateTileMotionLanesFx } from "~/ui/tile/motion/updateTileMotionLanesFx";

export namespace createPixiTileMotionRuntimeFx {
	export interface Props {
		readonly actorStore: PixiMainSceneActorStore;
		readonly animator: PixiActorAnimator;
		readonly application: PixiApplicationOwner;
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

interface PixiTileMotionCueLifecycle {
	readonly activeSwapLegActorIds: Set<string>;
	inputRemainderRevealed: boolean;
	payloadActor: PixiTileActor | null;
	started: boolean;
}

const createCueLifecycle = (): PixiTileMotionCueLifecycle => ({
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
export const createPixiTileMotionRuntimeFx = Effect.fn("createPixiTileMotionRuntimeFx")(function* ({
	actorStore,
	animator,
	application,
	magneticField,
	readPalette,
	surface,
	textures,
}: createPixiTileMotionRuntimeFx.Props) {
	let closed = false;
	let motionLanes: TileMotionLanesState = emptyMotionLanes;
	const knownCueKeys = new Set<string>();
	const cueLifecycleByKey = new Map<string, PixiTileMotionCueLifecycle>();
	const detachedSwapLegByActorId = new Map<string, PixiDetachedSwapLeg>();
	const targetRedirectByActorId = new Map<string, PixiTileMotionTargetRedirect>();

	const readCueKey = (cue: TileMotionCue) => `${cue.sequence}:${cue.eventIndex}`;
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

	const readQuantityPresentation = () => {
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
		return RendererRuntime.runSync(
			readPixiTileQuantityPresentationFx({
				cues: readCues(),
				readTargetRoute,
				revealedInputCueKeys,
			}),
		);
	};

	const syncPresentation = () => {
		RendererRuntime.runSync(
			syncPixiTileMotionPresentationFx({
				actorStore,
				animator,
				application,
				quantityPresentationByActorId: readQuantityPresentation(),
				readPalette,
				surface,
				textures,
			}),
		);
	};

	const releaseMagneticSource = (actorId: string) => {
		RendererRuntime.runSync(
			magneticField.releaseFx({
				sourceActorId: actorId,
				sourceKind: "motion",
			}),
		);
	};

	const releaseDetachedCueLifecycleIfSettled = (cueKey: string) => {
		const lifecycle = cueLifecycleByKey.get(cueKey);
		if (lifecycle === undefined || lifecycle.activeSwapLegActorIds.size > 0) return;
		const hasDetachedLeg = [
			...detachedSwapLegByActorId.values(),
		].some((detached) => detached.cueKey === cueKey);
		if (!hasDetachedLeg) cueLifecycleByKey.delete(cueKey);
	};

	function completeCue(cue: TileMotionCue) {
		const cueKey = readCueKey(cue);
		const lifecycle = cueLifecycleByKey.get(cueKey);
		if (closed || lifecycle?.started !== true) return;
		cueLifecycleByKey.delete(cueKey);
		const payload = lifecycle.payloadActor;
		if (payload !== null && !payload.container.destroyed) {
			RendererRuntime.runSync(animator.cancelActorFx(payload));
			RendererRuntime.runSync(destroyPixiTileActorFx(payload));
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
		syncPresentation();
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
		releaseDetachedCueLifecycleIfSettled(cueKey);
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
		syncPresentation();
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
				onSwapLegSettled: (actorId) => {
					settleSwapLeg(cueKey, actorId);
				},
				onSwapLegStarted: (actorId) => {
					startSwapLeg(cueKey, actorId);
				},
				onPayloadCreated: (actor) => {
					const lifecycle = cueLifecycleByKey.get(cueKey);
					if (lifecycle !== undefined) lifecycle.payloadActor = actor;
				},
				onInputRemainderRevealed: () => {
					const lifecycle = cueLifecycleByKey.get(cueKey);
					if (lifecycle === undefined) return;
					lifecycle.inputRemainderRevealed = true;
					syncPresentation();
				},
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
			const lifecycle = cueLifecycleByKey.get(cueKey);
			if (lifecycle === undefined || lifecycle.started) continue;
			lifecycle.started = true;
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
			yield* chasePixiTileMotionTargetFx({
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
	): cue is TileSpawnMotionCue | TileSwapMotionCue | TileRelocationMotionCue =>
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
			.with(
				{
					kind: "relocation",
				},
				(relocation) => relocation.actorId === actorId,
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
						const lifecycle = cueLifecycleByKey.get(detached.cueKey);
						lifecycle?.activeSwapLegActorIds.delete(actorId);
						releaseDetachedCueLifecycleIfSettled(detached.cueKey);
						releaseMagneticSource(actorId);
					}
					const cues = readCues();
					const superseded = cues.filter(
						(
							cue,
						): cue is
							| TileSpawnMotionCue
							| TileSwapMotionCue
							| TileRelocationMotionCue => isInterruptibleCueForActor(cue, actorId),
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
							syncPresentation();
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
							.with(
								{
									kind: "relocation",
								},
								() =>
									Effect.gen(function* () {
										if (!started) return;
										yield* animator.cancelFx(`motion:${cueKey}:${actorId}`);
										lifecycle?.activeSwapLegActorIds.delete(actorId);
									}),
							)
							.exhaustive();
						if (started) releaseMagneticSource(actorId);
						if (lifecycle !== undefined) lifecycle.payloadActor = null;
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
					for (const cueKey of supersededCueKeys) {
						releaseDetachedCueLifecycleIfSettled(cueKey);
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
					syncPresentation();
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
					cueLifecycleByKey.set(cueKey, createCueLifecycle());
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
				quantityPresentationByActorId: readQuantityPresentation(),
			}),
		),
		startFx: Effect.sync(() => startCues()),
		syncPresentationFx: Effect.sync(() => syncPresentation()),
		closeFx: Effect.gen(function* () {
			if (closed) return;
			closed = true;
			for (const cue of motionLanes.active) {
				const cueKey = readCueKey(cue);
				if (cueLifecycleByKey.get(cueKey)?.started !== true) continue;
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
			for (const { payloadActor } of cueLifecycleByKey.values()) {
				if (payloadActor === null) continue;
				yield* animator.cancelActorFx(payloadActor);
				yield* destroyPixiTileActorFx(payloadActor);
			}
			yield* magneticField.releaseSourcesFx("motion");
			motionLanes = emptyMotionLanes;
			knownCueKeys.clear();
			cueLifecycleByKey.clear();
			detachedSwapLegByActorId.clear();
			targetRedirectByActorId.clear();
		}),
	} satisfies PixiTileMotionRuntime;
});
