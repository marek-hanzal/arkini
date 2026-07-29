import { Effect } from "effect";
import type { FederatedPointerEvent } from "pixi.js";

import type { GameEngine } from "~/bridge/game/GameEngine";
import { removeDraggedCheatItemFx } from "~/bridge/cheat/removeDraggedCheatItemFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import { isSameTileActorLocation } from "~/bridge/tile/isSameTileActorLocation";
import { DropItemResultKindEnumSchema } from "~/bridge/tile/DropItemResultKindEnumSchema";
import { readTileDropPreviewFx } from "~/bridge/tile/readTileDropPreviewFx";
import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import { readPixiTileActorCursorFx } from "~/ui/pixi/actor/readPixiTileActorCursorFx";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { burstPixiTileActorAckParticlesFx } from "~/ui/pixi/animation/runPixiTileActorActivityParticlesFx";
import type { PixiMainSceneActiveDrag } from "~/ui/pixi/drag/PixiMainSceneDragState";
import type { PixiCursorGrabMotion } from "~/ui/pixi/drag/PixiCursorGrabMotion";
import type { PixiMainSceneDragController } from "~/ui/pixi/drag/PixiMainSceneDragController";
import { readPixiDragPointerOffset } from "~/ui/pixi/drag/readPixiDragPointerOffset";
import { setPixiDraggedActorPoseFx } from "~/ui/pixi/drag/setPixiDraggedActorPoseFx";
import { settlePixiMainSceneDraggedActorFx } from "~/ui/pixi/drag/settlePixiMainSceneDraggedActorFx";
import { updatePixiMainSceneMagneticFieldFx } from "~/ui/pixi/drag/updatePixiMainSceneMagneticFieldFx";
import type { PixiMainSceneDropSubmission } from "~/ui/pixi/drop/PixiMainSceneDropSubmission";
import type { PixiTileMagneticField } from "~/ui/pixi/magnet/PixiTileMagneticField";
import { readPixiTileAttractionActorIdFx } from "~/ui/pixi/magnet/readPixiTileAttractionActorIdFx";
import type { PixiTileMotionRuntime } from "~/ui/pixi/motion/PixiTileMotionRuntime";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import type {
	PixiMainSceneSurface,
	PixiMainSceneTargetFacts,
} from "~/ui/pixi/scene/PixiMainSceneSurface";
import type { PixiMainSceneActivationIntent } from "~/ui/pixi/scene/PixiMainSceneActivationIntent";

export namespace createPixiMainSceneDragControllerFx {
	export interface Props {
		readonly actorStore: PixiMainSceneActorStore;
		readonly animator: PixiActorAnimator;
		readonly application: PixiApplicationOwner;
		readonly cursorGrab: PixiCursorGrabMotion;
		readonly dropSubmission: PixiMainSceneDropSubmission;
		readonly game: GameEngine;
		readonly magneticField: PixiTileMagneticField;
		readonly motion: PixiTileMotionRuntime;
		readonly onActivate: (
			item: TileActorItem,
			intent: PixiMainSceneActivationIntent,
			origin: HTMLElement,
		) => void | PromiseLike<void>;
		readonly readAckTint: () => number;
		readonly surface: PixiMainSceneSurface;
	}
}

const dragThreshold = 6;

interface PixiDragPointerSample {
	readonly pointerId: number;
	readonly x: number;
	readonly y: number;
}

/**
 * Owns one main-scene pointer gesture from press through activation or drop release.
 *
 * Press-time identity anchors the gesture, while the release command rebases to the latest
 * canonical revision of that same actor at that same location. This lets an engine-committed
 * incoming stack update a held item without turning the eventual drop into a stale command.
 * Geometry drives presentation only; the bridge preview and command remain the authority for
 * every drop outcome. A submitted drop retains only its exact source actor and immediately
 * releases the scene-wide gesture slot.
 */
