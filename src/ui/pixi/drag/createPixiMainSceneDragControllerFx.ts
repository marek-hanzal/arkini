import { Effect } from "effect";
import type { FederatedPointerEvent } from "pixi.js";

import type { GameEngine } from "~/bridge/game/GameEngine";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import { DropItemResultKindEnumSchema } from "~/bridge/tile/DropItemResultKindEnumSchema";
import type { runTileDropAtom } from "~/bridge/tile/runTileDropAtom";
import { readTileDropPreviewFx } from "~/bridge/tile/readTileDropPreviewFx";
import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import { readPixiTileActorCursorFx } from "~/ui/pixi/actor/readPixiTileActorCursorFx";
import { animatePixiActorToRetargetablePoseFx } from "~/ui/pixi/animation/animatePixiActorToRetargetablePoseFx";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import {
	restorePixiTileActorRemovalFeedbackFx,
	startPixiTileActorRemovalFeedbackFx,
} from "~/ui/pixi/animation/startPixiTileActorRemovalFeedbackFx";
import {
	flashPixiTileActorAckGlowFx,
	flashPixiTileActorFeedbackGlowFx,
} from "~/ui/pixi/animation/runPixiTileActorRunningGlowFx";
import type { PixiMainSceneActiveDrag } from "~/ui/pixi/drag/PixiMainSceneDragState";
import type { PixiCursorGrabMotion } from "~/ui/pixi/drag/PixiCursorGrabMotion";
import type { PixiMainSceneDragController } from "~/ui/pixi/drag/PixiMainSceneDragController";
import { beginPixiMainSceneDropFx } from "~/ui/pixi/drag/beginPixiMainSceneDropFx";
import { readPixiDragPointerOffset } from "~/ui/pixi/drag/readPixiDragPointerOffset";
import { setPixiDraggedActorPoseFx } from "~/ui/pixi/drag/setPixiDraggedActorPoseFx";
import { settlePixiMainSceneDraggedActorFx } from "~/ui/pixi/drag/settlePixiMainSceneDraggedActorFx";
import { updatePixiMainSceneMagneticFieldFx } from "~/ui/pixi/drag/updatePixiMainSceneMagneticFieldFx";
import type { PixiMainSceneDropPresentation } from "~/ui/pixi/drop/PixiMainSceneDropPresentation";
import type { PixiTileMagneticField } from "~/ui/pixi/magnet/PixiTileMagneticField";
import { readPixiTileEligibleAttractionActorIdsFx } from "~/ui/pixi/magnet/readPixiTileEligibleAttractionActorIdsFx";
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
		readonly dropPresentation: PixiMainSceneDropPresentation;
		readonly game: GameEngine;
		readonly magneticField: PixiTileMagneticField;
		readonly motion: PixiTileMotionRuntime;
		readonly onActivate: (
			item: TileActorItem,
			openDetail: boolean,
			origin: HTMLElement,
		) => void | PromiseLike<void>;
		readonly onAcceptedDrop: () => void;
		readonly onDrop: (command: runTileDropAtom.Command) => PromiseLike<runTileDropAtom.Result>;
		readonly readAckTint: () => number;
		readonly surface: PixiMainSceneSurface;
	}
}

const dragThreshold = 6;
const inventoryShortcutTravelOwnerPrefix = "inventory-shortcut-travel";

/**
 * Owns one main-scene pointer gesture from press through activation or drop release.
 *
 * Press-time source identity is immutable, while target occupancy and preview are refreshed at
 * release because canonical state may change under a held pointer. Geometry drives presentation
 * only; the bridge preview and command remain the authority for every drop outcome. A submitted
 * drop retains only its exact source actor and immediately releases the scene-wide gesture slot.
 * A click never waits for presentation ownership. Crossing the drag threshold either explicitly
 * hands an interruptible live pose to the gesture or cancels a presentation-retained,
 * non-draggable source without reinterpreting it as a click.
 */
