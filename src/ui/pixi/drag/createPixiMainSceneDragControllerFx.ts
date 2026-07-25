import { Effect } from "effect";
import type { FederatedPointerEvent } from "pixi.js";

import type { GameEngine } from "~/bridge/game/GameEngine";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import { DropItemResultKindEnumSchema } from "~/bridge/tile/DropItemResultKindEnumSchema";
import type { runTileDropAtom } from "~/bridge/tile/runTileDropAtom";
import {
	readTileDropPreviewFx,
	type readTileDropPreviewFx as ReadTileDropPreviewFx,
} from "~/bridge/tile/readTileDropPreviewFx";
import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import { readPixiTileActorCursorFx } from "~/ui/pixi/actor/readPixiTileActorCursorFx";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { readPixiTileTravelDurationMsFx } from "~/ui/pixi/animation/readPixiTileTravelDurationMsFx";
import type { PixiCursorGrabMotion } from "~/ui/pixi/drag/PixiCursorGrabMotion";
import type {
	PixiMainSceneDragController,
	PixiSceneSwapCandidate,
} from "~/ui/pixi/drag/PixiMainSceneDragController";
import type { PixiTileMagneticField } from "~/ui/pixi/magnet/PixiTileMagneticField";
import { readPixiTileAttractionActorIdFx } from "~/ui/pixi/magnet/readPixiTileAttractionActorIdFx";
import type { PixiTileMotionRuntime } from "~/ui/pixi/motion/PixiTileMotionRuntime";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";
import type { PixiSceneDropTarget } from "~/ui/pixi/scene/PixiSceneDropTarget";

export namespace createPixiMainSceneDragControllerFx {
	export interface Props {
		readonly actorStore: PixiMainSceneActorStore;
		readonly animator: PixiActorAnimator;
		readonly application: PixiApplicationOwner;
		readonly cursorGrab: PixiCursorGrabMotion;
		readonly game: GameEngine;
		readonly magneticField: PixiTileMagneticField;
		readonly motion: PixiTileMotionRuntime;
		readonly onActivate: (
			item: TileActorItem,
			shiftKey: boolean,
			origin: HTMLElement,
		) => void | PromiseLike<void>;
		readonly onAcceptedDrop: () => void;
		readonly onDrop: (command: runTileDropAtom.Command) => PromiseLike<runTileDropAtom.Result>;
		readonly surface: PixiMainSceneSurface;
	}
}

interface ActiveDrag {
	readonly actor: PixiTileActor;
	readonly pointerId: number;
	readonly pressX: number;
	readonly pressY: number;
	readonly sourceItem: TileActorItem;
	readonly startX: number;
	readonly startY: number;
	awaitingCommand: boolean;
	lastPointerX: number;
	lastPointerY: number;
	previewKind: ReadTileDropPreviewFx.Result["kind"] | null;
	started: boolean;
	target: PixiSceneDropTarget | null;
	targetItem: TileActorItem | null;
}

const dragThreshold = 6;

