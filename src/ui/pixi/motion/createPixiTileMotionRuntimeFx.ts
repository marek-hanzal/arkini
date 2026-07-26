import { Effect } from "effect";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { TileMotionCue } from "~/bridge/tile/motion/TileMotionCue";
import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import { destroyPixiTileActorFx } from "~/ui/pixi/actor/destroyPixiTileActorFx";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";
import type { TileSceneHandoff } from "~/ui/pixi/handoff/TileSceneHandoff";
import type { TileSceneHandoffStore } from "~/ui/pixi/handoff/createTileSceneHandoffStoreFx";
import type {
	PixiTileMotionRuntime,
	PixiTileMotionSnapshot,
} from "~/ui/pixi/motion/PixiTileMotionRuntime";
import { finalizePixiTileMotionActorsFx } from "~/ui/pixi/motion/finalizePixiTileMotionActorsFx";
import { readPixiTileInteractionClaimsFx } from "~/ui/pixi/motion/readPixiTileInteractionClaimsFx";
import { readPixiTileMotionAnimationKeysFx } from "~/ui/pixi/motion/readPixiTileMotionAnimationKeysFx";
import { runPixiTileMotionCueFx } from "~/ui/pixi/motion/runPixiTileMotionCueFx";
import { syncPixiTileMotionQuantitiesFx } from "~/ui/pixi/motion/syncPixiTileMotionQuantitiesFx";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import type { PixiTextureStore } from "~/ui/pixi/runtime/createPixiTextureStoreFx";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";
import type { TileMotionLanesState } from "~/ui/tile/motion/TileMotionLanesState";
import { readTileMotionActorClaimsFx } from "~/ui/tile/motion/readTileMotionActorClaimsFx";
import { readUnsettledTileStackQuantitiesFx } from "~/ui/tile/motion/readUnsettledTileStackQuantitiesFx";
import { updateTileMotionLanesFx } from "~/ui/tile/motion/updateTileMotionLanesFx";

export namespace createPixiTileMotionRuntimeFx {
	export interface Props {
		readonly actorStore: PixiMainSceneActorStore;
		readonly animator: PixiActorAnimator;
		readonly application: PixiApplicationOwner;
		readonly handoffs: TileSceneHandoffStore;
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

	const readInteractionClaims = () =>
		RendererRuntime.runSync(readPixiTileInteractionClaimsFx(readCues()));

	const readOwnedActorIds = () => new Set(readInteractionClaims().keys());

	const readUnsettledQuantities = () =>
		RendererRuntime.runSync(
			readUnsettledTileStackQuantitiesFx({
				cues: readCues(),
			}),
		);

	const syncQuantities = () => {
		RendererRuntime.runSync(
			syncPixiTileMotionQuantitiesFx({
				actorStore,
				application,
				readPalette,
				surface,
				textures,
				unsettledQuantities: readUnsettledQuantities(),
			}),
		);
	};

	function completeCue(cue: TileMotionCue) {
		if (closed || !startedCueKeys.delete(readCueKey(cue))) return;
		transientActorByCueKey.delete(readCueKey(cue));
		motionLanes = RendererRuntime.runSync(
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
		RendererRuntime.runSync(
			finalizePixiTileMotionActorsFx({
				actorIds: RendererRuntime.runSync(readTileMotionActorClaimsFx(cue)),
				actorStore,
				animator,
				stillClaimedActorIds: readOwnedActorIds(),
				surface,
			}),
		);
		syncQuantities();
		startCues();
	}

	function readClaimedHandoff(cue: TileMotionCue) {
		const handoffKey = readCueHandoffKey(cue);
		const claimed = claimedHandoffs.get(handoffKey);
		if (claimed !== undefined) return claimed;
		const handoff = RendererRuntime.runSync(handoffs.takeFx(cue.originActorId));
		if (handoff !== null) claimedHandoffs.set(handoffKey, handoff);
		return handoff;
	}

	function startCue(cue: TileMotionCue) {
		const cueKey = readCueKey(cue);
		RendererRuntime.runSync(
			runPixiTileMotionCueFx({
				actorStore,
				animator,
				application,
				cue,
				cueKey,
				onComplete: () => completeCue(cue),
				onTransientCreated: (actor) => {
					transientActorByCueKey.set(cueKey, actor);
				},
				readHandoff: () =>
					claimedHandoffs.get(readCueHandoffKey(cue)) ?? readClaimedHandoff(cue),
				readPalette,
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

	return {
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
				motionLanes = RendererRuntime.runSync(
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
		readSnapshotFx: Effect.sync(
			(): PixiTileMotionSnapshot => ({
				interactionClaimByActorId: readInteractionClaims(),
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
			for (const transientActor of transientActorByCueKey.values()) {
				yield* destroyPixiTileActorFx(transientActor);
			}
			motionLanes = emptyMotionLanes;
			knownCueKeys.clear();
			startedCueKeys.clear();
			claimedHandoffs.clear();
			transientActorByCueKey.clear();
		}),
	} satisfies PixiTileMotionRuntime;
});