export const createPixiMainSceneDragControllerFx = Effect.fn("createPixiMainSceneDragControllerFx")(
	function* ({
		actorStore,
		animator,
		application,
		cursorGrab,
		dropPresentation,
		game,
		magneticField,
		motion,
		onActivate,
		onAcceptedDrop,
		onDrop,
		readAckTint,
		surface,
	}: createPixiMainSceneDragControllerFx.Props) {
		let activeDrag: PixiMainSceneActiveDrag | null = null;
		let closed = false;
		let interactionBlocked = false;
		const pendingDropGenerations = new Set<number>();

		const readTargetFacts = (
			drag: PixiMainSceneActiveDrag,
			target: PixiSceneDropTarget | null,
		) => {
			const targetItem =
				target === null ? null : RendererRuntime.runSync(surface.readOccupantFx(target));
			let kind: readTileDropPreviewFx.Result["kind"] | null = null;
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
				game.reportCriticalFailure("game-presentation", cause);
			}
			return {
				kind,
				targetItem,
			};
		};

		const refreshEligibleAttractionActorIds = (drag: PixiMainSceneActiveDrag) => {
			try {
				drag.eligibleAttractionActorIds = RendererRuntime.runSync(
					readPixiTileEligibleAttractionActorIdsFx({
						game,
						sourceItem: drag.sourceItem,
						targetItems: Array.from(actorStore.actors.values(), ({ item }) => item),
					}),
				);
			} catch (cause) {
				drag.eligibleAttractionActorIds = new Set();
				game.reportCriticalFailure("game-presentation", cause);
			}
		};

		const previewTarget = (
			drag: PixiMainSceneActiveDrag,
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
			const facts = readTargetFacts(drag, target);
			drag.target = target;
			drag.targetItem = facts.targetItem;
			drag.previewKind = facts.kind;
			drag.actor.container.cursor = RendererRuntime.runSync(
				readPixiTileActorCursorFx({
					phase: "dragging",
					previewKind: facts.kind,
					running: drag.sourceItem.running,
				}),
			);
			RendererRuntime.runSync(surface.renderDropFeedbackFx(target, facts.kind));
		};

		const settleActor = (actor: PixiTileActor) => {
			RendererRuntime.runSync(
				settlePixiMainSceneDraggedActorFx({
					actor,
					animator,
					surface,
				}),
			);
		};

		const releaseDragPointer = (pointerId: number) => {
			try {
				application.app.canvas.releasePointerCapture(pointerId);
			} catch {
				// Capture may already be released by the browser.
			}
		};

		const cancelDrag = (drag: PixiMainSceneActiveDrag) => {
			activeDrag = null;
			releaseDragPointer(drag.pointerId);
			if (drag.mode !== "drag") return;
			RendererRuntime.runSync(surface.renderDropFeedbackFx(null, null));
			RendererRuntime.runSync(magneticField.resetFx);
			RendererRuntime.runSync(cursorGrab.finishFx(drag.actor));
			settleActor(drag.actor);
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

		const cancelInteraction = () => {
			if (activeDrag === null || activeDrag.phase === "submitting") return;
			cancelDrag(activeDrag);
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
			if (drag.mode !== "drag") {
				actor.container.cursor = "default";
				return;
			}
			RendererRuntime.runSync(surface.renderDropFeedbackFx(null, null));
			RendererRuntime.runSync(magneticField.resetFx);
			RendererRuntime.runSync(cursorGrab.finishFx(actor));
			actor.dragging = false;
			actor.container.cursor = "default";
		};

		const onPointerMove = (event: FederatedPointerEvent) => {
			const pointer = readPixiDragPointerOffset(event, activeDrag);
			if (pointer === null) return;
			let { drag } = pointer;
			const { offsetX, offsetY } = pointer;
			if (drag.phase === "pressed" && Math.hypot(offsetX, offsetY) < dragThreshold) return;
			if (drag.phase === "pressed" && drag.mode === "activation-only") {
				activeDrag = null;
				try {
					application.app.canvas.releasePointerCapture(drag.pointerId);
				} catch {
					// Capture may already be released by the browser.
				}
				return;
			}
			if (drag.phase === "pressed" && drag.mode === "motion-handoff") {
				const actorStillCanonicalBeforeHandoff =
					actorStore.actors.get(drag.sourceItem.id) === drag.actor &&
					actorStore.canonicalItems.has(drag.sourceItem.id) &&
					!drag.actor.container.destroyed;
				if (!actorStillCanonicalBeforeHandoff) {
					activeDrag = null;
					try {
						application.app.canvas.releasePointerCapture(drag.pointerId);
					} catch {
						// Capture may already be released by the browser.
					}
					return;
				}
				const handedOff = RendererRuntime.runSync(
					motion.beginInteractionHandoffFx(drag.sourceItem.id),
				);
				const remainingClaim = RendererRuntime.runSync(
					motion.readSnapshotFx,
				).interactionClaimByActorId.get(drag.sourceItem.id);
				const actorStillCanonicalAfterHandoff =
					actorStore.actors.get(drag.sourceItem.id) === drag.actor &&
					actorStore.canonicalItems.has(drag.sourceItem.id) &&
					!drag.actor.container.destroyed;
				if (
					!actorStillCanonicalAfterHandoff ||
					(!handedOff && remainingClaim !== undefined) ||
					remainingClaim === "activation-only"
				) {
					activeDrag = null;
					try {
						application.app.canvas.releasePointerCapture(drag.pointerId);
					} catch {
						// Capture may already be released by the browser.
					}
					return;
				}
				drag = {
					...drag,
					mode: "drag",
					phase: "pressed",
					startX: drag.actor.container.x - offsetX,
					startY: drag.actor.container.y - offsetY,
				};
				activeDrag = drag;
			}
			if (drag.phase === "pressed") {
				drag.phase = "dragging";
				refreshEligibleAttractionActorIds(drag);
				drag.actor.dragging = true;
				drag.actor.container.cursor = "grabbing";
				surface.transientActorLayer.addChild(drag.actor.container);
				drag.actor.container.zIndex = 10_000;
				RendererRuntime.runSync(animator.cancelChannelFx(drag.actor, "pose"));
				RendererRuntime.runSync(
					cursorGrab.startFx(drag.actor, {
						x: event.global.x,
						y: event.global.y,
					}),
				);
			}
			RendererRuntime.runSync(
				setPixiDraggedActorPoseFx({
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
			const pointerTravel = {
				x: event.global.x - drag.lastPointerX,
				y: event.global.y - drag.lastPointerY,
			};
			const pointerTravelMagnitude = Math.hypot(pointerTravel.x, pointerTravel.y);
			RendererRuntime.runSync(
				updatePixiMainSceneMagneticFieldFx({
					actor: drag.actor,
					eligibleAttractionActorIds: drag.eligibleAttractionActorIds,
					field: magneticField,
					previewKind: drag.previewKind,
					sourceDirection:
						pointerTravelMagnitude <= 0.001
							? null
							: {
									x: pointerTravel.x / pointerTravelMagnitude,
									y: pointerTravel.y / pointerTravelMagnitude,
								},
					sourceItem: drag.sourceItem,
					targetItem: drag.targetItem,
				}),
			);
			drag.lastPointerX = event.global.x;
			drag.lastPointerY = event.global.y;
		};

		const submitDrag = ({
			drag,
			shortcutReceiver,
			target,
		}: {
			readonly drag: PixiMainSceneActiveDrag;
			readonly shortcutReceiver?: {
				readonly actor: PixiTileActor;
				readonly pose: {
					readonly size: number;
					readonly x: number;
					readonly y: number;
				};
			};
			readonly target: PixiSceneDropTarget | null;
		}) => {
			RendererRuntime.runSync(cursorGrab.finishFx(drag.actor));
			RendererRuntime.runSync(magneticField.resetFx);
			RendererRuntime.runSync(surface.renderDropFeedbackFx(null, null));
			drag.actor.container.cursor = RendererRuntime.runSync(
				readPixiTileActorCursorFx({
					phase: "pending",
					previewKind: drag.previewKind,
					running: drag.sourceItem.running,
				}),
			);
			const drop = RendererRuntime.runSync(
				beginPixiMainSceneDropFx({
					dropPresentation,
					previewKind: drag.previewKind,
					sourceItem: drag.sourceItem,
					surface,
					target,
					targetItem: drag.targetItem,
				}),
			);
			const optimisticRemoval =
				drag.previewKind === DropItemResultKindEnumSchema.enum.StoreInventory ||
				(drag.previewKind === DropItemResultKindEnumSchema.enum.Stack &&
					drag.sourceItem.quantity === 1)
					? {
							actor: drag.actor,
							lifecycleGeneration: drag.actor.lifecycleIntentGeneration + 1,
							sourceActorId: drag.sourceItem.id,
						}
					: null;
			const optimisticInventoryReceiver =
				drag.previewKind === DropItemResultKindEnumSchema.enum.StoreInventory &&
				drag.targetItem !== null
					? (actorStore.actors.get(drag.targetItem.id) ?? null)
					: null;
			let removalStarted = false;
			let shortcutVisualComplete = shortcutReceiver === undefined;
			let queuedResult: runTileDropAtom.Result | null = null;
			let finalized = false;

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
					flashPixiTileActorFeedbackGlowFx({
						actor: optimisticInventoryReceiver,
						animator,
					}),
				);
			};

			const finalizeResult = (result: runTileDropAtom.Result) => {
				if (finalized || closed || !pendingDropGenerations.has(drop.generation)) {
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
				pendingDropGenerations.delete(drop.generation);
				try {
					RendererRuntime.runSync(
						dropPresentation.completeFx({
							generation: drop.generation,
							result,
						}),
					);
					if (
						result.kind === DropItemResultKindEnumSchema.enum.StoreInventory &&
						optimisticInventoryReceiver !== null &&
						result.inventory.itemId === optimisticInventoryReceiver.item.id &&
						actorStore.actors.get(result.inventory.itemId) ===
							optimisticInventoryReceiver
					) {
						// The exact surviving receiver already flashed. A replaced receiver keeps
						// the canonical cue and receives feedback during reconcile.
						RendererRuntime.runSync(dropPresentation.clearFeedbackFx(drop.generation));
					}
					const retainedSource =
						actorStore.actors.get(drag.sourceItem.id) === drag.actor
							? drag.actor
							: null;
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
							result.kind === DropItemResultKindEnumSchema.enum.StoreInventory ||
							(result.kind === DropItemResultKindEnumSchema.enum.Stack &&
								result.source.current === null);
						if (!removalAccepted && optimisticRemoval !== null && removalStarted) {
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
				if (closed || finalized || !pendingDropGenerations.delete(drop.generation)) return;
				finalized = true;
				RendererRuntime.runSync(dropPresentation.failFx(drop.generation));
				const retainedSource =
					actorStore.actors.get(drag.sourceItem.id) === drag.actor ? drag.actor : null;
				if (retainedSource !== null) {
					retainedSource.dragging = false;
					if (optimisticRemoval !== null && removalStarted) {
						restoreOptimisticRemoval(optimisticRemoval);
					}
					settleActor(retainedSource);
				}
				game.reportCriticalFailure("game-presentation", cause);
			};

			pendingDropGenerations.add(drop.generation);
			activeDrag = null;
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
						actor: drag.actor,
						animator,
						onCancel: finishTravel,
						onComplete: finishTravel,
						ownerKey: `${inventoryShortcutTravelOwnerPrefix}:${drag.actor.instanceId}`,
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
			try {
				application.app.canvas.releasePointerCapture(event.pointerId);
			} catch {
				// Capture may already be released by the browser.
			}
			if (drag.phase === "pressed") {
				activeDrag = null;
				const currentActor = actorStore.actors.get(drag.sourceItem.id);
				if (currentActor === undefined || currentActor.container.destroyed) return;
				try {
					RendererRuntime.runSync(
						flashPixiTileActorAckGlowFx({
							actor: currentActor,
							animator,
							tint: readAckTint(),
						}),
					);
				} catch (cause) {
					game.reportCriticalFailure("game-presentation", cause);
				}
				void Promise.resolve()
					.then(() => {
						if (closed) return;
						const currentItem = actorStore.actors.get(drag.sourceItem.id)?.item;
						if (currentItem === undefined) return;
						return onActivate(currentItem, drag.openDetail, application.app.canvas);
					})
					.catch((cause) => {
						if (closed) return;
						game.reportCriticalFailure("game-presentation", cause);
					});
				return;
			}
			const target = RendererRuntime.runSync(
				surface.readDropTargetFx(event.global.x, event.global.y),
			);
			// Canonical state may have changed beneath a held pointer while the target
			// coordinates stayed stable. Freeze fresh release-time preview facts.
			previewTarget(drag, target, true);
			drag.phase = "submitting";
			submitDrag({
				drag,
				target,
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
			cancelDrag(drag);
		};

		const storeDraggedItemInInventory = (event: KeyboardEvent) => {
			const drag = activeDrag;
			if (
				closed ||
				event.repeat ||
				event.key.toLowerCase() !== "i" ||
				event.altKey ||
				event.ctrlKey ||
				event.metaKey ||
				drag === null ||
				drag.mode !== "drag" ||
				drag.phase !== "dragging"
			) {
				return;
			}
			const inventoryActor = Array.from(actorStore.actors.values()).find(
				(actor) =>
					actor !== drag.actor &&
					!actor.container.destroyed &&
					actor.item.itemType === "inventory",
			);
			if (inventoryActor === undefined) return;
			const pose = RendererRuntime.runSync(surface.readActorPoseFx(inventoryActor.item));
			if (pose === null) return;
			const target = RendererRuntime.runSync(
				surface.readDropTargetFx(pose.x + pose.size / 2, pose.y + pose.size / 2),
			);
			if (target === null) return;
			const facts = readTargetFacts(drag, target);
			if (
				facts.kind !== DropItemResultKindEnumSchema.enum.StoreInventory ||
				facts.targetItem?.id !== inventoryActor.item.id
			) {
				return;
			}
			event.preventDefault();
			event.stopImmediatePropagation();
			try {
				application.app.canvas.releasePointerCapture(drag.pointerId);
			} catch {
				// Capture may already be released by the browser.
			}
			drag.target = target;
			drag.targetItem = facts.targetItem;
			drag.previewKind = facts.kind;
			drag.phase = "submitting";
			submitDrag({
				drag,
				shortcutReceiver: {
					actor: inventoryActor,
					pose,
				},
				target,
			});
		};

		application.stage.on("globalpointermove", onPointerMove);
		application.stage.on("pointerup", finishPointer);
		application.stage.on("pointerupoutside", finishPointer);
		application.stage.on("pointercancel", cancelPointer);
		const keyboardTarget = typeof window === "undefined" ? null : window;
		keyboardTarget?.addEventListener("keydown", storeDraggedItemInInventory, {
			capture: true,
		});

		return {
			attachActorFx: Effect.fn("PixiMainSceneDragController.attachActorFx")((actor) =>
				Effect.sync(() => {
					if (actor.onPointerDown !== null) {
						actor.container.off("pointerdown", actor.onPointerDown);
					}
					const onPointerDown = (event: FederatedPointerEvent) => {
						const motionSnapshot = RendererRuntime.runSync(motion.readSnapshotFx);
						const dropSnapshot = RendererRuntime.runSync(
							dropPresentation.readSnapshotFx,
						);
						const motionClaim = motionSnapshot.interactionClaimByActorId.get(
							actor.item.id,
						);
						const needsMotionHandoff = motionClaim === "handoff";
						const gestureMode =
							event.button === 2 || motionClaim === "activation-only"
								? "activation-only"
								: needsMotionHandoff
									? "motion-handoff"
									: "drag";
						if (
							closed ||
							interactionBlocked ||
							activeDrag !== null ||
							dropSnapshot.pendingActorIds.has(actor.item.id) ||
							!event.isPrimary ||
							(event.button !== 0 && event.button !== 2)
						) {
							return;
						}
						event.stopPropagation();
						if (gestureMode === "drag") {
							RendererRuntime.runSync(animator.cancelFx(actor.item.id));
						}
						try {
							application.app.canvas.setPointerCapture(event.pointerId);
						} catch {
							// Pixi still receives in-canvas pointer events without DOM capture.
						}
						activeDrag = {
							actor,
							eligibleAttractionActorIds: new Set(),
							openDetail: event.button === 2,
							pointerId: event.pointerId,
							pressX: event.global.x,
							pressY: event.global.y,
							lastPointerX: event.global.x,
							lastPointerY: event.global.y,
							previewKind: null,
							mode: gestureMode,
							phase: "pressed",
							sourceItem: actor.item,
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
			detachActorFx: Effect.fn("PixiMainSceneDragController.detachActorFx")((actor) =>
				Effect.sync(() => detachActor(actor)),
			),
			refreshPreviewFx: Effect.sync(() => {
				const drag = activeDrag;
				if (drag === null || drag.mode !== "drag" || drag.phase !== "dragging") return;
				previewTarget(
					drag,
					RendererRuntime.runSync(
						surface.readDropTargetFx(drag.lastPointerX, drag.lastPointerY),
					),
					true,
				);
				refreshEligibleAttractionActorIds(drag);
				RendererRuntime.runSync(
					updatePixiMainSceneMagneticFieldFx({
						actor: drag.actor,
						eligibleAttractionActorIds: drag.eligibleAttractionActorIds,
						field: magneticField,
						previewKind: drag.previewKind,
						sourceDirection: null,
						sourceItem: drag.sourceItem,
						targetItem: drag.targetItem,
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
				cancelInteraction();
				pendingDropGenerations.clear();
				application.stage.off("globalpointermove", onPointerMove);
				application.stage.off("pointerup", finishPointer);
				application.stage.off("pointerupoutside", finishPointer);
				application.stage.off("pointercancel", cancelPointer);
				keyboardTarget?.removeEventListener("keydown", storeDraggedItemInInventory, {
					capture: true,
				});
				for (const actor of actorStore.actors.values()) {
					detachActor(actor);
				}
			}),
		} satisfies PixiMainSceneDragController;
	},
);
