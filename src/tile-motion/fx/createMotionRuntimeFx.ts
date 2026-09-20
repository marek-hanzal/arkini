import { Effect } from "effect";
import { match } from "ts-pattern";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { TileMotionCue } from "~/tile-presentation/type/TileMotionCue";
import type { MainActorStore } from "~/tile-rendering/service/MainActorStore";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import { destroyTileActorFx } from "~/tile-rendering/fx/destroyTileActorFx";
import type { ActorAnimator } from "~/tile-rendering/service/ActorAnimator";
import { restoreActorExitFx } from "~/tile-rendering/fx/restoreActorExitFx";
import { startActorEnterFx } from "~/tile-rendering/fx/startActorEnterFx";
import type { PixiScenePalette } from "~/tile-rendering/type/PixiScenePalette";
import type {
	InteractionClaim,
	MotionRuntime,
	MotionSnapshot,
} from "~/tile-motion/service/MotionRuntime";
import { finalizeMotionActorsFx } from "~/tile-motion/fx/finalizeMotionActorsFx";
import { runMotionCueFx } from "~/tile-motion/fx/runMotionCueFx";
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
		readonly onActorSettledFn: (actor: PixiTileActor) => void;
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

/** Moving actors remain unavailable until their cue settles. */
const readInteractionClaimsFn = (cues: ReadonlyArray<TileMotionCue>) => {
	const claims = new Map<string, InteractionClaim>();
	for (const cue of cues) {
		match(cue)
			.with(
				{
					kind: "spawn",
				},
				(spawn) => {
					claims.set(spawn.actorId, "blocked");
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
					claims.set(input.sourceActorId, "blocked");
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
						claims.set(actorId, "blocked");
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

interface CueLifecycle {
	inputRemainderRevealed: boolean;
	payloadActor: PixiTileActor | null;
	started: boolean;
}

const createCueLifecycleFn = (): CueLifecycle => ({
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
	onActorSettledFn,
	readPaletteFn,
	surface,
	textures,
}: createMotionRuntimeFx.Props) {
	let closed = false;
	let motionLanes: updateTileMotionLanesFn.State = emptyMotionLanes;
	const knownCueKeys = new Set<string>();
	const cueLifecycleByKey = new Map<string, CueLifecycle>();
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

	const readCurrentInteractionClaimsFn = () => readInteractionClaimsFn(readCuesFn());

	const readRetainedActorIdsFn = () => {
		const actorIds = new Set<string>();
		for (const cue of readCuesFn()) {
			for (const actorId of readTileMotionActorClaimsFn(cue)) {
				actorIds.add(actorId);
			}
		}
		return actorIds;
	};

	const readRevealedInputCueKeysFn = () =>
		new Set(
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

	const readCurrentQuantityPresentationFn = () => {
		const cues = readCuesFn();
		const revealedInputCueKeys = readRevealedInputCueKeysFn();
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
		motionLanes = updateTileMotionLanesFn({
			releasedInputTargetCueKeys: readRevealedInputCueKeysFn(),
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
				onActorSettledFn,
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
		startCues();
	}

	function startCue(cue: TileMotionCue) {
		const cueKey = readCueKeyFn(cue);
		const readSourceSurvivesFn = () =>
			cue.kind === "input" && actorStore.canonicalItems.has(cue.sourceActorId);
		RendererRuntime.runSync(
			runMotionCueFx({
				actorStore,
				animator,
				application,
				cue,
				cueKey,
				isCueActiveFn: () => !closed && cueLifecycleByKey.get(cueKey)?.started === true,
				onActorSettledFn,
				onCompleteFn: () => completeCue(cue),
				onPayloadCreatedFn: (actor) => {
					const lifecycle = cueLifecycleByKey.get(cueKey);
					if (lifecycle !== undefined) lifecycle.payloadActor = actor;
				},
				onInputRemainderRevealedFn: () => {
					const lifecycle = cueLifecycleByKey.get(cueKey);
					if (lifecycle === undefined) return;
					lifecycle.inputRemainderRevealed = true;
					// Contact releases the receiver; only the source remains claimed during its return.
					motionLanes = updateTileMotionLanesFn({
						action: {
							cues: [],
							type: "enqueue",
						},
						state: motionLanes,
						releasedInputTargetCueKeys: readRevealedInputCueKeysFn(),
					});
					syncPresentationFn();
					startCues();
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

	return {
		handoffDeliveriesFx: Effect.fn("MotionRuntime.handoffDeliveriesFx")(function* (
			actorIds: ReadonlySet<string>,
		) {
			if (closed) return;
			const superseded = readCuesFn().filter(
				(cue) =>
					(cue.kind === "spawn" && actorIds.has(cue.actorId)) ||
					(cue.kind === "input" && actorIds.has(cue.sourceActorId)) ||
					(cue.kind === "swap" &&
						(actorIds.has(cue.actorId) || actorIds.has(cue.counterpartActorId))),
			);
			if (superseded.length === 0) return;
			const keys = new Set(superseded.map(readCueKeyFn));
			const releasedActorIds = new Set<string>();
			for (const cue of superseded) {
				const key = readCueKeyFn(cue);
				const lifecycle = cueLifecycleByKey.get(key);
				const started = lifecycle?.started === true;
				// Retire before cancellation: callbacks must not settle or restart this cue.
				cueLifecycleByKey.delete(key);
				for (const animationKey of readMotionAnimationKeysFn({
					cue,
					cueKey: key,
				})) {
					yield* animator.cancelFx(animationKey);
				}
				if (cue.kind === "input" && started) {
					const actor = actorStore.actors.get(cue.sourceActorId);
					if (actor !== undefined && !actor.container.destroyed) {
						// The real source survives for delivery; retire any input contact fade.
						yield* animator.setFx({
							actor,
							channel: "lifecycle-opacity",
							alpha: 1,
						});
						yield* animator.setFx({
							actor,
							channel: "lifecycle-scale",
							scale: 1,
						});
					}
				}
				if (!started && cue.kind === "spawn") {
					const actor = actorStore.actors.get(cue.actorId);
					if (actor !== undefined)
						yield* startActorEnterFx({
							actor,
							animator,
						});
				}
				for (const actorId of readTileMotionActorClaimsFn(cue)) {
					if (actorIds.has(actorId)) continue;
					releasedActorIds.add(actorId);
				}
			}
			motionLanes = {
				active: motionLanes.active.filter((cue) => !keys.has(readCueKeyFn(cue))),
				pending: motionLanes.pending.filter((cue) => !keys.has(readCueKeyFn(cue))),
			};
			motionLanes = updateTileMotionLanesFn({
				releasedInputTargetCueKeys: readRevealedInputCueKeysFn(),
				action: {
					type: "enqueue",
					cues: [],
				},
				state: motionLanes,
			});
			yield* finalizeMotionActorsFx({
				actorIds: releasedActorIds,
				actorStore,
				animator,
				application,
				onActorSettledFn,
				readPaletteFn,
				stillClaimedActorIds: readRetainedActorIdsFn(),
				surface,
				textures,
			});
			// Reconciliation finishes the delivery takeover before startFx starts successors.
		}),
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
				motionLanes = updateTileMotionLanesFn({
					releasedInputTargetCueKeys: readRevealedInputCueKeysFn(),
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
			for (const { payloadActor } of cueLifecycleByKey.values()) {
				if (payloadActor === null) continue;
				yield* animator.cancelActorFx(payloadActor);
				yield* destroyTileActorFx(payloadActor);
			}
			motionLanes = emptyMotionLanes;
			knownCueKeys.clear();
			cueLifecycleByKey.clear();
			targetRedirectByActorId.clear();
		}),
	} satisfies MotionRuntime;
});
