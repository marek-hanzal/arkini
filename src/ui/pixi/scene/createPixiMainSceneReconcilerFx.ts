import { Effect } from "effect";

import type { GameEngine } from "~/bridge/game/GameEngine";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import { readCommittedTileReplacementsFx } from "~/bridge/tile/motion/readCommittedTileReplacementsFx";
import { readCommittedTileSwapMotionCueFx } from "~/bridge/tile/motion/readCommittedTileSwapMotionCueFx";
import { readTileMotionCuesFx } from "~/bridge/tile/motion/readTileMotionCuesFx";
import { readTileActorsFx } from "~/bridge/tile/readTileActorsFx";
import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import { createPixiTileActorFx } from "~/ui/pixi/actor/createPixiTileActorFx";
import { destroyPixiTileActorFx } from "~/ui/pixi/actor/destroyPixiTileActorFx";
import { updatePixiTileActorFx } from "~/ui/pixi/actor/updatePixiTileActorFx";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { readPixiTileTravelDurationMsFx } from "~/ui/pixi/animation/readPixiTileTravelDurationMsFx";
import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";
import type { PixiMainSceneDragController } from "~/ui/pixi/drag/PixiMainSceneDragController";
import type { PixiMainSceneDropPresentation } from "~/ui/pixi/drop/PixiMainSceneDropPresentation";
import type { PixiTileMagneticField } from "~/ui/pixi/magnet/PixiTileMagneticField";
import type { PixiTileMotionRuntime } from "~/ui/pixi/motion/PixiTileMotionRuntime";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import type { PixiTextureStore } from "~/ui/pixi/runtime/createPixiTextureStoreFx";
import type { PixiMainSceneReconciler } from "~/ui/pixi/scene/PixiMainSceneReconciler";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";
import { releasePixiMainSceneActorFx } from "~/ui/pixi/scene/releasePixiMainSceneActorFx";
import { runPixiMainSceneReplacementsFx } from "~/ui/pixi/scene/runPixiMainSceneReplacementsFx";

export namespace createPixiMainSceneReconcilerFx {
	export interface Props {
		readonly actorStore: PixiMainSceneActorStore;
		readonly animator: PixiActorAnimator;
		readonly application: PixiApplicationOwner;
		readonly drag: PixiMainSceneDragController;
		readonly dropPresentation: PixiMainSceneDropPresentation;
		readonly game: GameEngine;
		readonly magneticField: PixiTileMagneticField;
		readonly motion: PixiTileMotionRuntime;
		readonly readPalette: () => PixiScenePalette;
		readonly surface: PixiMainSceneSurface;
		readonly textures: PixiTextureStore;
	}
}

const sameLocation = (left: TileActorItem["location"], right: TileActorItem["location"]) =>
	JSON.stringify(left) === JSON.stringify(right);

const readRunningAlpha = (running: boolean) => (running ? 0.82 : 1);
const runningTransitionDurationMs = 180;

const sameVisual = (left: TileActorItem, right: TileActorItem) =>
	left.revision === right.revision &&
	left.title === right.title &&
	left.quantity === right.quantity &&
	left.sourceUrl === right.sourceUrl &&
	left.compositeUrl === right.compositeUrl &&
	left.running === right.running &&
	left.primaryAction.kind === right.primaryAction.kind &&
	(left.primaryAction.kind !== "start-default-line" ||
		(right.primaryAction.kind === "start-default-line" &&
			left.primaryAction.lineId === right.primaryAction.lineId));

/**
 * Reconciles one canonical transition into retained actors while motion owns presentation lag.
 *
 * Motion/drop claims may temporarily retain, hide, or offset actors, but this owner never infers a
 * gameplay result. It derives actors and cues through bridge reads and eventually converges every
 * unclaimed display object to the committed snapshot.
 */
