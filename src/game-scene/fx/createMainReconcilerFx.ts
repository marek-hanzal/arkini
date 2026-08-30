import { Effect } from "effect";

import type { GameEngine } from "~/renderer/game/GameEngine";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { TileActorFeedbackCue } from "~/tile-presentation/type/TileActorFeedbackCue";
import { readTileActorFeedbackCuesFn } from "~/tile-presentation/fn/readTileActorFeedbackCuesFn";
import { readCommittedTileReplacementsFx } from "~/tile-presentation/fx/readCommittedTileReplacementsFx";
import { readCommittedTileSwapMotionCueFn } from "~/tile-presentation/fn/readCommittedTileSwapMotionCueFn";
import { readTileMotionCuesFx } from "~/tile-presentation/fx/readTileMotionCuesFx";
import { readTileActorsFx } from "~/tile-presentation/fx/readTileActorsFx";
import { readTileDeliveriesFx } from "~/game-scene/fx/readTileDeliveriesFx";
import type { MainActorStore } from "~/tile-rendering/service/MainActorStore";
import type { ParticleTextures } from "~/tile-rendering/service/ParticleTextures";
import { createTileActorFx } from "~/tile-rendering/fx/createTileActorFx";
import { updateTileActorFx } from "~/tile-rendering/fx/updateTileActorFx";
import { updateActorProgressFx } from "~/tile-rendering/fx/updateActorProgressFx";
import type { ActorAnimator } from "~/tile-rendering/service/ActorAnimator";
import { animateRetargetablePoseFx } from "~/tile-rendering/fx/animateRetargetablePoseFx";
import { flashConsumedSourceFx } from "~/tile-rendering/fx/flashConsumedSourceFx";
import { feedbackDurationMs } from "~/tile-rendering/fx/runActivityParticlesFx";
import { burstFeedbackParticlesFx } from "~/tile-rendering/fx/burstFeedbackParticlesFx";
import { startActivityParticlesFx } from "~/tile-rendering/fx/startActivityParticlesFx";
import { stopActivityParticlesFx } from "~/tile-rendering/fx/stopActivityParticlesFx";
import { lifecycleDurationMs, runActorLifecycleFx } from "~/tile-rendering/fx/runActorLifecycleFx";
import { startActorEnterFx } from "~/tile-rendering/fx/startActorEnterFx";
import { startActorExitFx } from "~/tile-rendering/fx/startActorExitFx";
import type { PixiScenePalette } from "~/tile-rendering/type/PixiScenePalette";
import type { MainDragController } from "~/tile-interaction/fx/createMainDragControllerFx";
import type { DeliveryRuntime } from "~/game-scene/service/DeliveryRuntime";
import { readSettleDurationMsFn } from "~/tile-motion/fn/readSettleDurationMsFn";
import type { DropPresentation } from "~/tile-interaction/fx/createDropPresentationFx";
import type { MagneticField } from "~/tile-motion/service/MagneticField";
import type { MotionRuntime } from "~/tile-motion/service/MotionRuntime";
import { projectMotionItemFn } from "~/tile-motion/fn/projectMotionItemFn";
import type { PixiApplicationOwner } from "~/tile-rendering/service/PixiApplicationOwner";
import type { TextureStore } from "~/tile-rendering/fx/createTextureStoreFx";
import type { MainSurface } from "~/game-scene/service/MainSurface";
import { classifyActorUpdateFn } from "~/game-scene/fn/classifyActorUpdateFn";
import { classifyReconciliationFn } from "~/game-scene/fn/classifyReconciliationFn";
import { runReplacementsFx } from "~/game-scene/fx/runReplacementsFx";

interface CreateMainReconcilerProps {
	readonly actorStore: MainActorStore;
	readonly animator: ActorAnimator;
	readonly application: PixiApplicationOwner;
	readonly drag: MainDragController;
	readonly delivery: DeliveryRuntime;
	readonly dropPresentation: DropPresentation;
	readonly game: GameEngine;
	readonly magneticField: MagneticField;
	readonly motion: MotionRuntime;
	readonly particleTextures: ParticleTextures;
	readonly readPalette: () => PixiScenePalette;
	readonly surface: MainSurface;
	readonly textures: TextureStore;
}

interface MainReconciler {
	readonly hydrateFx: (
		transition: ReturnType<GameEngine["getTransitionSnapshot"]>,
	) => Effect.Effect<void>;
	readonly reconcileFx: (
		transition: ReturnType<GameEngine["getTransitionSnapshot"]>,
	) => Effect.Effect<void>;
	readonly refreshVisualsFx: Effect.Effect<void>;
	readonly closeFx: Effect.Effect<void>;
}

const runningTransitionDurationMs = 180;
const feedbackExitDurationMs = 420;

const releaseMainActorFx = Effect.fn("createMainReconcilerFx.releaseActorFx")(function* ({
	actorId,
	actorStore,
	animator,
	drag,
}: {
	readonly actorId: string;
	readonly actorStore: MainActorStore;
	readonly animator: ActorAnimator;
	readonly drag: MainDragController;
}) {
	const actor = actorStore.actors.get(actorId);
	if (actor === undefined) return null;
	yield* drag.detachActorFx(actor);
	yield* actorStore.releaseActorFx(actorId);
	yield* animator.cancelActorFx(actor);
	actor.visualTransitionGeneration += 1;
	return actor;
});

/**
 * Reconciles one canonical transition into retained actors while motion owns presentation lag.
 *
 * Motion/drop claims may temporarily retain, hide, or offset actors, but this owner never infers a
 * gameplay result. It derives actors and cues from canonical game reads and eventually converges every
 * unclaimed display object to the committed snapshot.
 */
