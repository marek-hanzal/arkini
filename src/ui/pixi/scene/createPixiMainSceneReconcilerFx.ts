import { Effect } from "effect";

import type { GameEngine } from "~/bridge/game/GameEngine";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { TileActorFeedbackCue } from "~/bridge/tile/feedback/TileActorFeedbackCue";
import { readTileActorFeedbackCuesFx } from "~/bridge/tile/feedback/readTileActorFeedbackCuesFx";
import { readCommittedTileReplacementsFx } from "~/bridge/tile/motion/readCommittedTileReplacementsFx";
import { readCommittedTileSwapMotionCueFx } from "~/bridge/tile/motion/readCommittedTileSwapMotionCueFx";
import { readTileMotionCuesFx } from "~/bridge/tile/motion/readTileMotionCuesFx";
import { readTileActorsFx } from "~/bridge/tile/readTileActorsFx";
import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import type { PixiTileActorRunningGlowTexture } from "~/ui/pixi/actor/PixiTileActorRunningGlowTexture";
import { createPixiTileActorFx } from "~/ui/pixi/actor/createPixiTileActorFx";
import { updatePixiTileActorFx } from "~/ui/pixi/actor/updatePixiTileActorFx";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { flashPixiTileActorConsumedSourceFx } from "~/ui/pixi/animation/flashPixiTileActorConsumedSourceFx";
import { readPixiActorAlphaAnimationKey } from "~/ui/pixi/animation/readPixiActorAlphaAnimationKey";
import { readPixiTileTravelDurationMsFx } from "~/ui/pixi/animation/readPixiTileTravelDurationMsFx";
import {
	flashPixiTileActorFeedbackGlowFx,
	pixiTileActorFeedbackGlowFallDurationMs,
	pixiTileActorFeedbackGlowRiseDurationMs,
	startPixiTileActorRunningGlowFx,
	stopPixiTileActorRunningGlowFx,
} from "~/ui/pixi/animation/runPixiTileActorRunningGlowFx";
import { startPixiTileActorFadeInFx } from "~/ui/pixi/animation/startPixiTileActorFadeInFx";
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
		readonly runningGlowTexture: PixiTileActorRunningGlowTexture;
		readonly surface: PixiMainSceneSurface;
		readonly textures: PixiTextureStore;
	}
}

const sameLocation = (left: TileActorItem["location"], right: TileActorItem["location"]) =>
	JSON.stringify(left) === JSON.stringify(right);

const readRunningAlpha = (running: boolean) => (running ? 0.82 : 1);
const runningTransitionDurationMs = 180;
const feedbackExitDurationMs = 420;
const feedbackGlowExitDurationMs =
	pixiTileActorFeedbackGlowRiseDurationMs + pixiTileActorFeedbackGlowFallDurationMs;
const defaultExitDurationMs = 220;

