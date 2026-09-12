import { Effect } from "effect";
import { match } from "ts-pattern";

import type { GameEngine } from "~/playable-game/type/GameEngine";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { DropItemCommand } from "~/item-interaction/type/DropItemCommand";
import type { DropItemResult } from "~/item-interaction/type/DropItemResult";
import { DropItemResultKind } from "~/item-interaction/type/DropItemResult";
import type { readDropItemPreviewFx } from "~/item-interaction/fx/readDropItemPreviewFx";
import type { MainActorStore } from "~/tile-rendering/service/MainActorStore";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import { readActorCursorFn } from "~/tile-rendering/fn/readActorCursorFn";
import { animateRetargetablePoseFx } from "~/tile-rendering/fx/animateRetargetablePoseFx";
import type { ActorAnimator } from "~/tile-rendering/service/ActorAnimator";
import { restoreActorExitFx } from "~/tile-rendering/fx/restoreActorExitFx";
import { startActorExitFx } from "~/tile-rendering/fx/startActorExitFx";
import { burstFeedbackParticlesFx } from "~/tile-rendering/fx/burstFeedbackParticlesFx";
import { settleDraggedActorFx } from "~/tile-interaction/fx/settleDraggedActorFx";
import type { CursorGrabMotion } from "~/tile-interaction/fx/createCursorGrabMotionFx";
import type { DropPresentation } from "~/tile-interaction/fx/createDropPresentationFx";
import type { MagneticField } from "~/tile-motion/service/MagneticField";
import type { MotionRuntime } from "~/tile-motion/service/MotionRuntime";
import type { MotionRedirect } from "~/tile-motion/type/MotionTarget";
import type { MainInteractionSurface } from "~/tile-interaction/type/MainInteractionSurface";

export interface DropSubmission {
	readonly isPendingActorFx: (actorId: string) => Effect.Effect<boolean, never, never>;
	readonly submitFx: (request: {
		readonly actor: PixiTileActor;
		readonly commandTarget: DropItemCommand["target"];
		readonly previewKind: readDropItemPreviewFx.Result["kind"] | null;
		readonly shortcutReceiver?: {
			readonly actor: PixiTileActor;
			readonly pose: {
				readonly size: number;
				readonly x: number;
				readonly y: number;
			};
		};
		readonly sourceItem: TileActorItem;
		readonly targetItem: TileActorItem | null;
	}) => Effect.Effect<void, never, never>;
	readonly closeFx: Effect.Effect<void, never, never>;
}

interface Props {
	readonly actorStore: MainActorStore;
	readonly animator: ActorAnimator;
	readonly cursorGrab: CursorGrabMotion;
	readonly dropPresentation: DropPresentation;
	readonly game: GameEngine;
	readonly magneticField: MagneticField;
	readonly motion: MotionRuntime;
	readonly onAcceptedDropFn: () => void;
	readonly onDropFn: (command: DropItemCommand) => PromiseLike<DropItemResult>;
	readonly surface: MainInteractionSurface;
}

const inventoryShortcutTravelOwnerPrefix = "inventory-shortcut-travel";

const readTargetRedirectFn = (result: DropItemResult): MotionRedirect | null =>
	match(result)
		.with(
			{
				kind: DropItemResultKind.StoreInventory,
			},
			(store) =>
				store.source.current === null
					? {
							sourceActorId: store.source.itemId,
							targetActorId: store.inventory.itemId,
							targetLocation: store.inventory.location,
						}
					: null,
		)
		.with(
			{
				kind: DropItemResultKind.StoreInput,
			},
			(store) =>
				store.source.current === null
					? {
							sourceActorId: store.source.itemId,
							targetActorId: store.owner.itemId,
							targetLocation: store.owner.location,
						}
					: null,
		)
		.with(
			{
				kind: DropItemResultKind.Stack,
			},
			(stack) =>
				stack.source.current === null
					? {
							sourceActorId: stack.source.itemId,
							targetActorId: stack.target.current.itemId,
							targetLocation: stack.target.current.location,
						}
					: null,
		)
		.with(
			{
				kind: DropItemResultKind.Merge,
			},
			(merge) =>
				merge.source.current === null && merge.target.current !== null
					? {
							sourceActorId: merge.source.itemId,
							targetActorId: merge.target.current.itemId,
							targetLocation: merge.target.current.location,
						}
					: null,
		)
		.with(
			{
				kind: DropItemResultKind.Move,
			},
			() => null,
		)
		.with(
			{
				kind: DropItemResultKind.Swap,
			},
			() => null,
		)
		.with(
			{
				kind: DropItemResultKind.Ignored,
			},
			() => null,
		)
		.with(
			{
				kind: DropItemResultKind.Reject,
			},
			() => null,
		)
		.exhaustive();

