import { Effect } from "effect";

import type { GameEngine } from "~/bridge/game/GameEngine";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { DropItemResultKindEnumSchema } from "~/bridge/tile/DropItemResultKindEnumSchema";
import type { runTileDropAtom } from "~/bridge/tile/runTileDropAtom";
import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import { readPixiTileActorCursorFx } from "~/ui/pixi/actor/readPixiTileActorCursorFx";
import { animatePixiActorToRetargetablePoseFx } from "~/ui/pixi/animation/animatePixiActorToRetargetablePoseFx";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import {
	restorePixiTileActorRemovalFeedbackFx,
	startPixiTileActorRemovalFeedbackFx,
} from "~/ui/pixi/animation/startPixiTileActorRemovalFeedbackFx";
import { burstPixiTileActorFeedbackParticlesFx } from "~/ui/pixi/animation/runPixiTileActorActivityParticlesFx";
import { settlePixiMainSceneDraggedActorFx } from "~/ui/pixi/drag/settlePixiMainSceneDraggedActorFx";
import type { PixiCursorGrabMotion } from "~/ui/pixi/drag/PixiCursorGrabMotion";
import { beginPixiMainSceneDropFx } from "~/ui/pixi/drop/beginPixiMainSceneDropFx";
import type { PixiMainSceneDropPresentation } from "~/ui/pixi/drop/PixiMainSceneDropPresentation";
import type { PixiMainSceneDropSubmission } from "~/ui/pixi/drop/PixiMainSceneDropSubmission";
import type { PixiTileMagneticField } from "~/ui/pixi/magnet/PixiTileMagneticField";
import type { PixiTileMotionRuntime } from "~/ui/pixi/motion/PixiTileMotionRuntime";
import { readPixiTileMotionTargetRedirect } from "~/ui/pixi/motion/readPixiTileMotionTargetRedirect";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";

export namespace createPixiMainSceneDropSubmissionFx {
	export interface Props {
		readonly actorStore: PixiMainSceneActorStore;
		readonly animator: PixiActorAnimator;
		readonly cursorGrab: PixiCursorGrabMotion;
		readonly dropPresentation: PixiMainSceneDropPresentation;
		readonly game: GameEngine;
		readonly magneticField: PixiTileMagneticField;
		readonly motion: PixiTileMotionRuntime;
		readonly onAcceptedDrop: () => void;
		readonly onDrop: (command: runTileDropAtom.Command) => PromiseLike<runTileDropAtom.Result>;
		readonly surface: PixiMainSceneSurface;
	}
}

const inventoryShortcutTravelOwnerPrefix = "inventory-shortcut-travel";

/**
 * Owns each independent drop from frozen release facts through command settlement.
 *
 * Presentation generations keep late or concurrent Promises isolated. Actor identity plus its
 * lifecycle generation make optimistic removal rollback safe when reconciliation replaces or
 * supersedes the released actor. This owner never caches gameplay state.
 */