const sameVisual = (left: TileActorItem, right: TileActorItem) =>
	left.revision === right.revision &&
	left.title === right.title &&
	left.quantity === right.quantity &&
	left.sourceUrl === right.sourceUrl &&
	left.compositeUrl === right.compositeUrl &&
	left.running === right.running &&
	left.runningGlow === right.runningGlow &&
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
		runningGlowTexture,
		surface,
		textures,
	}: createPixiMainSceneReconcilerFx.Props) {
		const processedReplacementKeys = new Set<string>();
		const processedFeedbackKeys = new Set<string>();
		let closed = false;

		const retainNewestFeedbackKeys = () => {
			while (processedFeedbackKeys.size > 256) {
				const oldest = processedFeedbackKeys.values().next().value;
				if (oldest === undefined) return;
				processedFeedbackKeys.delete(oldest);
			}
		};

		const runActorFeedbackCueFx = Effect.fn("PixiMainSceneReconciler.runActorFeedbackCueFx")(
			function* ({
				actor,
				cue,
			}: {
				readonly actor: NonNullable<ReturnType<typeof actorStore.actors.get>>;
				readonly cue: TileActorFeedbackCue;
			}) {
				if (processedFeedbackKeys.has(cue.key) || actor.container.destroyed) return;
				processedFeedbackKeys.add(cue.key);
				retainNewestFeedbackKeys();
				yield* (
					cue.kind === "consume-source"
						? flashPixiTileActorConsumedSourceFx
						: flashPixiTileActorFeedbackGlowFx
				)({
					actor,
					animator,
				});
			},
		);

		const runFeedbackCuesFx = Effect.fn("PixiMainSceneReconciler.runFeedbackCuesFx")(function* (
			cues: ReadonlyArray<TileActorFeedbackCue>,
		) {
			for (const cue of cues) {
				const actor = actorStore.actors.get(cue.actorId);
				if (actor === undefined) continue;
				yield* runActorFeedbackCueFx({
					actor,
					cue,
				});
			}
		});

		const refreshActor = (actor: NonNullable<ReturnType<typeof actorStore.actors.get>>) => {
			const pose = RendererRuntime.runSync(surface.readActorPoseFx(actor.item));
			if (pose === null) return;
			RendererRuntime.runSync(
				updatePixiTileActorFx({
					actor,
					animator,
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
			yield* actorStore.destroyExitingActorFx(actor);
			yield* application.frames.invalidateFx;
		});

		const releaseActorWithExitFx = Effect.fn("PixiMainSceneReconciler.releaseActorWithExitFx")(
			function* ({
				adoptActiveLifecycleExit = false,
				actorId,
				durationMs,
				feedbackCues,
			}: {
				readonly adoptActiveLifecycleExit?: boolean;
				readonly actorId: string;
				readonly durationMs: number;
				readonly feedbackCues: ReadonlyArray<TileActorFeedbackCue>;
			}) {
				const retainedActor = actorStore.actors.get(actorId);
				const adoptedDurationMs =
					adoptActiveLifecycleExit &&
					retainedActor !== undefined &&
					retainedActor.lifecycleTargetAlpha === 0 &&
					retainedActor.lifecycleFadeStarted
						? Math.max(
								0,
								retainedActor.lifecycleNotBeforeMs +
									retainedActor.lifecycleDurationMs -
									performance.now(),
							)
						: null;
				const actor = yield* releasePixiMainSceneActorFx({
					actorId,
					actorStore,
					animator,
					drag,
				});
				if (actor === null) return;
				for (const cue of feedbackCues) {
					yield* runActorFeedbackCueFx({
						actor,
						cue,
					});
				}
				if (adoptedDurationMs === 0) {
					yield* actorStore.destroyExitingActorFx(actor);
					yield* application.frames.invalidateFx;
					return;
				}
				const exitDurationMs = adoptedDurationMs ?? durationMs;
				yield* animator.animateFx({
					actor,
					channel: "lifecycle-opacity",
					durationMs: exitDurationMs,
					ownerKey: readPixiActorAlphaAnimationKey(actor),
					onComplete: () => {
						RendererRuntime.runSync(animator.cancelActorFx(actor));
						RendererRuntime.runSync(actorStore.destroyExitingActorFx(actor));
					},
					toAlpha: 0,
				});
				yield* animator.animateFx({
					actor,
					channel: "pose",
					durationMs: exitDurationMs,
					toScale: 0.76,
					toX: actor.container.x,
					toY: actor.container.y,
				});
			},
		);

		const reconcileTransitionFx = Effect.fn("PixiMainSceneReconciler.reconcileTransitionFx")(
			function* ({
				presentCommittedEffects,
				transition,
			}: {
				readonly presentCommittedEffects: boolean;
				readonly transition: ReturnType<GameEngine["getTransitionSnapshot"]>;
			}) {
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
				const compiledCues = presentCommittedEffects
					? [
							...RendererRuntime.runSync(readTileMotionCuesFx(transition)),
						]
					: [];
				const replacements = presentCommittedEffects
					? RendererRuntime.runSync(
							readCommittedTileReplacementsFx({
								game,
								transition,
							}),
						)
					: [];
				const feedbackCues = presentCommittedEffects
					? [
							...RendererRuntime.runSync(readTileActorFeedbackCuesFx(transition)),
							...(dropSnapshot.feedback?.cues ?? []),
						]
					: [];
				const replacementActorIds = new Set(replacements.map(({ actorId }) => actorId));
				if (presentCommittedEffects && dropSnapshot.swap !== null) {
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
				if (presentCommittedEffects) {
					yield* motion.enqueueFx(compiledCues);
				}
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
				const visibleActorIds = new Set(visibleItems.keys());
				const leavingFeedbackActorIds = new Set(
					feedbackCues
						.filter(({ actorId }) => !visibleActorIds.has(actorId))
						.map(({ actorId }) => actorId),
				);
				for (const id of actorStore.actors.keys()) {
					if (visibleItems.has(id)) continue;
					if (dropSnapshot.pendingActorIds.has(id)) continue;
					if (dropSnapshot.hiddenActorIds.has(id)) {
						yield* releaseActorWithExitFx({
							adoptActiveLifecycleExit: true,
							actorId: id,
							durationMs: feedbackExitDurationMs,
							feedbackCues: [],
						});
						continue;
					}
					if (inventoryActorIds.has(id)) {
						yield* removeActorImmediatelyFx(id);
						continue;
					}
					if (motionSnapshot.interactionClaimByActorId.has(id)) continue;
					const exitFeedbackCues = feedbackCues.filter(
						({ actorId, kind }) => actorId === id && kind !== "consume-source",
					);
					yield* releaseActorWithExitFx({
						actorId: id,
						durationMs:
							exitFeedbackCues.length > 0
								? feedbackGlowExitDurationMs
								: leavingFeedbackActorIds.has(id)
									? feedbackExitDurationMs
									: defaultExitDurationMs,
						feedbackCues: exitFeedbackCues,
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
								runningGlowTexture: runningGlowTexture.texture,
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
						yield* animator.setFx({
							actor: created,
							channel: "pose",
							scale: presentCommittedEffects && spawnCue === undefined ? 0.82 : 1,
							x: spawnOrigin?.x ?? pose.x,
							y: spawnOrigin?.y ?? pose.y,
						});
						yield* animator.setFx({
							actor: created,
							alpha: presentCommittedEffects ? 0 : 1,
							channel: "lifecycle-opacity",
						});
						yield* drag.attachActorFx(created);
						yield* updatePixiTileActorFx({
							actor: created,
							animator,
							frames: application.frames,
							item: displayItem,
							palette: readPalette(),
							size: pose.size,
							textures,
						});
						if (displayItem.runningGlow) {
							yield* startPixiTileActorRunningGlowFx({
								actor: created,
								animator,
							});
						}
						if (presentCommittedEffects && spawnCue === undefined) {
							yield* startPixiTileActorFadeInFx({
								actor: created,
								animator,
							});
							yield* animator.animateFx({
								actor: created,
								channel: "pose",
								durationMs: 260,
								toScale: 1,
								toX: pose.x,
								toY: pose.y,
							});
						}
						continue;
					}

					const moved = !sameLocation(actor.item.location, item.location);
					const visualChanged = !sameVisual(actor.currentVisual.item, displayItem);
					const sizeChanged = actor.size !== pose.size;
					const poseOwned =
						actor.dragging || motionSnapshot.interactionClaimByActorId.has(item.id);
					const runningChanged = actor.item.running !== displayItem.running;
					const runningGlowChanged = actor.item.runningGlow !== displayItem.runningGlow;
					const previousDisplayedSize = actor.size * actor.container.scale.x;
					if (visualChanged || sizeChanged) {
						yield* updatePixiTileActorFx({
							actor,
							animator,
							frames: application.frames,
							item: displayItem,
							palette: readPalette(),
							preserveVisual: replacementActorIds.has(item.id),
							size: poseOwned ? actor.size : pose.size,
							textures,
						});
					} else {
						actor.item = displayItem;
					}
					if (runningChanged) {
						yield* animator.animateFx({
							actor,
							channel: "crowd-opacity",
							durationMs: runningTransitionDurationMs,
							ownerKey: `running:${item.id}`,
							toCrowdAlpha: readRunningAlpha(displayItem.running),
						});
					}
					if (runningGlowChanged) {
						yield* (
							displayItem.runningGlow
								? startPixiTileActorRunningGlowFx
								: stopPixiTileActorRunningGlowFx
						)({
							actor,
							animator,
						});
					}
					if (poseOwned) continue;
					if (sizeChanged) {
						yield* animator.setFx({
							actor,
							channel: "pose",
							scale: previousDisplayedSize / Math.max(1, actor.size),
							x: actor.container.x,
							y: actor.container.y,
						});
					}
					pose.layer.addChild(actor.container);
					if (
						moved ||
						actor.container.x !== pose.x ||
						actor.container.y !== pose.y ||
						sizeChanged
					) {
						yield* animator.animateFx({
							actor,
							channel: "pose",
							durationMs: yield* readPixiTileTravelDurationMsFx({
								fromX: actor.container.x,
								fromY: actor.container.y,
								tileSize: pose.size,
								toX: pose.x,
								toY: pose.y,
							}),
							toScale: 1,
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
				yield* runFeedbackCuesFx(feedbackCues);
				if (dropSnapshot.feedback !== null) {
					yield* dropPresentation.clearFeedbackFx(dropSnapshot.feedback.generation);
				}
				yield* dropPresentation.reconcileActorIdsFx({
					inventoryActorIds,
					mainActorIds: new Set(nextItems.map((item) => item.id)),
				});
				yield* drag.refreshPreviewFx;
				yield* magneticField.pruneFx;
				yield* motion.syncQuantitiesFx;
				yield* motion.startFx;
			},
		);

		return {
			hydrateFx: (transition) =>
				reconcileTransitionFx({
					presentCommittedEffects: false,
					transition,
				}),
			reconcileFx: (transition) =>
				reconcileTransitionFx({
					presentCommittedEffects: true,
					transition,
				}),
			refreshVisualsFx: Effect.sync(() => {
				for (const actor of actorStore.actors.values()) refreshActor(actor);
			}),
			closeFx: Effect.sync(() => {
				closed = true;
				processedFeedbackKeys.clear();
				processedReplacementKeys.clear();
			}),
		} satisfies PixiMainSceneReconciler;
	},
);
