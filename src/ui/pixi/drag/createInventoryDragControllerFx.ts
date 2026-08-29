import { Effect } from "effect";
import type { FederatedPointerEvent } from "pixi.js";
import { match, P } from "ts-pattern";

import type { GameEngine } from "~/renderer/game/GameEngine";
import { RendererRuntime } from "~/renderer/RendererRuntime";
import type { TileActorItem } from "~/ui/pixi/actor/TileActorItem";
import { DropItemResultKind } from "~/item-interaction/DropItemResult";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { isSameTileActorLocationFn } from "~/ui/pixi/actor/fn/isSameTileActorLocationFn";
import {
	readTileDropPreviewFx,
	type readTileDropPreviewFx as ReadTileDropPreviewFx,
} from "~/ui/pixi/drag/readTileDropPreviewFx";
import type { runTileDropAtom } from "~/ui/pixi/command/runTileDropAtom";
import { PointerDragThreshold } from "~/ui/drag/PointerDragThreshold";
import type { InventoryActorStore } from "~/ui/pixi/actor/InventoryActorStore";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import { readActorCursorFn } from "~/ui/pixi/actor/fn/readActorCursorFn";
import type { ActorAnimator } from "~/ui/pixi/animation/ActorAnimator";
import { animateRetargetablePoseFx } from "~/ui/pixi/animation/animateRetargetablePoseFx";
import { flashConsumedSourceFx } from "~/ui/pixi/animation/flashConsumedSourceFx";
import { burstFeedbackParticlesFx } from "~/ui/pixi/animation/burstFeedbackParticlesFx";
import type { InventoryDragController } from "~/ui/pixi/drag/InventoryDragController";
import { makePointerOffsetReaderFx } from "~/ui/pixi/drag/makePointerOffsetReaderFx";
import { setDraggedActorPoseFx } from "~/ui/pixi/drag/setDraggedActorPoseFx";
import { restoreActorExitFx } from "~/ui/pixi/animation/restoreActorExitFx";
import { startActorExitFx } from "~/ui/pixi/animation/startActorExitFx";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import type { InventoryDropTarget } from "~/ui/pixi/scene/InventoryDropTarget";
import type { InventorySurface } from "~/ui/pixi/scene/InventorySurface";

export namespace createInventoryDragControllerFx {
	export interface Props {
		readonly actorStore: InventoryActorStore;
		readonly animator: ActorAnimator;
		readonly application: PixiApplicationOwner;
		readonly game: GameEngine;
		readonly onActivate: (
			item: TileActorItem,
			openDetail: boolean,
			origin: HTMLElement,
		) => void | PromiseLike<unknown>;
		readonly onAcceptedDropFx: Effect.Effect<void>;
		readonly onDrop: (command: runTileDropAtom.Command) => PromiseLike<runTileDropAtom.Result>;
		readonly surface: InventorySurface;
	}
}

interface ActiveInventoryDrag {
	readonly actor: PixiTileActor;
	readonly openDetail: boolean;
	readonly pointerId: number;
	readonly pressX: number;
	readonly pressY: number;
	readonly sourceItem: TileActorItem;
	readonly startX: number;
	readonly startY: number;
	phase: "dragging" | "pressed" | "submitting";
	target: InventoryDropTarget | null;
}

const expectedActivationFailureTags = new Set([
	"InventoryOpenerUnavailableError",
	"ItemLocationConflictError",
	"ItemNotFoundError",
	"ItemNotOnGridError",
	"PlacementUnavailableError",
	"RevisionConflictError",
]);

const isExpectedActivationFailure = (cause: unknown) =>
	typeof cause === "object" &&
	cause !== null &&
	"_tag" in cause &&
	typeof cause._tag === "string" &&
	expectedActivationFailureTags.has(cause._tag);

/**
 * Owns one Inventory pointer gesture and its local retained-actor presentation.
 *
 * Left click activates, right click opens Item Detail, and only a threshold-crossing left gesture
 * becomes drag. Release re-reads the target occupant and sends exact canonical source facts
 * through the exact game capability.
 */