export const createPixiMainSceneReconcilerFx = Effect.fn("createPixiMainSceneReconcilerFx")(
	function* ({
		actorStore,
		animator,
		application,
		drag,
		dropPresentation,
		game,
		magneticField,
		motion,
		readPalette,
		surface,
		textures,
	}: createPixiMainSceneReconcilerFx.Props) {
		const processedReplacementKeys = new Set<string>();
		let exitGeneration = 0;
		let closed = false;

		const refreshActor = (actor: NonNullable<ReturnType<typeof actorStore.actors.get>>) => {
			const pose = RendererRuntime.runSync(surface.readActorPoseFx(actor.item));
			if (pose === null) return;
			RendererRuntime.runSync(
				updatePixiTileActorFx({
					actor,
					frames: application.frames,
					item: actor.item,
					palette: readPalette(),
					size: pose.size,
					textures,
				}),
			);
		};

		const removeActorImmediatelyFx = Effect.fn(
			"PixiMainSceneReconciler.removeActorImmediatelyFx",
		)(function* (actorId: string) {
			const actor = yield* releasePixiMainSceneActorFx({
				actorId,
				actorStore,
				animator,
				drag,
			});
			if (actor === null) return;
			yield* destroyPixiTileActorFx(actor);
			yield* application.frames.invalidateFx;
		});

		const reconcileFx = Effect.fn("PixiMainSceneReconciler.reconcileFx")(function* (
			transition: ReturnType<GameEngine["getTransitionSnapshot"]>,
		) {
			if (closed) return;
			const nextItems = game.readOrThrow(
				readTileActorsFx({
					game,
					runtime: transition.runtime,
					surface: "main",
				}),
			);
			const inventoryActorIds = new Set(
				game
					.readOrThrow(
						readTileActorsFx({
							game,
							runtime: transition.runtime,
							surface: "inventory",
						}),
					)
					.map((item) => item.id),
			);
			const dropSnapshot = yield* dropPresentation.readSnapshotFx;
			yield* actorStore.replaceCanonicalItemsFx(nextItems);
			const compiledCues = [
				...RendererRuntime.runSync(readTileMotionCuesFx(transition)),
			];
			const replacements = RendererRuntime.runSync(
				readCommittedTileReplacementsFx({
					game,
					transition,
				}),
			);
			if (dropSnapshot.swap !== null) {
				const swapCue = RendererRuntime.runSync(
					readCommittedTileSwapMotionCueFx({
						...dropSnapshot.swap.candidate,
						transition,
					}),
				);
				if (swapCue !== null) {
					compiledCues.push(swapCue);
					yield* dropPresentation.clearSwapFx(dropSnapshot.swap.generation);
				}
			}
			yield* motion.enqueueFx(compiledCues);
			const motionSnapshot = yield* motion.readSnapshotFx;
			const visibleItems = new Map(
				nextItems.flatMap((item) =>
					dropSnapshot.hiddenActorIds.has(item.id) ||
					RendererRuntime.runSync(surface.readActorPoseFx(item)) === null
						? []
						: [
								[
									item.id,
									item,
								],
							],
				),
			);
			for (const id of actorStore.actors.keys()) {
				if (visibleItems.has(id)) continue;
				if (dropSnapshot.pendingActorIds.has(id)) continue;
				if (dropSnapshot.hiddenActorIds.has(id)) {
					yield* removeActorImmediatelyFx(id);
					continue;
				}
				if (inventoryActorIds.has(id)) {
					yield* removeActorImmediatelyFx(id);
					continue;
				}
				if (motionSnapshot.interactionClaimByActorId.has(id)) continue;
				const releasedActor = yield* releasePixiMainSceneActorFx({
					actorId: id,
					actorStore,
					animator,
					drag,
				});
				if (releasedActor === null) continue;
				exitGeneration += 1;
				yield* animator.animateFx({
					actor: releasedActor,
					animationKey: `exit:${id}:${exitGeneration}`,
					durationMs: 220,
					onComplete: () => {
						RendererRuntime.runSync(destroyPixiTileActorFx(releasedActor));
					},
					toAlpha: 0,
					toScale: 0.76,
					toX: releasedActor.container.x,
					toY: releasedActor.container.y,
				});
			}

			for (const item of visibleItems.values()) {
				const pose = RendererRuntime.runSync(surface.readActorPoseFx(item));
				if (pose === null) continue;
				const hiddenQuantity = motionSnapshot.unsettledQuantities.get(item.id) ?? 0;
				const displayItem =
					hiddenQuantity === 0
						? item
						: {
								...item,
								quantity: Math.max(1, item.quantity - hiddenQuantity),
							};
				const actor = actorStore.actors.get(item.id);
				if (actor === undefined) {
					const created = RendererRuntime.runSync(
						createPixiTileActorFx({
							frames: application.frames,
							item: displayItem,
							palette: readPalette(),
							textures,
						}),
					);
					yield* actorStore.setActorFx(created);
					pose.layer.addChild(created.container);
					const spawnCue = motionSnapshot.spawnCueByActorId.get(item.id);
					const spawnOrigin =
						spawnCue === undefined
							? null
							: RendererRuntime.runSync(
									surface.readLocationPoseFx(spawnCue.originLocation),
								);
					created.container.x = spawnOrigin?.x ?? pose.x;
					created.container.y = spawnOrigin?.y ?? pose.y;
					created.container.alpha = 0;
					created.container.scale.set(spawnCue === undefined ? 0.82 : 1);
					yield* drag.attachActorFx(created);
					yield* updatePixiTileActorFx({
						actor: created,
						frames: application.frames,
						item: displayItem,
						palette: readPalette(),
						size: pose.size,
						textures,
					});
					if (spawnCue === undefined) {
						yield* animator.animateFx({
							actor: created,
							durationMs: 260,
							toAlpha: 1,
							toScale: 1,
							toX: pose.x,
							toY: pose.y,
						});
					}
					continue;
				}

				const moved = !sameLocation(actor.item.location, item.location);
				const visualChanged = !sameVisual(actor.item, displayItem);
				const sizeChanged = actor.size !== pose.size;
				const runningChanged = actor.item.running !== displayItem.running;
				const previousCrowdAlpha = actor.crowdLayer.alpha;
				if (visualChanged || sizeChanged) {
					yield* updatePixiTileActorFx({
						actor,
						frames: application.frames,
						item: displayItem,
						palette: readPalette(),
						size: pose.size,
						textures,
					});
				} else {
					actor.item = displayItem;
				}
				if (runningChanged) {
					actor.crowdLayer.alpha = previousCrowdAlpha;
					yield* animator.animateFx({
						actor,
						animationKey: `running:${item.id}`,
						durationMs: runningTransitionDurationMs,
						toCrowdAlpha: readRunningAlpha(displayItem.running),
					});
				}
				if (actor.dragging || motionSnapshot.interactionClaimByActorId.has(item.id))
					continue;
				pose.layer.addChild(actor.container);
				if (
					moved ||
					actor.container.x !== pose.x ||
					actor.container.y !== pose.y ||
					sizeChanged
				) {
					yield* animator.animateFx({
						actor,
						durationMs: yield* readPixiTileTravelDurationMsFx({
							fromX: actor.container.x,
							fromY: actor.container.y,
							tileSize: pose.size,
							toX: pose.x,
							toY: pose.y,
						}),
						toX: pose.x,
						toY: pose.y,
					});
				}
			}

			yield* runPixiMainSceneReplacementsFx({
				actorStore,
				animator,
				application,
				processedKeys: processedReplacementKeys,
				readPalette,
				replacements,
				surface,
				textures,
			});
			yield* dropPresentation.reconcileActorIdsFx({
				inventoryActorIds,
				mainActorIds: new Set(nextItems.map((item) => item.id)),
			});
			yield* drag.refreshPreviewFx;
			yield* magneticField.pruneFx;
			yield* motion.syncQuantitiesFx;
			yield* motion.startFx;
		});

		return {
			reconcileFx,
			refreshVisualsFx: Effect.sync(() => {
				for (const actor of actorStore.actors.values()) refreshActor(actor);
			}),
			closeFx: Effect.sync(() => {
				closed = true;
				processedReplacementKeys.clear();
			}),
		} satisfies PixiMainSceneReconciler;
	},
);