const beginDropFx = Effect.fn("createDropSubmissionFx.beginDropFx")(function* ({
	commandTarget,
	dropPresentation,
	previewKind,
	sourceItem,
	targetItem,
}: {
	readonly commandTarget: DropItemCommand["target"];
	readonly dropPresentation: DropPresentation;
	readonly previewKind: readDropItemPreviewFx.Result["kind"] | null;
	readonly sourceItem: TileActorItem;
	readonly targetItem: TileActorItem | null;
}) {
	const swapCandidate =
		previewKind === DropItemResultKind.Swap && targetItem !== null
			? {
					source: {
						id: sourceItem.id,
						location: sourceItem.location,
						revision: sourceItem.revision,
					},
					target: {
						id: targetItem.id,
						location: targetItem.location,
						revision: targetItem.revision,
					},
				}
			: null;
	const command = {
		sourceItemId: sourceItem.id,
		sourceLocation: sourceItem.location,
		sourceRevision: sourceItem.revision,
		target: commandTarget,
	} satisfies DropItemCommand;
	const generation = yield* dropPresentation.beginFx({
		sourceActorId: sourceItem.id,
		swapCandidate,
	});
	return {
		command,
		generation,
	};
});

/**
 * Owns each independent drop from frozen release facts through command settlement.
 *
 * Presentation generations keep late or concurrent Promises isolated. Actor identity plus its
 * lifecycle generation make optimistic removal rollback safe when reconciliation replaces or
 * supersedes the released actor. This owner never caches gameplay state.
 */
