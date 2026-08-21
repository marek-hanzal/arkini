import { Effect } from "effect";

import type { GameEngine } from "~/bridge/game/GameEngine";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { TileActorFeedbackCue } from "~/bridge/tile/feedback/TileActorFeedbackCue";
import { readTileActorFeedbackCuesFx } from "~/bridge/tile/feedback/readTileActorFeedbackCuesFx";
import { readCommittedTileReplacementsFx } from "~/bridge/tile/motion/readCommittedTileReplacementsFx";
import { readCommittedTileSwapMotionCueFx } from "~/bridge/tile/motion/readCommittedTileSwapMotionCueFx";
import { readTileMotionCuesFx } from "~/bridge/tile/motion/readTileMotionCuesFx";
import { readTileActorsFx } from "~/bridge/tile/readTileActorsFx";
import { readTileDeliveriesFx } from "~/bridge/tile/readTileDeliveriesFx";
import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import type { PixiTileActorParticleTextures } from "~/ui/pixi/actor/PixiTileActorParticleTextures";
import { createPixiTileActorFx } from "~/ui/pixi/actor/createPixiTileActorFx";
import {
	updatePixiTileActorFx,
	updatePixiTileActorProgressFx,
} from "~/ui/pixi/actor/updatePixiTileActorFx";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { animatePixiActorToRetargetablePoseFx } from "~/ui/pixi/animation/animatePixiActorToRetargetablePoseFx";
import { flashPixiTileActorConsumedSourceFx } from "~/ui/pixi/animation/flashPixiTileActorConsumedSourceFx";
import {
	burstPixiTileActorFeedbackParticlesFx,
	pixiTileActorFeedbackParticlesDurationMs,
	startPixiTileActorActivityParticlesFx,
	stopPixiTileActorActivityParticlesFx,
} from "~/ui/pixi/animation/runPixiTileActorActivityParticlesFx";
import {
	pixiTileActorLifecycleDurationMs,
	preparePixiTileActorEnterFx,
	startPixiTileActorEnterFx,
	startPixiTileActorExitFx,
} from "~/ui/pixi/animation/runPixiTileActorLifecycleFx";
import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";
import type { PixiMainSceneDragController } from "~/ui/pixi/drag/PixiMainSceneDragController";
import type { PixiDeliveryMotionRuntime } from "~/ui/pixi/delivery/PixiDeliveryMotionRuntime";
import { readPixiDragSettleDurationMsFx } from "~/ui/pixi/drag/readPixiDragSettleDurationMsFx";
import type { PixiMainSceneDropPresentation } from "~/ui/pixi/drop/PixiMainSceneDropPresentation";
import type { PixiTileMagneticField } from "~/ui/pixi/magnet/PixiTileMagneticField";
import type { PixiTileMotionRuntime } from "~/ui/pixi/motion/PixiTileMotionRuntime";
import { projectPixiTileMotionItemFx } from "~/ui/pixi/motion/projectPixiTileMotionItem";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import type { PixiTextureStore } from "~/ui/pixi/runtime/createPixiTextureStoreFx";
import type { PixiMainSceneReconciler } from "~/ui/pixi/scene/PixiMainSceneReconciler";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";
import { classifyPixiMainSceneActorUpdateFx } from "~/ui/pixi/scene/classifyPixiMainSceneActorUpdateFx";
import { classifyPixiMainSceneReconciliationFx } from "~/ui/pixi/scene/classifyPixiMainSceneReconciliationFx";
import { releasePixiMainSceneActorFx } from "~/ui/pixi/scene/releasePixiMainSceneActorFx";
import { runPixiMainSceneReplacementsFx } from "~/ui/pixi/scene/runPixiMainSceneReplacementsFx";

export namespace createPixiMainSceneReconcilerFx {
	export interface Props {
		readonly actorStore: PixiMainSceneActorStore;
		readonly animator: PixiActorAnimator;
		readonly application: PixiApplicationOwner;
		readonly drag: PixiMainSceneDragController;
		readonly delivery: PixiDeliveryMotionRuntime;
		readonly dropPresentation: PixiMainSceneDropPresentation;
		readonly game: GameEngine;
		readonly magneticField: PixiTileMagneticField;
		readonly motion: PixiTileMotionRuntime;
		readonly particleTextures: PixiTileActorParticleTextures;
		readonly readPalette: () => PixiScenePalette;
		readonly surface: PixiMainSceneSurface;
		readonly textures: PixiTextureStore;
	}
}

