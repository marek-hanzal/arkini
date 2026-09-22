import { Effect } from "effect";

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
import type { ActorAnimator } from "~/tile-rendering/service/ActorAnimator";
import { settleDraggedActorFx } from "~/tile-interaction/fx/settleDraggedActorFx";
import type { CursorGrabMotion } from "~/tile-interaction/fx/createCursorGrabMotionFx";
import type { DropPresentation } from "~/tile-interaction/fx/createDropPresentationFx";
import type { MainInteractionSurface } from "~/tile-interaction/type/MainInteractionSurface";

export interface DropSubmission {
	readonly isPendingActorFx: (actorId: string) => Effect.Effect<boolean, never, never>;
	readonly submitFx: (request: {
		readonly actor: PixiTileActor;
		readonly commandTarget: DropItemCommand["target"];
		readonly previewKind: readDropItemPreviewFx.Result["kind"] | null;
		readonly onReturnSettledFn: () => void;
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
	readonly onSettledDropFn: () => void;
	readonly onRejectedDropFn?: () => void;
	readonly onDropFn: (command: DropItemCommand) => PromiseLike<DropItemResult>;
	readonly surface: MainInteractionSurface;
}

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
	const source = {
		sourceItemId: sourceItem.id,
		sourceLocation: sourceItem.location,
		sourceRevision: sourceItem.revision,
	};
	const command = {
		...source,
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
	onSettledDropFn,
	onDropFn,
	onRejectedDropFn,
	surface,
}: Props) {
	let closed = false;

	const settleActorFn = (actor: PixiTileActor, onCompleteFn: () => void) => {
		RendererRuntime.runSync(
			settleDraggedActorFx({
				actor,
				animator,
				onCompleteFn,
				surface,
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
			({ actor, commandTarget, onReturnSettledFn, previewKind, sourceItem, targetItem }) =>
				Effect.sync(() => {
					if (closed) return;
					RendererRuntime.runSync(cursorGrab.finishFx(actor));
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
					let finalized = false;

					const finalizeResultFn = (result: DropItemResult) => {
						if (finalized || closed) return;
						try {
							if (result.kind === DropItemResultKind.Reject) onRejectedDropFn?.();
						} catch (cause) {
							game.reportCriticalFailureFn("game-presentation", cause);
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
								onSettledDropFn();
								return;
							}
							if (
								retainedSource !== null &&
								actorStore.canonicalItems.has(sourceItem.id)
							) {
								settleActorFn(retainedSource, onReturnSettledFn);
							} else {
								onReturnSettledFn();
							}
							onSettledDropFn();
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
							settleActorFn(retainedSource, onReturnSettledFn);
						} else {
							onReturnSettledFn();
						}
						game.reportCriticalFailureFn("game-presentation", cause);
					};

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