export const createDropSubmissionFx = Effect.fn("createDropSubmissionFx")(function* ({
	actorStore,
	animator,
	cursorGrab,
	dropPresentation,
	game,
	magneticField,
	motion,
	onAcceptedDropFn,
	onDropFn,
	surface,
}: Props) {
	let closed = false;

	const settleActorFn = (actor: PixiTileActor) => {
		RendererRuntime.runSync(
			settleDraggedActorFx({
				actor,
				animator,
				surface,
			}),
		);
	};

	const restoreOptimisticRemovalFn = ({
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
			restoreActorExitFx({
				actor,
				animator,
			}),
		);
	};

	return {
		isPendingActorFx: Effect.fn("DropSubmission.isPendingActorFx")((actorId) =>
			Effect.map(dropPresentation.readSnapshotFx, ({ pendingActorIds }) =>
				pendingActorIds.has(actorId),
			),
		),
		submitFx: Effect.fn("DropSubmission.submitFx")(
			({ actor, commandTarget, previewKind, shortcutReceiver, sourceItem, targetItem }) =>
				Effect.sync(() => {
					if (closed) return;
					RendererRuntime.runSync(cursorGrab.finishFx(actor));
					RendererRuntime.runSync(magneticField.resetFx);
					RendererRuntime.runSync(surface.renderDropFeedbackFx(null, null));
					actor.container.cursor = readActorCursorFn({
						phase: "pending",
						previewKind,
						running: sourceItem.running,
					});
					const drop = RendererRuntime.runSync(
						beginDropFx({
							commandTarget,
							dropPresentation,
							previewKind,
							sourceItem,
							targetItem,
						}),
					);
					const optimisticRemoval =
						previewKind === DropItemResultKind.StoreInventory ||
						(previewKind === DropItemResultKind.Stack && sourceItem.quantity === 1)
							? {
									actor,
									lifecycleGeneration: actor.lifecycleIntentGeneration + 1,
									sourceActorId: sourceItem.id,
								}
							: null;
					const optimisticInventoryReceiver =
						previewKind === DropItemResultKind.StoreInventory && targetItem !== null
							? (actorStore.actors.get(targetItem.id) ?? null)
							: null;
					let removalStarted = false;
					let shortcutVisualComplete = shortcutReceiver === undefined;
					let queuedResult: DropItemResult | null = null;
					let finalized = false;
					let targetRedirected = false;

					const startRemovalFn = () => {
						if (optimisticRemoval === null || removalStarted) return;
						removalStarted = true;
						RendererRuntime.runSync(
							startActorExitFx({
								actor: optimisticRemoval.actor,
								animator,
								onCancelFn: () => {
									shortcutVisualComplete = true;
									if (queuedResult !== null) finalizeResultFn(queuedResult);
								},
								onCompleteFn: () => {
									shortcutVisualComplete = true;
									if (queuedResult !== null) finalizeResultFn(queuedResult);
								},
							}),
						);
					};

					const flashInventoryReceiverFn = () => {
						if (optimisticInventoryReceiver === null) return;
						RendererRuntime.runSync(
							burstFeedbackParticlesFx({
								actor: optimisticInventoryReceiver,
								animator,
							}),
						);
					};

					const finalizeResultFn = (result: DropItemResult) => {
						if (finalized || closed) return;
						try {
							if (!targetRedirected) {
								const targetRedirect = readTargetRedirectFn(result);
								if (targetRedirect !== null) {
									RendererRuntime.runSync(
										motion.redirectTargetFx(targetRedirect),
									);
									targetRedirected = true;
								}
							}
						} catch (cause) {
							game.reportCriticalFailureFn("game-presentation", cause);
							return;
						}
						if (
							shortcutReceiver !== undefined &&
							result.kind === DropItemResultKind.StoreInventory &&
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
								result.kind === DropItemResultKind.StoreInventory &&
								optimisticInventoryReceiver !== null &&
								result.inventory.itemId === optimisticInventoryReceiver.item.id &&
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
								retainedSource.container.cursor = readActorCursorFn({
									phase: "idle",
									previewKind: null,
									running: retainedSource.item.running,
								});
							}
							if (
								result.kind !== DropItemResultKind.Reject &&
								result.kind !== DropItemResultKind.Ignored
							) {
								const removalAccepted =
									result.kind === DropItemResultKind.StoreInventory ||
									(result.kind === DropItemResultKind.Stack &&
										result.source.current === null);
								if (
									!removalAccepted &&
									optimisticRemoval !== null &&
									removalStarted
								) {
									restoreOptimisticRemovalFn(optimisticRemoval);
								}
								onAcceptedDropFn();
								return;
							}
							if (optimisticRemoval !== null && removalStarted) {
								restoreOptimisticRemovalFn(optimisticRemoval);
							}
							if (retainedSource !== null) settleActorFn(retainedSource);
						} catch (cause) {
							game.reportCriticalFailureFn("game-presentation", cause);
						}
					};

					const failDropFn = (cause: unknown) => {
						if (closed || finalized) return;
						finalized = true;
						RendererRuntime.runSync(dropPresentation.failFx(drop.generation));
						const retainedSource =
							actorStore.actors.get(sourceItem.id) === actor ? actor : null;
						if (retainedSource !== null) {
							retainedSource.dragging = false;
							if (optimisticRemoval !== null && removalStarted) {
								restoreOptimisticRemovalFn(optimisticRemoval);
							}
							settleActorFn(retainedSource);
						}
						game.reportCriticalFailureFn("game-presentation", cause);
					};

					if (shortcutReceiver === undefined) {
						startRemovalFn();
						flashInventoryReceiverFn();
					} else {
						const finishTravelFn = () => {
							if (closed || finalized) return;
							flashInventoryReceiverFn();
							startRemovalFn();
						};
						RendererRuntime.runSync(
							animateRetargetablePoseFx({
								actor,
								animator,
								onCancelFn: finishTravelFn,
								onCompleteFn: finishTravelFn,
								ownerKey: `${inventoryShortcutTravelOwnerPrefix}:${actor.instanceId}`,
								readSizeFn: () =>
									RendererRuntime.runSync(
										surface.readActorPoseFx(shortcutReceiver.actor.item),
									)?.size ?? shortcutReceiver.pose.size,
								readTargetFn: () => {
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
					let submittedDrop: PromiseLike<DropItemResult | null>;
					try {
						submittedDrop = closed ? Promise.resolve(null) : onDropFn(drop.command);
					} catch (cause) {
						submittedDrop = Promise.reject(cause);
					}
					void Promise.resolve(submittedDrop)
						.then((result) => {
							if (result !== null) finalizeResultFn(result);
						})
						.catch(failDropFn);
				}),
		),
		closeFx: Effect.sync(() => {
			if (closed) return;
			closed = true;
		}),
	} satisfies DropSubmission;
});