export const createPixiMainSceneDropSubmissionFx = Effect.fn("createPixiMainSceneDropSubmissionFx")(
	function* ({
		actorStore,
		animator,
		cursorGrab,
		dropPresentation,
		game,
		magneticField,
		motion,
		onAcceptedDrop,
		onDrop,
		surface,
	}: createPixiMainSceneDropSubmissionFx.Props) {
		let closed = false;

		const settleActor = (actor: PixiTileActor) => {
			RendererRuntime.runSync(
				settlePixiMainSceneDraggedActorFx({
					actor,
					animator,
					surface,
				}),
			);
		};

		const restoreOptimisticRemoval = ({
			actor,
			lifecycleGeneration,
			sourceActorId,
		}: {
			readonly actor: PixiTileActor;
			readonly lifecycleGeneration: number;
			readonly sourceActorId: string;
		}) => {
			if (
				closed ||
				actor.container.destroyed ||
				actorStore.actors.get(sourceActorId) !== actor ||
				actor.lifecycleIntentGeneration !== lifecycleGeneration
			) {
				return;
			}
			RendererRuntime.runSync(
				restorePixiTileActorRemovalFeedbackFx({
					actor,
					animator,
				}),
			);
		};

		return {
			isPendingActorFx: Effect.fn("PixiMainSceneDropSubmission.isPendingActorFx")((actorId) =>
				Effect.map(dropPresentation.readSnapshotFx, ({ pendingActorIds }) =>
					pendingActorIds.has(actorId),
				),
			),
			submitFx: Effect.fn("PixiMainSceneDropSubmission.submitFx")(
				({ actor, commandTarget, previewKind, shortcutReceiver, sourceItem, targetItem }) =>
					Effect.sync(() => {
						if (closed) return;
						RendererRuntime.runSync(cursorGrab.finishFx(actor));
						RendererRuntime.runSync(magneticField.resetFx);
						RendererRuntime.runSync(surface.renderDropFeedbackFx(null, null));
						actor.container.cursor = RendererRuntime.runSync(
							readPixiTileActorCursorFx({
								phase: "pending",
								previewKind,
								running: sourceItem.running,
							}),
						);
						const drop = RendererRuntime.runSync(
							beginPixiMainSceneDropFx({
								commandTarget,
								dropPresentation,
								previewKind,
								sourceItem,
								targetItem,
							}),
						);
						const optimisticRemoval =
							previewKind === DropItemResultKindEnumSchema.enum.StoreInventory ||
							(previewKind === DropItemResultKindEnumSchema.enum.Stack &&
								sourceItem.quantity === 1)
								? {
										actor,
										lifecycleGeneration: actor.lifecycleIntentGeneration + 1,
										sourceActorId: sourceItem.id,
									}
								: null;
						const optimisticInventoryReceiver =
							previewKind === DropItemResultKindEnumSchema.enum.StoreInventory &&
							targetItem !== null
								? (actorStore.actors.get(targetItem.id) ?? null)
								: null;
						let removalStarted = false;
						let shortcutVisualComplete = shortcutReceiver === undefined;
						let queuedResult: runTileDropAtom.Result | null = null;
						let finalized = false;
						let targetRedirected = false;

						const startRemoval = () => {
							if (optimisticRemoval === null || removalStarted) return;
							removalStarted = true;
							RendererRuntime.runSync(
								startPixiTileActorRemovalFeedbackFx({
									actor: optimisticRemoval.actor,
									animator,
									onCancel: () => {
										shortcutVisualComplete = true;
										if (queuedResult !== null) finalizeResult(queuedResult);
									},
									onComplete: () => {
										shortcutVisualComplete = true;
										if (queuedResult !== null) finalizeResult(queuedResult);
									},
								}),
							);
						};

						const flashInventoryReceiver = () => {
							if (optimisticInventoryReceiver === null) return;
							RendererRuntime.runSync(
								burstPixiTileActorFeedbackParticlesFx({
									actor: optimisticInventoryReceiver,
									animator,
								}),
							);
						};

						const finalizeResult = (result: runTileDropAtom.Result) => {
							if (finalized || closed) return;
							try {
								if (!targetRedirected) {
									const targetRedirect = readPixiTileMotionTargetRedirect(result);
									if (targetRedirect !== null) {
										RendererRuntime.runSync(
											motion.redirectTargetFx(targetRedirect),
										);
										targetRedirected = true;
									}
								}
							} catch (cause) {
								game.reportCriticalFailure("game-presentation", cause);
								return;
							}
							if (
								shortcutReceiver !== undefined &&
								result.kind === DropItemResultKindEnumSchema.enum.StoreInventory &&
								!shortcutVisualComplete
							) {
								queuedResult = result;
								return;
							}
							finalized = true;
							try {
								RendererRuntime.runSync(
									dropPresentation.completeFx({
										generation: drop.generation,
										result,
									}),
								);
								if (
									result.kind ===
										DropItemResultKindEnumSchema.enum.StoreInventory &&
									optimisticInventoryReceiver !== null &&
									result.inventory.itemId ===
										optimisticInventoryReceiver.item.id &&
									actorStore.actors.get(result.inventory.itemId) ===
										optimisticInventoryReceiver
								) {
									// The exact surviving receiver already flashed. A replaced receiver keeps
									// the canonical cue and receives feedback during reconcile.
									RendererRuntime.runSync(
										dropPresentation.clearFeedbackFx(drop.generation),
									);
								}
								const retainedSource =
									actorStore.actors.get(sourceItem.id) === actor ? actor : null;
								if (retainedSource !== null) {
									retainedSource.dragging = false;
									retainedSource.container.zIndex = 0;
									retainedSource.container.cursor = RendererRuntime.runSync(
										readPixiTileActorCursorFx({
											phase: "idle",
											previewKind: null,
											running: retainedSource.item.running,
										}),
									);
								}
								if (
									result.kind !== DropItemResultKindEnumSchema.enum.Reject &&
									result.kind !== DropItemResultKindEnumSchema.enum.Ignored
								) {
									const removalAccepted =
										result.kind ===
											DropItemResultKindEnumSchema.enum.StoreInventory ||
										(result.kind === DropItemResultKindEnumSchema.enum.Stack &&
											result.source.current === null);
									if (
										!removalAccepted &&
										optimisticRemoval !== null &&
										removalStarted
									) {
										restoreOptimisticRemoval(optimisticRemoval);
									}
									onAcceptedDrop();
									return;
								}
								if (optimisticRemoval !== null && removalStarted) {
									restoreOptimisticRemoval(optimisticRemoval);
								}
								if (retainedSource !== null) settleActor(retainedSource);
							} catch (cause) {
								game.reportCriticalFailure("game-presentation", cause);
							}
						};

						const failDrop = (cause: unknown) => {
							if (closed || finalized) return;
							finalized = true;
							RendererRuntime.runSync(dropPresentation.failFx(drop.generation));
							const retainedSource =
								actorStore.actors.get(sourceItem.id) === actor ? actor : null;
							if (retainedSource !== null) {
								retainedSource.dragging = false;
								if (optimisticRemoval !== null && removalStarted) {
									restoreOptimisticRemoval(optimisticRemoval);
								}
								settleActor(retainedSource);
							}
							game.reportCriticalFailure("game-presentation", cause);
						};

						if (shortcutReceiver === undefined) {
							startRemoval();
							flashInventoryReceiver();
						} else {
							const finishTravel = () => {
								if (closed || finalized) return;
								flashInventoryReceiver();
								startRemoval();
							};
							RendererRuntime.runSync(
								animatePixiActorToRetargetablePoseFx({
									actor,
									animator,
									onCancel: finishTravel,
									onComplete: finishTravel,
									ownerKey: `${inventoryShortcutTravelOwnerPrefix}:${actor.instanceId}`,
									readSize: () =>
										RendererRuntime.runSync(
											surface.readActorPoseFx(shortcutReceiver.actor.item),
										)?.size ?? shortcutReceiver.pose.size,
									readTarget: () => {
										const pose = RendererRuntime.runSync(
											surface.readActorPoseFx(shortcutReceiver.actor.item),
										);
										return pose === null
											? null
											: {
													x: pose.x,
													y: pose.y,
												};
									},
									target: shortcutReceiver.pose,
								}),
							);
						}
						let submittedDrop: PromiseLike<runTileDropAtom.Result | null>;
						try {
							submittedDrop = closed ? Promise.resolve(null) : onDrop(drop.command);
						} catch (cause) {
							submittedDrop = Promise.reject(cause);
						}
						void Promise.resolve(submittedDrop)
							.then((result) => {
								if (result !== null) finalizeResult(result);
							})
							.catch(failDrop);
					}),
			),
			closeFx: Effect.sync(() => {
				if (closed) return;
				closed = true;
			}),
		} satisfies PixiMainSceneDropSubmission;
	},
);
