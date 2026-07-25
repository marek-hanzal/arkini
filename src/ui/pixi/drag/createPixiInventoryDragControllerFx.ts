import { Effect } from "effect";
import type { FederatedPointerEvent } from "pixi.js";

import type { GameEngine } from "~/bridge/game/GameEngine";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import { DropItemResultKindEnumSchema } from "~/bridge/tile/DropItemResultKindEnumSchema";
import { LocationScopeEnumSchema } from "~/bridge/tile/LocationScopeEnumSchema";
import {
	readTileDropPreviewFx,
	type readTileDropPreviewFx as ReadTileDropPreviewFx,
} from "~/bridge/tile/readTileDropPreviewFx";
import type { runTileDropAtom } from "~/bridge/tile/runTileDropAtom";
import type { PixiInventoryActorStore } from "~/ui/pixi/actor/PixiInventoryActorStore";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import { readPixiTileActorCursorFx } from "~/ui/pixi/actor/readPixiTileActorCursorFx";
import type { PixiInventoryDragController } from "~/ui/pixi/drag/PixiInventoryDragController";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import type { PixiInventoryDropTarget } from "~/ui/pixi/scene/PixiInventoryDropTarget";
import type { PixiInventorySceneSurface } from "~/ui/pixi/scene/PixiInventorySceneSurface";

export namespace createPixiInventoryDragControllerFx {
	export interface Props {
		readonly actorStore: PixiInventoryActorStore;
		readonly application: PixiApplicationOwner;
		readonly game: GameEngine;
		readonly onActivate: (
			item: TileActorItem,
			shiftKey: boolean,
			origin: HTMLElement,
			handoff: {
				readonly centerX: number;
				readonly centerY: number;
				readonly size: number;
			},
		) => void | PromiseLike<unknown>;
		readonly onAcceptedDropFx: Effect.Effect<void>;
		readonly onDrop: (command: runTileDropAtom.Command) => PromiseLike<runTileDropAtom.Result>;
		readonly surface: PixiInventorySceneSurface;
	}
}

interface ActiveInventoryDrag {
	readonly actor: PixiTileActor;
	readonly pointerId: number;
	readonly pressX: number;
	readonly pressY: number;
	readonly sourceItem: TileActorItem;
	readonly startX: number;
	readonly startY: number;
	awaitingCommand: boolean;
	started: boolean;
	target: PixiInventoryDropTarget | null;
}

const dragThreshold = 6;