const runningTransitionDurationMs = 180;
const feedbackExitDurationMs = 420;

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
		delivery,
		dropPresentation,
		game,
		magneticField,
		motion,
		particleTextures,
		readPalette,
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
						: burstPixiTileActorFeedbackParticlesFx
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
					retainedActor.lifecycleTransitionStarted
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
				yield* startPixiTileActorExitFx({
					actor,
					animator,
					durationMs: exitDurationMs,
					onComplete: () => {
						RendererRuntime.runSync(animator.cancelActorFx(actor));
						RendererRuntime.runSync(actorStore.destroyExitingActorFx(actor));
					},
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
				yield* delivery.syncFx(
					game.readOrThrow(
						readTileDeliveriesFx({
							game,
							runtime: transition.runtime,
						}),
					),
				);
				const deliverySnapshot = yield* delivery.readSnapshotFx;
				const compiledCues = presentCommittedEffects
					? [
							...RendererRuntime.runSync(
								readTileMotionCuesFx({
									game,
									transition,
								}),
							),
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
				const inputMotionCues = compiledCues.filter((cue) => cue.kind === "input");
				const inputMotionFeedbackPrefixes = new Set(
					inputMotionCues.map((cue) => `${cue.sequence}:${cue.eventIndex}:`),
				);
				const inputMotionActorIds = new Set(
					inputMotionCues.flatMap((cue) => [
						cue.sourceActorId,
						cue.targetActorId,
					]),
				);
				const belongsToInputMotion = (cue: TileActorFeedbackCue) => {
					for (const prefix of inputMotionFeedbackPrefixes) {
						if (cue.key.startsWith(prefix)) return true;
					}
					return false;
				};
				const feedbackCues = presentCommittedEffects
					? [
							...RendererRuntime.runSync(
								readTileActorFeedbackCuesFx(transition),
							).filter((cue) => !belongsToInputMotion(cue)),
							...dropSnapshot.feedback.flatMap(({ cues }) =>
								cues.filter((cue) => !inputMotionActorIds.has(cue.actorId)),
							),
						]
					: [];
				const replacementActorIds = new Set(replacements.map(({ actorId }) => actorId));
				if (presentCommittedEffects) {
					for (const swap of dropSnapshot.swaps) {
						const swapCue = RendererRuntime.runSync(
							readCommittedTileSwapMotionCueFx({
								...swap.candidate,
								transition,
							}),
						);
						if (swapCue !== null) {
							compiledCues.push(swapCue);
							yield* dropPresentation.clearSwapFx(swap.generation);
						}
					}
				}
				if (presentCommittedEffects) {
					yield* motion.enqueueFx(compiledCues);
				}
				const motionSnapshot = yield* motion.readSnapshotFx;
				const visibleItems = new Map(
					nextItems.flatMap((item) => {
						if (dropSnapshot.hiddenActorIds.has(item.id)) return [];
						const pose = RendererRuntime.runSync(surface.readActorPoseFx(item));
						return pose === null
							? []
							: [
									[
										item.id,
										{
											item,
											pose,
										},
									] as const,
								];
					}),
				);
				const reconciliationPlan = yield* classifyPixiMainSceneReconciliationFx({
					actorIds: actorStore.actors.keys(),
					deliveryRetainedActorIds: deliverySnapshot.retainedActorIds,
					feedbackCues,
					hiddenActorIds: dropSnapshot.hiddenActorIds,
					inventoryActorIds,
					motionRetainedActorIds: motionSnapshot.retainedActorIds,
					pendingActorIds: dropSnapshot.pendingActorIds,
					visibleActors: visibleItems,
				});
				for (const departure of reconciliationPlan.departures) {
					if (departure.kind === "release-hidden") {
						yield* releaseActorWithExitFx({
							adoptActiveLifecycleExit: true,
							actorId: departure.actorId,
							durationMs: feedbackExitDurationMs,
							feedbackCues: [],
						});
						continue;
					}
					if (departure.kind === "remove-immediately") {
						yield* removeActorImmediatelyFx(departure.actorId);
						continue;
					}
					yield* releaseActorWithExitFx({
						actorId: departure.actorId,
						durationMs:
							departure.style === "feedback-particles"
								? pixiTileActorFeedbackParticlesDurationMs
								: departure.style === "feedback"
									? feedbackExitDurationMs
									: pixiTileActorLifecycleDurationMs,
						feedbackCues: departure.feedbackCues,
					});
				}

				for (const arrival of reconciliationPlan.arrivals) {
					const {
						visible: { item, pose },
					} = arrival;
					const displayItem = yield* projectPixiTileMotionItemFx(
						item,
						motionSnapshot.quantityPresentationByActorId.get(item.id),
					);
					if (arrival.kind === "add") {
						const created = RendererRuntime.runSync(
							createPixiTileActorFx({
								frames: application.frames,
								item: displayItem,
								palette: readPalette(),
								particleTextures,
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
							scale: 1,
							x: spawnOrigin?.x ?? pose.x,
							y: spawnOrigin?.y ?? pose.y,
						});
						if (presentCommittedEffects) {
							yield* preparePixiTileActorEnterFx({
								actor: created,
								animator,
							});
						}
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
						if (displayItem.activityEffect) {
							yield* startPixiTileActorActivityParticlesFx({
								actor: created,
								animator,
							});
						}
						if (presentCommittedEffects && spawnCue === undefined) {
							yield* startPixiTileActorEnterFx({
								actor: created,
								animator,
							});
						}
						continue;
					}

					const actor = actorStore.actors.get(item.id);
					if (actor === undefined) continue;
					const updatePlan = yield* classifyPixiMainSceneActorUpdateFx({
						actor,
						deliveryRetained: deliverySnapshot.retainedActorIds.has(item.id),
						directLanding: dropSnapshot.landingActorIds.has(item.id),
						displayItem,
						motionClaimed: motionSnapshot.interactionClaimByActorId.has(item.id),
						pose,
						poseChannelActive:
							presentCommittedEffects &&
							(yield* animator.isChannelActiveFx(actor, "pose")),
						preserveVisual: replacementActorIds.has(item.id),
					});
					if (updatePlan.item.kind === "visual") {
						yield* updatePixiTileActorFx({
							actor,
							animator,
							frames: application.frames,
							item: displayItem,
							palette: readPalette(),
							preserveVisual: updatePlan.item.preserveVisual,
							size: updatePlan.item.size,
							textures,
						});
					} else if (updatePlan.item.kind === "progress") {
						yield* updatePixiTileActorProgressFx({
							actor,
							frames: application.frames,
							item: displayItem,
							palette: readPalette(),
							size: actor.size,
						});
					} else {
						actor.item = displayItem;
					}
					if (updatePlan.crowdAlpha !== null) {
						yield* animator.animateFx({
							actor,
							channel: "crowd-opacity",
							durationMs: runningTransitionDurationMs,
							ownerKey: `running:${item.id}`,
							toCrowdAlpha: updatePlan.crowdAlpha,
						});
					}
					if (updatePlan.activityEffect !== null) {
						yield* (
							updatePlan.activityEffect === "start"
								? startPixiTileActorActivityParticlesFx
								: stopPixiTileActorActivityParticlesFx
						)({
							actor,
							animator,
						});
					}
					if (updatePlan.pose.kind === "owned") continue;
					if (
						updatePlan.pose.kind === "travel" &&
						updatePlan.pose.scaleBeforeTravel !== null
					) {
						yield* animator.setFx({
							actor,
							channel: "pose",
							scale: updatePlan.pose.scaleBeforeTravel,
							x: actor.container.x,
							y: actor.container.y,
						});
					}
					if (updatePlan.pose.kind === "travel") {
						surface.transientActorLayer.addChild(actor.container);
						const finishTravel = () => {
							if (actor.container.destroyed) return;
							const latest =
								RendererRuntime.runSync(surface.readActorPoseFx(actor.item)) ??
								pose;
							latest.layer.addChild(actor.container);
						};
						yield* animatePixiActorToRetargetablePoseFx({
							actor,
							animator,
							curve: updatePlan.pose.directLanding
								? {
										bounce: 0.14,
										kind: "spring",
									}
								: undefined,
							durationMs: updatePlan.pose.directLanding
								? yield* readPixiDragSettleDurationMsFx({
										fromX: actor.container.x,
										fromY: actor.container.y,
										tileSize: pose.size,
										toX: pose.x,
										toY: pose.y,
									})
								: undefined,
							onComplete: finishTravel,
							readSize: () =>
								RendererRuntime.runSync(surface.readActorPoseFx(actor.item))
									?.size ?? pose.size,
							readTarget: () =>
								RendererRuntime.runSync(surface.readActorPoseFx(actor.item)),
							target: pose,
						});
					} else {
						pose.layer.addChild(actor.container);
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
				for (const feedback of dropSnapshot.feedback) {
					yield* dropPresentation.clearFeedbackFx(feedback.generation);
				}
				yield* dropPresentation.reconcileActorIdsFx({
					inventoryActorIds,
					mainActorIds: new Set(nextItems.map((item) => item.id)),
				});
				yield* magneticField.pruneFx;
				yield* motion.syncPresentationFx;
				yield* motion.startFx;
				yield* drag.requestRefreshFx;
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
