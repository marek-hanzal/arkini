import { Effect } from "effect";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { TileMotionCue } from "~/bridge/tile/motion/TileMotionCue";
import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import { createPixiTileActorFx } from "~/ui/pixi/actor/createPixiTileActorFx";
import { updatePixiTileActorFx } from "~/ui/pixi/actor/updatePixiTileActorFx";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { readPixiTileTravelDurationMsFx } from "~/ui/pixi/animation/readPixiTileTravelDurationMsFx";
import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";
import type { TileSceneHandoff } from "~/ui/pixi/handoff/TileSceneHandoff";
import type { TileSceneHandoffStore } from "~/ui/pixi/handoff/createTileSceneHandoffStoreFx";
import type {
	PixiTileMotionRuntime,
	PixiTileMotionSnapshot,
} from "~/ui/pixi/motion/PixiTileMotionRuntime";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import type { PixiTextureStore } from "~/ui/pixi/runtime/createPixiTextureStoreFx";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";
import type { TileMotionLanesState } from "~/ui/tile/motion/TileMotionLanesState";
import { readTileMotionActorClaimsFx } from "~/ui/tile/motion/readTileMotionActorClaimsFx";
import { readTileMotionStaggerDelaySecondsFx } from "~/ui/tile/motion/readTileMotionStaggerDelaySecondsFx";
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