/** Owns Inventory activation, pointer capture, local drag preview and Atom drop handoff. */
export const createPixiInventoryDragControllerFx = Effect.fn("createPixiInventoryDragControllerFx")(
	function* ({
		actorStore,
		application,
		game,
		onActivate,
		onAcceptedDropFx,
		onDrop,
		surface,
	}: createPixiInventoryDragControllerFx.Props) {
		const activatingActorIds = new Set<string>();
		let activeDrag: ActiveInventoryDrag | null = null;
		let closed = false;

		const releasePointerCapture = (pointerId: number) => {
			try {
				application.app.canvas.releasePointerCapture(pointerId);
			} catch {
				// Capture may already be released by the browser.
			}
		};

		const readCommandTarget = (target: PixiInventoryDropTarget | null) => {
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

		const activateActor = (actor: PixiTileActor, shiftKey: boolean) => {
			if (activatingActorIds.has(actor.item.id)) return;
			const bounds = application.app.canvas.getBoundingClientRect();
			const item = actor.item;
			const handoff = {
				centerX: bounds.left + actor.container.x + actor.size / 2,
				centerY: bounds.top + actor.container.y + actor.size / 2,
				size: actor.size,
			};
			activatingActorIds.add(item.id);
			void Promise.resolve()
				.then(() => {
					if (closed) return;
					return onActivate(item, shiftKey, application.app.canvas, handoff);
				})
				.catch((cause) => {
					if (closed) return;
					console.error("Pixi Inventory activation failed.", cause);
				})
				.finally(() => {
					activatingActorIds.delete(item.id);
				});
		};

		const previewTarget = (
			drag: ActiveInventoryDrag,
			target: PixiInventoryDropTarget | null,
			force = false,
		) => {
			if (!force && drag.target?.x === target?.x && drag.target?.y === target?.y) return;
			drag.target = target;
			let kind: ReadTileDropPreviewFx.Result["kind"] | null = null;
			try {
				kind = RendererRuntime.runSync(
					readTileDropPreviewFx({
						game,
						sourceItemId: drag.sourceItem.id,
						sourceLocation: drag.sourceItem.location,
						sourceRevision: drag.sourceItem.revision,
						target: readCommandTarget(target),
					}),
				).kind;
			} catch (cause) {
				console.error("Pixi Inventory drop preview failed.", cause);
			}
			drag.actor.container.cursor = RendererRuntime.runSync(
				readPixiTileActorCursorFx({
					phase: "dragging",
					previewKind: kind,
					running: drag.sourceItem.running,
				}),
			);
			RendererRuntime.runSync(surface.renderDropFeedbackFx(target, kind));
		};

		const settleActor = (actor: PixiTileActor) => {
			const pose = RendererRuntime.runSync(surface.readActorPoseFx(actor.item));
			if (pose === null || actor.container.destroyed) return;
			surface.actorLayer.addChild(actor.container);
			actor.dragging = false;
			actor.container.zIndex = 0;
			actor.container.cursor = RendererRuntime.runSync(
				readPixiTileActorCursorFx({
					phase: "idle",
					previewKind: null,
					running: actor.item.running,
				}),
			);
			actor.container.x = pose.x;
			actor.container.y = pose.y;
			RendererRuntime.runSync(application.frames.invalidateFx);
		};

		const cancelInteraction = () => {
			const drag = activeDrag;
			if (drag === null || drag.awaitingCommand) return;
			releasePointerCapture(drag.pointerId);
			activeDrag = null;
			RendererRuntime.runSync(surface.renderDropFeedbackFx(null, null));
			settleActor(drag.actor);
		};

		const onPointerMove = (event: FederatedPointerEvent) => {
			const drag = activeDrag;
			if (drag === null || drag.awaitingCommand || event.pointerId !== drag.pointerId) {
				return;
			}
			const offsetX = event.global.x - drag.pressX;
			const offsetY = event.global.y - drag.pressY;
			if (!drag.started && Math.hypot(offsetX, offsetY) < dragThreshold) return;
			if (!drag.started) {
				drag.started = true;
				drag.actor.dragging = true;
				drag.actor.container.cursor = "grabbing";
				surface.actorLayer.addChild(drag.actor.container);
				drag.actor.container.zIndex = 10_000;
			}
			drag.actor.container.x = drag.startX + offsetX;
			drag.actor.container.y = drag.startY + offsetY;
			previewTarget(
				drag,
				RendererRuntime.runSync(surface.readDropTargetFx(event.global.x, event.global.y)),
			);
			RendererRuntime.runSync(application.frames.invalidateFx);
		};

		const finishPointer = (event: FederatedPointerEvent) => {
			const drag = activeDrag;
			if (drag === null || drag.awaitingCommand || event.pointerId !== drag.pointerId) {
				return;
			}
			releasePointerCapture(event.pointerId);
			if (!drag.started) {
				activeDrag = null;
				activateActor(drag.actor, event.shiftKey);
				return;
			}
			const target = RendererRuntime.runSync(
				surface.readDropTargetFx(event.global.x, event.global.y),
			);
			// The occupant may have changed while the pointer remained over this slot.
			previewTarget(drag, target, true);
			RendererRuntime.runSync(surface.renderDropFeedbackFx(null, null));
			drag.awaitingCommand = true;
			drag.actor.container.cursor = "progress";
			const command = {
				sourceItemId: drag.sourceItem.id,
				sourceLocation: drag.sourceItem.location,
				sourceRevision: drag.sourceItem.revision,
				target: readCommandTarget(target),
			} satisfies runTileDropAtom.Command;
			void Promise.resolve()
				.then(() => {
					if (closed) return null;
					return onDrop(command);
				})
				.then((result) => {
					if (result === null || closed || activeDrag !== drag) return;
					activeDrag = null;
					try {
						const current = RendererRuntime.runSync(
							actorStore.readActorFx(drag.sourceItem.id),
						);
						if (current !== null) {
							current.dragging = false;
							current.container.zIndex = 0;
							current.container.cursor = RendererRuntime.runSync(
								readPixiTileActorCursorFx({
									phase: "idle",
									previewKind: null,
									running: current.item.running,
								}),
							);
							RendererRuntime.runSync(application.frames.invalidateFx);
						}
						if (
							result.kind !== DropItemResultKindEnumSchema.enum.Reject &&
							result.kind !== DropItemResultKindEnumSchema.enum.Ignored
						) {
							RendererRuntime.runSync(onAcceptedDropFx);
							return;
						}
						if (current !== null) settleActor(current);
					} catch (cause) {
						console.error("Pixi Inventory drop completion failed.", cause);
					}
				})
				.catch((cause) => {
					if (closed || activeDrag !== drag) return;
					console.error("Pixi Inventory drop failed.", cause);
					activeDrag = null;
					const current = RendererRuntime.runSync(
						actorStore.readActorFx(drag.sourceItem.id),
					);
					if (current !== null) {
						current.dragging = false;
						settleActor(current);
					}
				});
		};

		const cancelPointer = (event: FederatedPointerEvent) => {
			const drag = activeDrag;
			if (drag === null || drag.awaitingCommand || event.pointerId !== drag.pointerId) {
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
			attachActorFx: Effect.fn("PixiInventoryDragController.attachActorFx")((actor) =>
				Effect.sync(() => {
					const onPointerDown = (event: FederatedPointerEvent) => {
						if (
							closed ||
							activeDrag !== null ||
							!event.isPrimary ||
							event.button !== 0
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
							awaitingCommand: false,
							pointerId: event.pointerId,
							pressX: event.global.x,
							pressY: event.global.y,
							sourceItem: actor.item,
							started: false,
							startX: actor.container.x,
							startY: actor.container.y,
							target: null,
						};
					};
					actor.onPointerDown = onPointerDown;
					actor.container.on("pointerdown", onPointerDown);
				}),
			),
			cancelInteractionFx: Effect.sync(cancelInteraction),
			closeFx: Effect.sync(() => {
				if (closed) return;
				closed = true;
				if (activeDrag !== null) releasePointerCapture(activeDrag.pointerId);
				activeDrag = null;
				activatingActorIds.clear();
				application.stage.off("globalpointermove", onPointerMove);
				application.stage.off("pointerup", finishPointer);
				application.stage.off("pointerupoutside", finishPointer);
				application.stage.off("pointercancel", cancelPointer);
			}),
			refreshPreviewFx: Effect.sync(() => {
				const drag = activeDrag;
				if (drag === null || !drag.started || drag.awaitingCommand) return;
				previewTarget(drag, drag.target, true);
			}),
			removeActorFx: Effect.fn("PixiInventoryDragController.removeActorFx")((actor) =>
				Effect.sync(() => {
					activatingActorIds.delete(actor.item.id);
					if (activeDrag?.actor !== actor) return;
					releasePointerCapture(activeDrag.pointerId);
					activeDrag = null;
					RendererRuntime.runSync(surface.renderDropFeedbackFx(null, null));
					actor.dragging = false;
				}),
			),
		} satisfies PixiInventoryDragController;
	},
);