export const createInventoryDragControllerFx = Effect.fn("createInventoryDragControllerFx")(
	function* ({
		actorStore,
		animator,
		application,
		game,
		onActivate,
		onAcceptedDropFx,
		onDrop,
		surface,
	}: createInventoryDragControllerFx.Props) {
		const removalFeedbackGenerationByActorId = new Map<string, number>();
		const readPointerOffset = yield* makePointerOffsetReaderFx();
		let activeDrag: ActiveInventoryDrag | null = null;
		let closed = false;

		const releasePointerCapture = (pointerId: number) => {
			try {
				application.app.canvas.releasePointerCapture(pointerId);
			} catch {
				// Capture may already be released by the browser.
			}
		};

		const readCommandTarget = (target: InventoryDropTarget | null) => {
			if (target === null) {
				return {
					kind: "unsupported" as const,
				};
			}
			const occupant = RendererRuntime.runSync(actorStore.readOccupantFx(target));
			return {
				kind: "slot" as const,
				location: {
					scope: LocationScopeEnumSchema.enum.Inventory,
					position: {
						x: target.x,
						y: target.y,
					},
				},
				occupant:
					occupant === null
						? null
						: {
								itemId: occupant.id,
								revision: occupant.revision,
							},
			};
		};

		const flashReceiver = (result: runTileDropAtom.Result) => {
			const receiverActorId = match(result)
				.with(
					{
						kind: DropItemResultKind.Stack,
					},
					({ target }) => target.itemId,
				)
				.with(
					{
						kind: DropItemResultKind.StoreInput,
					},
					({ owner }) => owner.itemId,
				)
				.with(
					{
						kind: DropItemResultKind.StoreInventory,
					},
					({ inventory }) => inventory.itemId,
				)
				.otherwise(() => null);
			if (receiverActorId === null) return;
			const receiver = RendererRuntime.runSync(actorStore.readActorFx(receiverActorId));
			if (receiver === null) return;
			RendererRuntime.runSync(
				burstFeedbackParticlesFx({
					actor: receiver,
					animator,
				}),
			);
		};

		const flashSurvivingSource = (result: runTileDropAtom.Result) => {
			const sourceActorId = match(result)
				.with(
					{
						kind: P.union(
							DropItemResultKind.Stack,
							DropItemResultKind.StoreInput,
							DropItemResultKind.StoreInventory,
						),
						source: {
							current: P.nonNullable,
						},
					},
					({ source }) => source.itemId,
				)
				.otherwise(() => null);
			if (sourceActorId === null) return;
			const source = RendererRuntime.runSync(actorStore.readActorFx(sourceActorId));
			if (source === null) return;
			RendererRuntime.runSync(
				flashConsumedSourceFx({
					actor: source,
					animator,
				}),
			);
		};

		const activateActor = (actor: PixiTileActor, openDetail: boolean) => {
			const item = actor.item;
			const presentsOptimisticRemoval =
				!openDetail && item.primaryAction.kind !== "activate-space";
			if (!openDetail && removalFeedbackGenerationByActorId.has(item.id)) return;
			const removalFeedbackGeneration = openDetail
				? null
				: (removalFeedbackGenerationByActorId.get(item.id) ?? 0) + 1;
			if (removalFeedbackGeneration !== null) {
				removalFeedbackGenerationByActorId.set(item.id, removalFeedbackGeneration);
			}
			if (presentsOptimisticRemoval) {
				actor.container.cursor = readActorCursorFn({
					phase: "pending",
					previewKind: null,
					running: item.running,
				});
				RendererRuntime.runSync(
					startActorExitFx({
						actor,
						animator,
					}),
				);
			}
			void Promise.resolve()
				.then(() => {
					if (closed) return;
					return onActivate(item, openDetail, application.app.canvas);
				})
				.catch((cause) => {
					if (closed) return;
					if (!isExpectedActivationFailure(cause)) {
						game.reportCriticalFailure("game-presentation", cause);
					}
				})
				.finally(() => {
					if (
						removalFeedbackGeneration === null ||
						removalFeedbackGenerationByActorId.get(item.id) !==
							removalFeedbackGeneration
					) {
						return;
					}
					removalFeedbackGenerationByActorId.delete(item.id);
					if (!presentsOptimisticRemoval) return;
					if (closed) return;
					const current = RendererRuntime.runSync(actorStore.readActorFx(item.id));
					if (current !== actor || actor.container.destroyed) return;
					actor.container.cursor = readActorCursorFn({
						phase: "idle",
						previewKind: null,
						running: actor.item.running,
					});
					RendererRuntime.runSync(
						restoreActorExitFx({
							actor,
							animator,
						}),
					);
				});
		};

		const previewTarget = (
			drag: ActiveInventoryDrag,
			target: InventoryDropTarget | null,
			force = false,
		): TileActorItem | null => {
			const current = RendererRuntime.runSync(actorStore.readActorFx(drag.sourceItem.id));
			if (
				current === null ||
				current !== drag.actor ||
				current.container.destroyed ||
				!isSameTileActorLocationFn(current.item.location, drag.sourceItem.location)
			) {
				cancelInteraction();
				return null;
			}
			const sourceItem = current.item;
			if (!force && drag.target?.x === target?.x && drag.target?.y === target?.y) {
				return sourceItem;
			}
			drag.target = target;
			let kind: ReadTileDropPreviewFx.Result["kind"] | null = null;
			try {
				kind = RendererRuntime.runSync(
					readTileDropPreviewFx({
						game,
						sourceItemId: sourceItem.id,
						sourceLocation: sourceItem.location,
						sourceRevision: sourceItem.revision,
						target: readCommandTarget(target),
					}),
				).kind;
			} catch (cause) {
				game.reportCriticalFailure("game-presentation", cause);
			}
			drag.actor.container.cursor = readActorCursorFn({
				phase: "dragging",
				previewKind: kind,
				running: sourceItem.running,
			});
			RendererRuntime.runSync(surface.renderDropFeedbackFx(target, kind));
			return sourceItem;
		};

		const settleActor = (actor: PixiTileActor) => {
			const pose = RendererRuntime.runSync(surface.readActorPoseFx(actor.item));
			if (pose === null || actor.container.destroyed) return;
			surface.actorLayer.addChild(actor.container);
			actor.dragging = false;
			actor.container.zIndex = 0;
			actor.container.cursor = readActorCursorFn({
				phase: "idle",
				previewKind: null,
				running: actor.item.running,
			});
			RendererRuntime.runSync(
				animateRetargetablePoseFx({
					actor,
					animator,
					readSize: () => RendererRuntime.runSync(surface.readActorSizeFx),
					readTarget: () => RendererRuntime.runSync(surface.readActorPoseFx(actor.item)),
					target: pose,
				}),
			);
		};

		const cancelInteraction = () => {
			const drag = activeDrag;
			if (drag === null || drag.phase === "submitting") return;
			releasePointerCapture(drag.pointerId);
			activeDrag = null;
			RendererRuntime.runSync(surface.renderDropFeedbackFx(null, null));
			settleActor(drag.actor);
		};

		const onPointerMove = (event: FederatedPointerEvent) => {
			const pointer = readPointerOffset(event, activeDrag);
			if (pointer === null) return;
			const { drag, offsetX, offsetY } = pointer;
			if (drag.phase === "pressed" && Math.hypot(offsetX, offsetY) < PointerDragThreshold)
				return;
			if (drag.phase === "pressed" && drag.openDetail) {
				releasePointerCapture(drag.pointerId);
				activeDrag = null;
				return;
			}
			if (drag.phase === "pressed") {
				drag.phase = "dragging";
				drag.actor.dragging = true;
				drag.actor.container.cursor = "grabbing";
				surface.actorLayer.addChild(drag.actor.container);
				drag.actor.container.zIndex = 10_000;
				RendererRuntime.runSync(animator.cancelChannelFx(drag.actor, "pose"));
			}
			RendererRuntime.runSync(
				setDraggedActorPoseFx({
					actor: drag.actor,
					animator,
					x: drag.startX + offsetX,
					y: drag.startY + offsetY,
				}),
			);
			previewTarget(
				drag,
				RendererRuntime.runSync(surface.readDropTargetFx(event.global.x, event.global.y)),
			);
		};

		const finishPointer = (event: FederatedPointerEvent) => {
			const drag = activeDrag;
			if (
				drag === null ||
				drag.phase === "submitting" ||
				event.pointerId !== drag.pointerId
			) {
				return;
			}
			releasePointerCapture(event.pointerId);
			if (drag.phase === "pressed") {
				activeDrag = null;
				activateActor(drag.actor, drag.openDetail);
				return;
			}
			const target = RendererRuntime.runSync(
				surface.readDropTargetFx(event.global.x, event.global.y),
			);
			// The occupant may have changed while the pointer remained over this slot.
			const sourceItem = previewTarget(drag, target, true);
			if (sourceItem === null) return;
			RendererRuntime.runSync(surface.renderDropFeedbackFx(null, null));
			drag.phase = "submitting";
			drag.actor.container.cursor = readActorCursorFn({
				phase: "pending",
				previewKind: null,
				running: sourceItem.running,
			});
			const command = {
				sourceItemId: sourceItem.id,
				sourceLocation: sourceItem.location,
				sourceRevision: sourceItem.revision,
				target: readCommandTarget(target),
			} satisfies runTileDropAtom.Command;
			let submittedDrop: PromiseLike<runTileDropAtom.Result | null>;
			try {
				submittedDrop = closed ? Promise.resolve(null) : onDrop(command);
			} catch (cause) {
				submittedDrop = Promise.reject(cause);
			}
			void Promise.resolve(submittedDrop)
				.then((result) => {
					if (result === null || closed || activeDrag !== drag) return;
					activeDrag = null;
					try {
						const current = RendererRuntime.runSync(
							actorStore.readActorFx(drag.sourceItem.id),
						);
						if (current === drag.actor) {
							current.dragging = false;
							current.container.zIndex = 0;
							current.container.cursor = readActorCursorFn({
								phase: "idle",
								previewKind: null,
								running: current.item.running,
							});
							RendererRuntime.runSync(application.frames.invalidateFx);
						}
						if (
							result.kind !== DropItemResultKind.Reject &&
							result.kind !== DropItemResultKind.Ignored
						) {
							flashSurvivingSource(result);
							flashReceiver(result);
							RendererRuntime.runSync(onAcceptedDropFx);
							return;
						}
						if (current !== null) settleActor(current);
					} catch (cause) {
						game.reportCriticalFailure("game-presentation", cause);
					}
				})
				.catch((cause) => {
					if (closed || activeDrag !== drag) return;
					activeDrag = null;
					const current = RendererRuntime.runSync(
						actorStore.readActorFx(drag.sourceItem.id),
					);
					if (current === drag.actor) {
						current.dragging = false;
						settleActor(current);
					}
					game.reportCriticalFailure("game-presentation", cause);
				});
		};

		const cancelPointer = (event: FederatedPointerEvent) => {
			const drag = activeDrag;
			if (
				drag === null ||
				drag.phase === "submitting" ||
				event.pointerId !== drag.pointerId
			) {
				return;
			}
			activeDrag = null;
			RendererRuntime.runSync(surface.renderDropFeedbackFx(null, null));
			settleActor(drag.actor);
		};

		application.stage.on("globalpointermove", onPointerMove);
		application.stage.on("pointerup", finishPointer);
		application.stage.on("pointerupoutside", finishPointer);
		application.stage.on("pointercancel", cancelPointer);

		return {
			attachActorFx: Effect.fn("InventoryDragController.attachActorFx")((actor) =>
				Effect.sync(() => {
					const onPointerDown = (event: FederatedPointerEvent) => {
						if (
							closed ||
							activeDrag !== null ||
							!event.isPrimary ||
							(event.button !== 0 && event.button !== 2)
						) {
							return;
						}
						event.stopPropagation();
						try {
							application.app.canvas.setPointerCapture(event.pointerId);
						} catch {
							// Pixi continues to receive in-canvas events without DOM capture.
						}
						activeDrag = {
							actor,
							openDetail: event.button === 2,
							pointerId: event.pointerId,
							pressX: event.global.x,
							pressY: event.global.y,
							phase: "pressed",
							sourceItem: actor.item,
							startX: actor.container.x,
							startY: actor.container.y,
							target: null,
						};
					};
					actor.onPointerDown = onPointerDown;
					actor.container.on("pointerdown", onPointerDown);
					actor.container.eventMode = "static";
					actor.container.cursor = readActorCursorFn({
						phase: "idle",
						previewKind: null,
						running: actor.item.running,
					});
				}),
			),
			cancelInteractionFx: Effect.sync(cancelInteraction),
			closeFx: Effect.sync(() => {
				if (closed) return;
				closed = true;
				if (activeDrag !== null) releasePointerCapture(activeDrag.pointerId);
				activeDrag = null;
				removalFeedbackGenerationByActorId.clear();
				application.stage.off("globalpointermove", onPointerMove);
				application.stage.off("pointerup", finishPointer);
				application.stage.off("pointerupoutside", finishPointer);
				application.stage.off("pointercancel", cancelPointer);
			}),
			refreshPreviewFx: Effect.sync(() => {
				const drag = activeDrag;
				if (drag === null || drag.phase !== "dragging") return;
				previewTarget(drag, drag.target, true);
			}),
			removeActorFx: Effect.fn("InventoryDragController.removeActorFx")((actor) =>
				Effect.sync(() => {
					removalFeedbackGenerationByActorId.delete(actor.item.id);
					if (actor.onPointerDown !== null) {
						actor.container.off("pointerdown", actor.onPointerDown);
						actor.onPointerDown = null;
					}
					actor.container.eventMode = "none";
					actor.container.cursor = "default";
					if (activeDrag?.actor !== actor) return;
					releasePointerCapture(activeDrag.pointerId);
					activeDrag = null;
					RendererRuntime.runSync(surface.renderDropFeedbackFx(null, null));
					actor.dragging = false;
				}),
			),
		} satisfies InventoryDragController;
	},
);