export const createMainReconcilerFx = Effect.fn("createMainReconcilerFx")(function* ({
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
}: CreateMainReconcilerProps) {
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

	const runActorFeedbackCueFx = Effect.fn("MainReconciler.runActorFeedbackCueFx")(function* ({
		actor,
		cue,
	}: {
		readonly actor: NonNullable<ReturnType<typeof actorStore.actors.get>>;
		readonly cue: TileActorFeedbackCue;
	}) {
		if (processedFeedbackKeys.has(cue.key) || actor.container.destroyed) return;
		processedFeedbackKeys.add(cue.key);
		retainNewestFeedbackKeys();
		yield* (cue.kind === "consume-source" ? flashConsumedSourceFx : burstFeedbackParticlesFx)({
			actor,
			animator,
		});
	});

	const runFeedbackCuesFx = Effect.fn("MainReconciler.runFeedbackCuesFx")(function* (
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
			updateTileActorFx({
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

	const removeActorImmediatelyFx = Effect.fn("MainReconciler.removeActorImmediatelyFx")(
		function* (actorId: string) {
			const actor = yield* releaseMainActorFx({
				actorId,
				actorStore,
				animator,
				drag,
			});
			if (actor === null) return;
			yield* actorStore.destroyExitingActorFx(actor);
			yield* application.frames.invalidateFx;
		},
	);

	const releaseActorWithExitFx = Effect.fn("MainReconciler.releaseActorWithExitFx")(function* ({
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
		const actor = yield* releaseMainActorFx({
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
		yield* startActorExitFx({
			actor,
			animator,
			durationMs: exitDurationMs,
			onComplete: () => {
				RendererRuntime.runSync(animator.cancelActorFx(actor));
				RendererRuntime.runSync(actorStore.destroyExitingActorFx(actor));
			},
		});
	});

	const reconcileTransitionFx = Effect.fn("MainReconciler.reconcileTransitionFx")(function* ({
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
					...readTileActorFeedbackCuesFn(transition).filter(
						(cue) => !belongsToInputMotion(cue),
					),
					...dropSnapshot.feedback.flatMap(({ cues }) =>
						cues.filter((cue) => !inputMotionActorIds.has(cue.actorId)),
					),
				]
			: [];
		const replacementActorIds = new Set(replacements.map(({ actorId }) => actorId));
		if (presentCommittedEffects) {
			for (const swap of dropSnapshot.swaps) {
				const swapCue = readCommittedTileSwapMotionCueFn({
					...swap.candidate,
					transition,
				});
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
		const reconciliationPlan = classifyReconciliationFn({
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
						? feedbackDurationMs
						: departure.style === "feedback"
							? feedbackExitDurationMs
							: lifecycleDurationMs,
				feedbackCues: departure.feedbackCues,
			});
		}

		for (const arrival of reconciliationPlan.arrivals) {
			const {
				visible: { item, pose },
			} = arrival;
			const displayItem = projectMotionItemFn(
				item,
				motionSnapshot.quantityPresentationByActorId.get(item.id),
			);
			if (arrival.kind === "add") {
				const created = RendererRuntime.runSync(
					createTileActorFx({
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
					yield* runActorLifecycleFx({
						actor: created,
						animator,
						kind: "prepare-enter",
					});
				}
				yield* drag.attachActorFx(created);
				yield* updateTileActorFx({
					actor: created,
					animator,
					frames: application.frames,
					item: displayItem,
					palette: readPalette(),
					size: pose.size,
					textures,
				});
				if (displayItem.activityEffect) {
					yield* startActivityParticlesFx({
						actor: created,
						animator,
					});
				}
				if (presentCommittedEffects && spawnCue === undefined) {
					yield* startActorEnterFx({
						actor: created,
						animator,
					});
				}
				continue;
			}

			const actor = actorStore.actors.get(item.id);
			if (actor === undefined) continue;
			const updatePlan = classifyActorUpdateFn({
				actor,
				deliveryRetained: deliverySnapshot.retainedActorIds.has(item.id),
				directLanding: dropSnapshot.landingActorIds.has(item.id),
				displayItem,
				motionClaimed: motionSnapshot.interactionClaimByActorId.has(item.id),
				pose,
				poseChannelActive:
					presentCommittedEffects && (yield* animator.isChannelActiveFx(actor, "pose")),
				preserveVisual: replacementActorIds.has(item.id),
			});
			if (updatePlan.item.kind === "visual") {
				yield* updateTileActorFx({
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
				yield* updateActorProgressFx({
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
						? startActivityParticlesFx
						: stopActivityParticlesFx
				)({
					actor,
					animator,
				});
			}
			if (updatePlan.pose.kind === "owned") continue;
			if (updatePlan.pose.kind === "travel" && updatePlan.pose.scaleBeforeTravel !== null) {
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
						RendererRuntime.runSync(surface.readActorPoseFx(actor.item)) ?? pose;
					latest.layer.addChild(actor.container);
				};
				yield* animateRetargetablePoseFx({
					actor,
					animator,
					curve: updatePlan.pose.directLanding
						? {
								bounce: 0.14,
								kind: "spring",
							}
						: undefined,
					durationMs: updatePlan.pose.directLanding
						? readSettleDurationMsFn({
								fromX: actor.container.x,
								fromY: actor.container.y,
								tileSize: pose.size,
								toX: pose.x,
								toY: pose.y,
							})
						: undefined,
					onComplete: finishTravel,
					readSize: () =>
						RendererRuntime.runSync(surface.readActorPoseFx(actor.item))?.size ??
						pose.size,
					readTarget: () => RendererRuntime.runSync(surface.readActorPoseFx(actor.item)),
					target: pose,
				});
			} else {
				pose.layer.addChild(actor.container);
			}
		}

		yield* runReplacementsFx({
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
	});

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
	} satisfies MainReconciler;
});