/** Owns one pointer gesture, exact engine preview/drop facts and cursor-grab settlement. */
export const createPixiMainSceneDragControllerFx = Effect.fn("createPixiMainSceneDragControllerFx")(
	function* ({
		actorStore,
		animator,
		application,
		cursorGrab,
		game,
		magneticField,
		motion,
		onActivate,
		onAcceptedDrop,
		onDrop,
		surface,
	}: createPixiMainSceneDragControllerFx.Props) {
		let activeDrag: ActiveDrag | null = null;
		let closed = false;
		let interactionBlocked = false;
		let pendingSwapCandidate: PixiSceneSwapCandidate | null = null;

		const previewTarget = (
			drag: ActiveDrag,
			target: PixiSceneDropTarget | null,
			force = false,
		) => {
			if (
				!force &&
				drag.target?.layout.kind === target?.layout.kind &&
				drag.target?.x === target?.x &&
				drag.target?.y === target?.y
			) {
				return;
			}
			drag.target = target;
			drag.targetItem =
				target === null ? null : RendererRuntime.runSync(surface.readOccupantFx(target));
			let kind: ReadTileDropPreviewFx.Result["kind"] | null = null;
			try {
				kind = RendererRuntime.runSync(
					readTileDropPreviewFx({
						game,
						sourceItemId: drag.sourceItem.id,
						sourceLocation: drag.sourceItem.location,
						sourceRevision: drag.sourceItem.revision,
						target: RendererRuntime.runSync(surface.readCommandTargetFx(target)),
					}),
				).kind;
			} catch (cause) {
				console.error("Pixi tile drop preview failed.", cause);
			}
			drag.previewKind = kind;
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
			pose.layer.addChild(actor.container);
			actor.dragging = false;
			actor.container.zIndex = 0;
			actor.container.cursor = RendererRuntime.runSync(
				readPixiTileActorCursorFx({
					phase: "idle",
					previewKind: null,
					running: actor.item.running,
				}),
			);
			const durationMs = RendererRuntime.runSync(
				readPixiTileTravelDurationMsFx({
					fromX: actor.container.x,
					fromY: actor.container.y,
					tileSize: pose.size,
					toX: pose.x,
					toY: pose.y,
				}),
			);
			RendererRuntime.runSync(
				animator.animateFx({
					actor,
					durationMs,
					toX: pose.x,
					toY: pose.y,
				}),
			);
		};

		const cancelInteraction = () => {
			if (activeDrag === null || activeDrag.awaitingCommand) return;
			const drag = activeDrag;
			activeDrag = null;
			try {
				application.app.canvas.releasePointerCapture(drag.pointerId);
			} catch {
				// Capture may already be released by the browser.
			}
			RendererRuntime.runSync(surface.renderDropFeedbackFx(null, null));
			RendererRuntime.runSync(magneticField.resetFx);
			RendererRuntime.runSync(cursorGrab.finishFx(drag.actor));
			settleActor(drag.actor);
		};

		const detachActor = (actor: PixiTileActor) => {
			if (actor.onPointerDown !== null) {
				actor.container.off("pointerdown", actor.onPointerDown);
				actor.onPointerDown = null;
			}
			if (activeDrag?.actor !== actor) return;
			const drag = activeDrag;
			activeDrag = null;
			try {
				application.app.canvas.releasePointerCapture(drag.pointerId);
			} catch {
				// Capture may already be released by the browser.
			}
			RendererRuntime.runSync(surface.renderDropFeedbackFx(null, null));
			RendererRuntime.runSync(magneticField.resetFx);
			RendererRuntime.runSync(cursorGrab.finishFx(actor));
			actor.dragging = false;
			actor.container.cursor = "default";
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
				surface.transientActorLayer.addChild(drag.actor.container);
				drag.actor.container.zIndex = 10_000;
				RendererRuntime.runSync(
					cursorGrab.startFx(drag.actor, {
						x: drag.pressX,
						y: drag.pressY,
					}),
				);
			}
			drag.actor.container.x = drag.startX + offsetX;
			drag.actor.container.y = drag.startY + offsetY;
			previewTarget(
				drag,
				RendererRuntime.runSync(surface.readDropTargetFx(event.global.x, event.global.y)),
			);
			const pointerTravel = {
				x: event.global.x - drag.lastPointerX,
				y: event.global.y - drag.lastPointerY,
			};
			const pointerTravelMagnitude = Math.hypot(pointerTravel.x, pointerTravel.y);
			RendererRuntime.runSync(
				magneticField.updateFx({
					attractedActorId: RendererRuntime.runSync(
						readPixiTileAttractionActorIdFx({
							previewKind: drag.previewKind,
							targetItem: drag.targetItem,
						}),
					),
					sourceActorId: drag.sourceItem.id,
					sourceDirection:
						pointerTravelMagnitude <= 0.001
							? null
							: {
									x: pointerTravel.x / pointerTravelMagnitude,
									y: pointerTravel.y / pointerTravelMagnitude,
								},
					sourceItem: drag.sourceItem,
					sourceX: drag.actor.container.x - drag.actor.container.pivot.x,
					sourceY: drag.actor.container.y - drag.actor.container.pivot.y,
				}),
			);
			drag.lastPointerX = event.global.x;
			drag.lastPointerY = event.global.y;
			RendererRuntime.runSync(application.frames.invalidateFx);
		};

		const finishPointer = (event: FederatedPointerEvent) => {
			const drag = activeDrag;
			if (drag === null || drag.awaitingCommand || event.pointerId !== drag.pointerId) {
				return;
			}
			try {
				application.app.canvas.releasePointerCapture(event.pointerId);
			} catch {
				// Capture may already be released by the browser.
			}
			if (!drag.started) {
				activeDrag = null;
				const shiftKey = event.shiftKey;
				void Promise.resolve()
					.then(() => {
						if (closed) return;
						return onActivate(drag.sourceItem, shiftKey, application.app.canvas);
					})
					.catch((cause) => {
						if (closed) return;
						console.error("Pixi tile activation failed.", cause);
					});
				return;
			}
			RendererRuntime.runSync(cursorGrab.finishFx(drag.actor));
			RendererRuntime.runSync(magneticField.resetFx);
			const target = RendererRuntime.runSync(
				surface.readDropTargetFx(event.global.x, event.global.y),
			);
			// Canonical state may have changed beneath a held pointer while the target
			// coordinates stayed stable. Freeze fresh release-time preview facts.
			previewTarget(drag, target, true);
			RendererRuntime.runSync(surface.renderDropFeedbackFx(null, null));
			drag.awaitingCommand = true;
			drag.actor.container.cursor = "progress";
			pendingSwapCandidate =
				drag.previewKind === DropItemResultKindEnumSchema.enum.Swap &&
				drag.targetItem !== null
					? {
							source: {
								id: drag.sourceItem.id,
								location: drag.sourceItem.location,
								revision: drag.sourceItem.revision,
							},
							target: {
								id: drag.targetItem.id,
								location: drag.targetItem.location,
								revision: drag.targetItem.revision,
							},
						}
					: null;
			const command = {
				sourceItemId: drag.sourceItem.id,
				sourceLocation: drag.sourceItem.location,
				sourceRevision: drag.sourceItem.revision,
				target: RendererRuntime.runSync(surface.readCommandTargetFx(target)),
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
						const current = actorStore.actors.get(drag.sourceItem.id);
						if (current !== undefined) {
							current.dragging = false;
							current.container.zIndex = 0;
							current.container.cursor = RendererRuntime.runSync(
								readPixiTileActorCursorFx({
									phase: "idle",
									previewKind: null,
									running: current.item.running,
								}),
							);
						}
						if (
							result.kind !== DropItemResultKindEnumSchema.enum.Reject &&
							result.kind !== DropItemResultKindEnumSchema.enum.Ignored
						) {
							onAcceptedDrop();
							return;
						}
						pendingSwapCandidate = null;
						if (current !== undefined) settleActor(current);
					} catch (cause) {
						console.error("Pixi tile drop completion failed.", cause);
					}
				})
				.catch((cause) => {
					if (closed || activeDrag !== drag) return;
					console.error("Pixi tile drop failed.", cause);
					activeDrag = null;
					pendingSwapCandidate = null;
					const current = actorStore.actors.get(drag.sourceItem.id);
					if (current !== undefined) {
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
			RendererRuntime.runSync(magneticField.resetFx);
			RendererRuntime.runSync(cursorGrab.finishFx(drag.actor));
			settleActor(drag.actor);
		};

		application.stage.on("globalpointermove", onPointerMove);
		application.stage.on("pointerup", finishPointer);
		application.stage.on("pointerupoutside", finishPointer);
		application.stage.on("pointercancel", cancelPointer);

		return {
			attachActorFx: Effect.fn("PixiMainSceneDragController.attachActorFx")((actor) =>
				Effect.sync(() => {
					if (actor.onPointerDown !== null) {
						actor.container.off("pointerdown", actor.onPointerDown);
					}
					const onPointerDown = (event: FederatedPointerEvent) => {
						const motionOwnedActorIds = RendererRuntime.runSync(
							motion.readSnapshotFx,
						).ownedActorIds;
						if (
							closed ||
							interactionBlocked ||
							activeDrag !== null ||
							motionOwnedActorIds.has(actor.item.id) ||
							!event.isPrimary ||
							event.button !== 0
						) {
							return;
						}
						event.stopPropagation();
						RendererRuntime.runSync(animator.cancelFx(actor.item.id));
						try {
							application.app.canvas.setPointerCapture(event.pointerId);
						} catch {
							// Pixi still receives in-canvas pointer events without DOM capture.
						}
						activeDrag = {
							actor,
							awaitingCommand: false,
							pointerId: event.pointerId,
							pressX: event.global.x,
							pressY: event.global.y,
							lastPointerX: event.global.x,
							lastPointerY: event.global.y,
							previewKind: null,
							sourceItem: actor.item,
							started: false,
							startX: actor.container.x,
							startY: actor.container.y,
							target: null,
							targetItem: null,
						};
					};
					actor.onPointerDown = onPointerDown;
					actor.container.on("pointerdown", onPointerDown);
				}),
			),
			cancelInteractionFx: Effect.sync(() => cancelInteraction()),
			clearSwapCandidateFx: Effect.sync(() => {
				pendingSwapCandidate = null;
			}),
			detachActorFx: Effect.fn("PixiMainSceneDragController.detachActorFx")((actor) =>
				Effect.sync(() => detachActor(actor)),
			),
			readSwapCandidateFx: Effect.sync(
				(): PixiSceneSwapCandidate | null => pendingSwapCandidate,
			),
			refreshPreviewFx: Effect.sync(() => {
				const drag = activeDrag;
				if (drag === null || !drag.started || drag.awaitingCommand) return;
				previewTarget(
					drag,
					RendererRuntime.runSync(
						surface.readDropTargetFx(drag.lastPointerX, drag.lastPointerY),
					),
					true,
				);
				RendererRuntime.runSync(
					magneticField.updateFx({
						attractedActorId: RendererRuntime.runSync(
							readPixiTileAttractionActorIdFx({
								previewKind: drag.previewKind,
								targetItem: drag.targetItem,
							}),
						),
						sourceActorId: drag.sourceItem.id,
						sourceDirection: null,
						sourceItem: drag.sourceItem,
						sourceX: drag.actor.container.x - drag.actor.container.pivot.x,
						sourceY: drag.actor.container.y - drag.actor.container.pivot.y,
					}),
				);
			}),
			setInteractionBlockedFx: Effect.fn(
				"PixiMainSceneDragController.setInteractionBlockedFx",
			)((blocked) =>
				Effect.sync(() => {
					interactionBlocked = blocked;
					if (blocked) cancelInteraction();
				}),
			),
			closeFx: Effect.gen(function* () {
				if (closed) return;
				closed = true;
				pendingSwapCandidate = null;
				cancelInteraction();
				application.stage.off("globalpointermove", onPointerMove);
				application.stage.off("pointerup", finishPointer);
				application.stage.off("pointerupoutside", finishPointer);
				application.stage.off("pointercancel", cancelPointer);
				for (const actor of actorStore.actors.values()) {
					detachActor(actor);
				}
			}),
		} satisfies PixiMainSceneDragController;
	},
);
