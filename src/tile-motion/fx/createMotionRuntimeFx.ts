import { Effect } from "effect";
import { match } from "ts-pattern";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { TileMotionCue } from "~/tile-presentation/type/TileMotionCue";
import type { MainActorStore } from "~/tile-rendering/service/MainActorStore";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
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
	started: boolean;
}

const createCueLifecycleFn = (): CueLifecycle => ({
	started: false,
});

/**
 * Owns ordered presentation-cue lanes, idempotency, interaction claims, and completion cleanup.
 *
 * Cues are already compiled from committed engine facts. This runtime may serialize conflicting
 * presentation work, but it must never reinterpret a cue as a new gameplay mutation. Closing
 * cancels every keyed writer before releasing cue ownership.
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

	function completeCue(cue: TileMotionCue) {
		const cueKey = readCueKeyFn(cue);
		const lifecycle = cueLifecycleByKey.get(cueKey);
		if (closed || lifecycle?.started !== true) return;
		cueLifecycleByKey.delete(cueKey);
		motionLanes = updateTileMotionLanesFn({
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
				readPaletteFn,
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
					action: {
						cues: uniqueCues,
						type: "enqueue",
					},
					state: motionLanes,
				});
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
			}),
		),
		startFx: Effect.sync(() => startCues()),
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
			motionLanes = emptyMotionLanes;
			knownCueKeys.clear();
			cueLifecycleByKey.clear();
		}),
	} satisfies MotionRuntime;
});