/** Owns ordered tile cue lanes, transient payloads and cue completion cleanup. */
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
	const startedCueKeys = new Set<string>();
	const claimedHandoffs = new Map<string, TileSceneHandoff>();

	const cueKey = (cue: TileMotionCue) => `${cue.sequence}:${cue.eventIndex}`;
	const cueHandoffKey = (cue: TileMotionCue) => `${cue.sequence}:${cue.originActorId}`;

	const readOwnedActorIds = () => {
		const actorIds = new Set<string>();
		for (const cue of [
			...motionLanes.active,
			...motionLanes.pending,
		]) {
			for (const actorId of RendererRuntime.runSync(readTileMotionActorClaimsFx(cue))) {
				actorIds.add(actorId);
			}
		}
		return actorIds;
	};

	const readUnsettledQuantities = () =>
		RendererRuntime.runSync(
			readUnsettledTileStackQuantitiesFx({
				cues: [
					...motionLanes.active,
					...motionLanes.pending,
				],
			}),
		);

	const syncQuantities = () => {
		const unsettled = readUnsettledQuantities();
		for (const [actorId, hiddenQuantity] of unsettled) {
			const actor = actorStore.actors.get(actorId);
			const canonical = actorStore.canonicalItems.get(actorId);
			const pose =
				canonical === undefined
					? null
					: RendererRuntime.runSync(surface.readActorPoseFx(canonical));
			if (actor === undefined || canonical === undefined || pose === null) continue;
			RendererRuntime.runSync(
				updatePixiTileActorFx({
					actor,
					frames: application.frames,
					item: {
						...canonical,
						quantity: Math.max(1, canonical.quantity - hiddenQuantity),
					},
					palette: readPalette(),
					size: pose.size,
					textures,
				}),
			);
		}
		for (const [actorId, canonical] of actorStore.canonicalItems) {
			if (unsettled.has(actorId)) continue;
			const actor = actorStore.actors.get(actorId);
			const pose = RendererRuntime.runSync(surface.readActorPoseFx(canonical));
			if (
				actor === undefined ||
				pose === null ||
				actor.item.quantity === canonical.quantity
			) {
				continue;
			}
			RendererRuntime.runSync(
				updatePixiTileActorFx({
					actor,
					frames: application.frames,
					item: canonical,
					palette: readPalette(),
					size: pose.size,
					textures,
				}),
			);
		}
	};

	function completeCue(cue: TileMotionCue) {
		if (closed) return;
		startedCueKeys.delete(cueKey(cue));
		motionLanes = RendererRuntime.runSync(
			updateTileMotionLanesFx({
				action: {
					cue,
					type: "complete",
				},
				state: motionLanes,
			}),
		);
		const completedHandoffKey = cueHandoffKey(cue);
		const handoffStillClaimed = [
			...motionLanes.active,
			...motionLanes.pending,
		].some((candidate) => cueHandoffKey(candidate) === completedHandoffKey);
		if (!handoffStillClaimed) claimedHandoffs.delete(completedHandoffKey);
		const activeActorIds = readOwnedActorIds();
		for (const actorId of RendererRuntime.runSync(readTileMotionActorClaimsFx(cue))) {
			if (activeActorIds.has(actorId)) continue;
			const actor = actorStore.actors.get(actorId);
			if (actor === undefined) continue;
			if (actor.container.destroyed) {
				RendererRuntime.runSync(actorStore.deleteActorFx(actorId));
				continue;
			}
			const canonical = actorStore.canonicalItems.get(actorId);
			const pose =
				canonical === undefined
					? null
					: RendererRuntime.runSync(surface.readActorPoseFx(canonical));
			if (canonical === undefined || pose === null) {
				RendererRuntime.runSync(actorStore.deleteActorFx(actorId));
				RendererRuntime.runSync(animator.cancelFx(actorId));
				actor.textureGeneration += 1;
				actor.container.destroy({
					children: true,
				});
				continue;
			}
			actor.item = canonical;
			pose.layer.addChild(actor.container);
			actor.container.x = pose.x;
			actor.container.y = pose.y;
			actor.container.alpha = 1;
			actor.container.scale.set(1);
		}
		syncQuantities();
		startCues();
	}

	function startCue(cue: TileMotionCue) {
		const key = cueKey(cue);
		const target = RendererRuntime.runSync(surface.readLocationPoseFx(cue.targetLocation));
		let origin = RendererRuntime.runSync(surface.readLocationPoseFx(cue.originLocation));
		if (origin === null && target !== null) {
			const handoffKey = cueHandoffKey(cue);
			let handoff = claimedHandoffs.get(handoffKey) ?? null;
			if (handoff === null) {
				handoff = RendererRuntime.runSync(handoffs.takeFx(cue.originActorId));
				if (handoff !== null) claimedHandoffs.set(handoffKey, handoff);
			}
			if (handoff !== null) {
				const canvasRect = application.app.canvas.getBoundingClientRect();
				origin = {
					layer: surface.transientActorLayer,
					size: handoff.size,
					x: handoff.centerX - canvasRect.left - target.size / 2,
					y: handoff.centerY - canvasRect.top - target.size / 2,
				};
			}
		}
		if (origin === null || target === null) {
			const actor = cue.kind === "spawn" ? actorStore.actors.get(cue.actorId) : undefined;
			if (actor !== undefined && target !== null) {
				target.layer.addChild(actor.container);
				actor.container.x = target.x;
				actor.container.y = target.y;
				actor.container.alpha = 1;
			}
			completeCue(cue);
			return;
		}
		const delayMs =
			RendererRuntime.runSync(readTileMotionStaggerDelaySecondsFx(cue.staggerIndex)) * 1000;
		if (cue.kind === "stack") {
			const canonical = actorStore.canonicalItems.get(cue.targetActorId);
			if (canonical === undefined) {
				completeCue(cue);
				return;
			}
			const transient = RendererRuntime.runSync(
				createPixiTileActorFx({
					frames: application.frames,
					item: {
						...canonical,
						id: `motion:${key}`,
						quantity: cue.quantity,
					},
					palette: readPalette(),
					textures,
				}),
			);
			transient.container.eventMode = "none";
			surface.transientActorLayer.addChild(transient.container);
			transient.container.x = origin.x;
			transient.container.y = origin.y;
			RendererRuntime.runSync(
				updatePixiTileActorFx({
					actor: transient,
					frames: application.frames,
					item: transient.item,
					palette: readPalette(),
					size: target.size,
					textures,
				}),
			);
			const durationMs = RendererRuntime.runSync(
				readPixiTileTravelDurationMsFx({
					fromX: origin.x,
					fromY: origin.y,
					tileSize: target.size,
					toX: target.x,
					toY: target.y,
				}),
			);
			RendererRuntime.runSync(
				animator.animateFx({
					actor: transient,
					animationKey: `motion:${key}`,
					delayMs,
					durationMs,
					onComplete: () => {
						if (!transient.container.destroyed) {
							transient.textureGeneration += 1;
							transient.container.destroy({
								children: true,
							});
						}
						completeCue(cue);
					},
					toX: target.x,
					toY: target.y,
				}),
			);
			return;
		}

		const actor = actorStore.actors.get(cue.actorId);
		if (actor === undefined) {
			completeCue(cue);
			return;
		}
		RendererRuntime.runSync(animator.cancelFx(actor.item.id));
		surface.transientActorLayer.addChild(actor.container);
		if (cue.kind === "swap") actor.container.alpha = 1;
		actor.container.x = origin.x;
		actor.container.y = origin.y;
		const durationMs = RendererRuntime.runSync(
			readPixiTileTravelDurationMsFx({
				fromX: origin.x,
				fromY: origin.y,
				tileSize: target.size,
				toX: target.x,
				toY: target.y,
			}),
		);
		RendererRuntime.runSync(
			animator.animateFx({
				actor,
				animationKey: `motion:${key}`,
				delayMs,
				durationMs,
				...(cue.kind === "spawn"
					? {
							toAlpha: 1,
						}
					: {}),
				onComplete: () => {
					const currentTarget =
						RendererRuntime.runSync(surface.readLocationPoseFx(cue.targetLocation)) ??
						target;
					if (!actor.container.destroyed) {
						currentTarget.layer.addChild(actor.container);
						actor.container.x = currentTarget.x;
						actor.container.y = currentTarget.y;
					}
					completeCue(cue);
				},
				toX: target.x,
				toY: target.y,
			}),
		);
	}

	function startCues() {
		for (const cue of motionLanes.active) {
			const key = cueKey(cue);
			if (startedCueKeys.has(key)) continue;
			startedCueKeys.add(key);
			startCue(cue);
		}
	}

	return {
		enqueueFx: Effect.fn("PixiTileMotionRuntime.enqueueFx")((cues) =>
			Effect.sync(() => {
				if (closed || cues.length === 0) return;
				motionLanes = RendererRuntime.runSync(
					updateTileMotionLanesFx({
						action: {
							cues,
							type: "enqueue",
						},
						state: motionLanes,
					}),
				);
			}),
		),
		readSnapshotFx: Effect.sync(
			(): PixiTileMotionSnapshot => ({
				ownedActorIds: readOwnedActorIds(),
				spawnCueByActorId: new Map(
					[
						...motionLanes.active,
						...motionLanes.pending,
					].flatMap((cue) =>
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
		closeFx: Effect.sync(() => {
			closed = true;
			motionLanes = emptyMotionLanes;
			startedCueKeys.clear();
			claimedHandoffs.clear();
		}),
	} satisfies PixiTileMotionRuntime;
});