export const createPixiMainSceneDragControllerFx = Effect.fn("createPixiMainSceneDragControllerFx")(
	function* ({
		actorStore,
		animator,
		application,
		cursorGrab,
		dropSubmission,
		game,
		magneticField,
		motion,
		onActivate,
		readAckTint,
		surface,
	}: createPixiMainSceneDragControllerFx.Props) {
		let activeDrag: PixiMainSceneActiveDrag | null = null;
		let cancelScheduledPointerMove: (() => void) | null = null;
		let closed = false;
		let interactionBlocked = false;
		let pendingPointerSample: PixiDragPointerSample | null = null;
		let thresholdCrossed = false;

		const cancelPendingPointerMove = () => {
			pendingPointerSample = null;
			cancelScheduledPointerMove?.();
			cancelScheduledPointerMove = null;
		};

		const readCurrentSourceItem = (drag: PixiMainSceneActiveDrag) => {
			if (
				drag.actor.container.destroyed ||
				actorStore.actors.get(drag.sourceItem.id) !== drag.actor
			) {
				return null;
			}
			const canonical = actorStore.canonicalItems.get(drag.sourceItem.id);
			if (
				canonical === undefined ||
				!isSameTileActorLocation(canonical.location, drag.sourceItem.location)
			) {
				return null;
			}
			return {
				...drag.actor.item,
				location: canonical.location,
				revision: canonical.revision,
			} satisfies TileActorItem;
		};

		const readPreviewKind = (
			sourceItem: TileActorItem,
			targetFacts: PixiMainSceneTargetFacts,
		) =>
			RendererRuntime.runSync(
				readTileDropPreviewFx({
					game,
					sourceItemId: sourceItem.id,
					sourceLocation: sourceItem.location,
					sourceRevision: sourceItem.revision,
					target: targetFacts.commandTarget,
				}),
			).kind;

		const refreshEligibleAttractionActorIds = (
			drag: PixiMainSceneActiveDrag,
			sourceItem: TileActorItem,
			candidateActorIds: ReadonlyArray<string>,
			targetFacts: PixiMainSceneTargetFacts,
		) => {
			const activeCandidateActorIds = new Set(candidateActorIds);
			for (const actorId of drag.attractionEligibilityByActorId.keys()) {
				if (activeCandidateActorIds.has(actorId)) continue;
				drag.attractionEligibilityByActorId.delete(actorId);
			}
			const eligibleActorIds = new Set<string>();
			for (const actorId of candidateActorIds) {
				if (actorId === sourceItem.id) continue;
				const actor = actorStore.actors.get(actorId);
				const canonical = actorStore.canonicalItems.get(actorId);
				if (actor === undefined || actor.container.destroyed) {
					drag.attractionEligibilityByActorId.delete(actorId);
					continue;
				}
				const targetItem = {
					...actor.item,
					location: canonical?.location ?? actor.item.location,
					revision: canonical?.revision ?? actor.item.revision,
				} satisfies TileActorItem;
				const cached = drag.attractionEligibilityByActorId.get(actorId);
				if (
					cached !== undefined &&
					cached.source.id === sourceItem.id &&
					cached.source.revision === sourceItem.revision &&
					isSameTileActorLocation(cached.source.location, sourceItem.location) &&
					cached.target.id === targetItem.id &&
					cached.target.revision === targetItem.revision &&
					isSameTileActorLocation(cached.target.location, targetItem.location)
				) {
					if (cached.eligible) eligibleActorIds.add(actorId);
					continue;
				}
				const previewKind =
					targetFacts.occupant?.id === targetItem.id &&
					targetFacts.occupant.revision === targetItem.revision &&
					isSameTileActorLocation(targetFacts.occupant.location, targetItem.location)
						? drag.previewKind
						: RendererRuntime.runSync(
								readTileDropPreviewFx({
									game,
									sourceItemId: sourceItem.id,
									sourceLocation: sourceItem.location,
									sourceRevision: sourceItem.revision,
									target: {
										kind: "slot",
										location: targetItem.location,
										occupant: {
											itemId: targetItem.id,
											revision: targetItem.revision,
										},
									},
								}),
							).kind;
				if (previewKind === null) continue;
				const eligible =
					RendererRuntime.runSync(
						readPixiTileAttractionActorIdFx({
							previewKind,
							targetItem,
						}),
					) !== null;
				drag.attractionEligibilityByActorId.set(actorId, {
					eligible,
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
				});
				if (eligible) eligibleActorIds.add(actorId);
			}
			drag.eligibleAttractionActorIds = eligibleActorIds;
		};

		const previewTarget = (
			drag: PixiMainSceneActiveDrag,
			targetFacts: PixiMainSceneTargetFacts,
			force = false,
			releaseSourceItem?: TileActorItem,
		) => {
			const sourceItem = releaseSourceItem ?? readCurrentSourceItem(drag);
			if (sourceItem === null) {
				drag.target = targetFacts.target;
				drag.targetKey = targetFacts.stableKey;
				drag.targetItem = null;
				drag.previewKind = null;
				drag.previewSource = null;
				RendererRuntime.runSync(surface.renderDropFeedbackFx(null, null));
				return null;
			}
			if (
				!force &&
				drag.targetKey === targetFacts.stableKey &&
				drag.previewSource !== null &&
				drag.previewSource.id === sourceItem.id &&
				drag.previewSource.revision === sourceItem.revision &&
				isSameTileActorLocation(drag.previewSource.location, sourceItem.location)
			) {
				return sourceItem;
			}
			const kind = readPreviewKind(sourceItem, targetFacts);
			drag.target = targetFacts.target;
			drag.targetKey = targetFacts.stableKey;
			drag.targetItem = targetFacts.occupant;
			drag.previewKind = kind;
			drag.previewSource = {
				id: sourceItem.id,
				location: sourceItem.location,
				revision: sourceItem.revision,
			};
			drag.actor.container.cursor = RendererRuntime.runSync(
				readPixiTileActorCursorFx({
					dragPolicy: "main-target-presence",
					hasDropTarget: targetFacts.target !== null,
					phase: "dragging",
					previewKind: kind,
					running: sourceItem.running,
				}),
			);
			RendererRuntime.runSync(surface.renderDropFeedbackFx(targetFacts.target, kind));
			return sourceItem;
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
			cancelPendingPointerMove();
			activeDrag = null;
			releaseDragPointer(drag.pointerId);
			if (drag.mode !== "drag") return;
			RendererRuntime.runSync(surface.renderDropFeedbackFx(null, null));
			RendererRuntime.runSync(magneticField.resetFx);
			RendererRuntime.runSync(cursorGrab.finishFx(drag.actor));
			settleActor(drag.actor);
		};

		const cancelInteraction = () => {
			if (activeDrag === null) return;
			cancelDrag(activeDrag);
		};

		const detachActor = (actor: PixiTileActor) => {
			if (actor.onPointerDown !== null) {
				actor.container.off("pointerdown", actor.onPointerDown);
				actor.onPointerDown = null;
			}
			if (activeDrag?.actor !== actor) return;
			cancelPendingPointerMove();
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

		const applyPointerMove = (sample: PixiDragPointerSample) => {
			const event = {
				global: {
					x: sample.x,
					y: sample.y,
				},
				pointerId: sample.pointerId,
			};
			const pointer = readPixiDragPointerOffset(event, activeDrag);
			if (pointer === null) return;
			let { drag } = pointer;
			const { offsetX, offsetY } = pointer;
			let cursorGrabPointer = {
				x: drag.pressX,
				y: drag.pressY,
			};
			if (drag.phase === "pressed" && !thresholdCrossed) return;
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
				// The actor kept moving after the press. Its rebased pose stays at the live handoff
				// frame, so the grab spring must meet the current pointer rather than the old press.
				cursorGrabPointer = {
					x: sample.x,
					y: sample.y,
				};
			}
			if (drag.phase === "pressed") {
				drag.phase = "dragging";
				const sourceItem = readCurrentSourceItem(drag);
				if (sourceItem === null) {
					cancelDrag(drag);
					return;
				}
				drag.actor.dragging = true;
				drag.actor.container.cursor = "grabbing";
				surface.transientActorLayer.addChild(drag.actor.container);
				drag.actor.container.zIndex = 10_000;
				RendererRuntime.runSync(animator.cancelChannelFx(drag.actor, "pose"));
				RendererRuntime.runSync(cursorGrab.startFx(drag.actor, cursorGrabPointer));
			}
			RendererRuntime.runSync(
				setPixiDraggedActorPoseFx({
					actor: drag.actor,
					animator,
					x: drag.startX + offsetX,
					y: drag.startY + offsetY,
				}),
			);
			const targetFacts = RendererRuntime.runSync(
				surface.readTargetFactsFx(sample.x, sample.y),
			);
			const sourceItem = previewTarget(drag, targetFacts);
			if (sourceItem === null) {
				cancelDrag(drag);
				return;
			}
			const pointerTravel = {
				x: sample.x - drag.lastPointerX,
				y: sample.y - drag.lastPointerY,
			};
			const pointerTravelMagnitude = Math.hypot(pointerTravel.x, pointerTravel.y);
			const sourceWidth = drag.actor.size * drag.actor.container.scale.x;
			const sourceHeight = drag.actor.size * drag.actor.container.scale.y;
			const sourceX =
				drag.actor.container.x -
				drag.actor.container.pivot.x * drag.actor.container.scale.x;
			const sourceY =
				drag.actor.container.y -
				drag.actor.container.pivot.y * drag.actor.container.scale.y;
			const localCandidateActorIds = RendererRuntime.runSync(
				surface.readLocalActorIdsFx({
					excludeActorId: sourceItem.id,
					height: sourceHeight,
					paddingRatio: 1.5,
					width: sourceWidth,
					x: sourceX,
					y: sourceY,
				}),
			);
			const candidateActorIds = Array.from(
				new Set([
					...localCandidateActorIds,
					...RendererRuntime.runSync(magneticField.readActiveSourceActorIdsFx),
					...(targetFacts.occupant === null
						? []
						: [
								targetFacts.occupant.id,
							]),
				]),
			).filter((actorId) => actorId !== sourceItem.id);
			refreshEligibleAttractionActorIds(drag, sourceItem, candidateActorIds, targetFacts);
			RendererRuntime.runSync(
				updatePixiMainSceneMagneticFieldFx({
					actor: drag.actor,
					candidateActorIds,
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
					sourceItem,
					targetItem: drag.targetItem,
				}),
			);
			RendererRuntime.runSync(magneticField.flushFx);
			drag.lastPointerX = sample.x;
			drag.lastPointerY = sample.y;
		};

		const recordThresholdCrossing = (sample: PixiDragPointerSample) => {
			const drag = activeDrag;
			if (
				thresholdCrossed ||
				drag === null ||
				drag.pointerId !== sample.pointerId ||
				drag.phase !== "pressed"
			) {
				return;
			}
			thresholdCrossed =
				Math.hypot(sample.x - drag.pressX, sample.y - drag.pressY) >= dragThreshold;
		};

		const recoverPointerFailure = (cause: unknown, fallbackDrag?: PixiMainSceneActiveDrag) => {
			const drag = activeDrag ?? fallbackDrag ?? null;
			if (drag !== null) {
				try {
					cancelDrag(drag);
				} catch {
					cancelPendingPointerMove();
					activeDrag = null;
					drag.actor.dragging = false;
					drag.actor.container.cursor = "default";
				}
			} else {
				cancelPendingPointerMove();
			}
			game.reportCriticalFailure("game-presentation", cause);
		};

		const applyPointerMoveSafely = (sample: PixiDragPointerSample) => {
			try {
				applyPointerMove(sample);
			} catch (cause) {
				recoverPointerFailure(cause);
			}
		};

		const flushPointerMove = (sample?: PixiDragPointerSample) => {
			const latest = sample ?? pendingPointerSample;
			if (latest !== null) recordThresholdCrossing(latest);
			cancelPendingPointerMove();
			if (latest !== null) applyPointerMoveSafely(latest);
		};

		const requestPointerFrame = () => {
			if (cancelScheduledPointerMove !== null) return;
			cancelScheduledPointerMove = RendererRuntime.runSync(
				application.frames.scheduleFx(() => {
					cancelScheduledPointerMove = null;
					const latest = pendingPointerSample;
					pendingPointerSample = null;
					if (latest !== null) applyPointerMoveSafely(latest);
				}),
			);
		};

		const onPointerMove = (event: FederatedPointerEvent) => {
			const drag = activeDrag;
			if (drag === null || event.pointerId !== drag.pointerId) return;
			const sample = {
				pointerId: event.pointerId,
				x: event.global.x,
				y: event.global.y,
			};
			recordThresholdCrossing(sample);
			pendingPointerSample = sample;
			requestPointerFrame();
		};

		const finishPointer = (event: FederatedPointerEvent) => {
			const pendingDrag = activeDrag;
			if (pendingDrag === null || event.pointerId !== pendingDrag.pointerId) {
				return;
			}
			flushPointerMove({
				pointerId: event.pointerId,
				x: event.global.x,
				y: event.global.y,
			});
			const drag = activeDrag;
			if (drag === null || event.pointerId !== drag.pointerId) return;
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
						burstPixiTileActorAckParticlesFx({
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
						return onActivate(
							currentItem,
							drag.activationIntent,
							application.app.canvas,
						);
					})
					.catch((cause) => {
						if (closed) return;
						game.reportCriticalFailure("game-presentation", cause);
					});
				return;
			}
			try {
				const targetFacts = RendererRuntime.runSync(
					surface.readTargetFactsFx(event.global.x, event.global.y),
				);
				// Canonical state may have changed beneath a held pointer while the target
				// coordinates stayed stable. Freeze fresh release-time preview facts.
				const sourceItem = previewTarget(drag, targetFacts, true);
				if (sourceItem === null) {
					cancelDrag(drag);
					return;
				}
				activeDrag = null;
				RendererRuntime.runSync(
					dropSubmission.submitFx({
						actor: drag.actor,
						commandTarget: targetFacts.commandTarget,
						previewKind: drag.previewKind,
						sourceItem,
						targetItem: drag.targetItem,
					}),
				);
			} catch (cause) {
				recoverPointerFailure(cause, drag);
			}
		};

		const cancelPointer = (event: FederatedPointerEvent) => {
			const drag = activeDrag;
			if (drag === null || event.pointerId !== drag.pointerId) {
				return;
			}
			cancelDrag(drag);
		};

		const storeDraggedItemInInventory = (event: KeyboardEvent) => {
			if (
				closed ||
				event.repeat ||
				event.key.toLowerCase() !== "i" ||
				event.altKey ||
				event.ctrlKey ||
				event.metaKey
			) {
				return;
			}
			flushPointerMove();
			const drag = activeDrag;
			if (drag === null || drag.mode !== "drag" || drag.phase !== "dragging") {
				return;
			}
			event.preventDefault();
			event.stopImmediatePropagation();
			const inventoryActor = Array.from(actorStore.actors.values()).find(
				(actor) =>
					actor !== drag.actor &&
					!actor.container.destroyed &&
					actor.item.itemType === "inventory",
			);
			if (inventoryActor === undefined) return;
			const pose = RendererRuntime.runSync(surface.readActorPoseFx(inventoryActor.item));
			if (pose === null) return;
			const targetFacts = RendererRuntime.runSync(
				surface.readTargetFactsFx(pose.x + pose.size / 2, pose.y + pose.size / 2),
			);
			if (targetFacts.target === null) return;
			const sourceItem = readCurrentSourceItem(drag);
			if (sourceItem === null) return;
			let kind: readTileDropPreviewFx.Result["kind"];
			try {
				kind = readPreviewKind(sourceItem, targetFacts);
			} catch (cause) {
				recoverPointerFailure(cause);
				return;
			}
			if (
				kind !== DropItemResultKindEnumSchema.enum.StoreInventory ||
				targetFacts.occupant?.id !== inventoryActor.item.id
			) {
				return;
			}
			try {
				application.app.canvas.releasePointerCapture(drag.pointerId);
			} catch {
				// Capture may already be released by the browser.
			}
			drag.target = targetFacts.target;
			drag.targetKey = targetFacts.stableKey;
			drag.targetItem = targetFacts.occupant;
			drag.previewKind = kind;
			cancelPendingPointerMove();
			activeDrag = null;
			RendererRuntime.runSync(
				dropSubmission.submitFx({
					actor: drag.actor,
					commandTarget: targetFacts.commandTarget,
					previewKind: drag.previewKind,
					sourceItem,
					shortcutReceiver: {
						actor: inventoryActor,
						pose,
					},
					targetItem: drag.targetItem,
				}),
			);
		};

		const removeDraggedItem = (event: KeyboardEvent) => {
			if (
				closed ||
				event.repeat ||
				event.key.toLowerCase() !== "d" ||
				event.altKey ||
				event.ctrlKey ||
				event.metaKey ||
				!game.getSnapshot().cheats.enabled
			) {
				return;
			}
			flushPointerMove();
			const drag = activeDrag;
			if (drag === null || drag.mode !== "drag" || drag.phase !== "dragging") {
				return;
			}
			const sourceItem = readCurrentSourceItem(drag);
			if (sourceItem === null) return;
			event.preventDefault();
			event.stopImmediatePropagation();
			cancelDrag(drag);
			void RendererRuntime.runPromise(
				removeDraggedCheatItemFx({
					game,
					itemId: sourceItem.id,
					revision: sourceItem.revision,
				}),
			).catch((cause) => {
				if (closed) return;
				game.reportCriticalFailure("game-presentation", cause);
			});
		};

		const unsubscribeSourceMembership = yield* magneticField.subscribeSourceMembershipFx(
			(sourceKind) => {
				const drag = activeDrag;
				if (
					sourceKind !== "motion" ||
					drag === null ||
					drag.mode !== "drag" ||
					drag.phase !== "dragging"
				) {
					return;
				}
				if (pendingPointerSample === null) {
					pendingPointerSample = {
						pointerId: drag.pointerId,
						x: drag.lastPointerX,
						y: drag.lastPointerY,
					};
				}
				requestPointerFrame();
			},
		);

		application.stage.on("globalpointermove", onPointerMove);
		application.stage.on("pointerup", finishPointer);
		application.stage.on("pointerupoutside", finishPointer);
		application.stage.on("pointercancel", cancelPointer);
		const keyboardTarget = typeof window === "undefined" ? null : window;
		keyboardTarget?.addEventListener("keydown", storeDraggedItemInInventory, {
			capture: true,
		});
		keyboardTarget?.addEventListener("keydown", removeDraggedItem, {
			capture: true,
		});

		return {
			attachActorFx: Effect.fn("PixiMainSceneDragController.attachActorFx")((actor) =>
				Effect.gen(function* () {
					if (actor.onPointerDown !== null) {
						actor.container.off("pointerdown", actor.onPointerDown);
					}
					actor.container.eventMode = "static";
					actor.container.cursor = yield* readPixiTileActorCursorFx({
						phase: "idle",
						previewKind: null,
						running: actor.item.running,
					});
					const onPointerDown = (event: FederatedPointerEvent) => {
						const motionSnapshot = RendererRuntime.runSync(motion.readSnapshotFx);
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
							RendererRuntime.runSync(
								dropSubmission.isPendingActorFx(actor.item.id),
							) ||
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
							activationIntent:
								event.button === 2
									? "detail"
									: event.shiftKey
										? "split-stack"
										: "primary",
							actor,
							attractionEligibilityByActorId: new Map(),
							eligibleAttractionActorIds: new Set(),
							pointerId: event.pointerId,
							pressX: event.global.x,
							pressY: event.global.y,
							lastPointerX: event.global.x,
							lastPointerY: event.global.y,
							previewKind: null,
							previewSource: null,
							mode: gestureMode,
							phase: "pressed",
							sourceItem: actor.item,
							startX: actor.container.x,
							startY: actor.container.y,
							target: null,
							targetKey: "unresolved",
							targetItem: null,
						};
						thresholdCrossed = false;
					};
					actor.onPointerDown = onPointerDown;
					actor.container.on("pointerdown", onPointerDown);
				}),
			),
			cancelInteractionFx: Effect.sync(() => cancelInteraction()),
			detachActorFx: Effect.fn("PixiMainSceneDragController.detachActorFx")((actor) =>
				Effect.sync(() => detachActor(actor)),
			),
			requestRefreshFx: Effect.sync(() => {
				const drag = activeDrag;
				if (drag === null || drag.mode !== "drag" || drag.phase !== "dragging") return;
				if (pendingPointerSample === null) {
					pendingPointerSample = {
						pointerId: drag.pointerId,
						x: drag.lastPointerX,
						y: drag.lastPointerY,
					};
				}
				requestPointerFrame();
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
				unsubscribeSourceMembership();
				cancelInteraction();
				application.stage.off("globalpointermove", onPointerMove);
				application.stage.off("pointerup", finishPointer);
				application.stage.off("pointerupoutside", finishPointer);
				application.stage.off("pointercancel", cancelPointer);
				keyboardTarget?.removeEventListener("keydown", storeDraggedItemInInventory, {
					capture: true,
				});
				keyboardTarget?.removeEventListener("keydown", removeDraggedItem, {
					capture: true,
				});
				for (const actor of actorStore.actors.values()) {
					detachActor(actor);
				}
			}),
		} satisfies PixiMainSceneDragController;
	},
);
