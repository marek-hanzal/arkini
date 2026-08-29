import { Effect } from "effect";
import type { FederatedPointerEvent } from "pixi.js";

import type { GameEngine } from "~/renderer/game/GameEngine";
import { removeCheatItemFx as removeEngineCheatItemFx } from "~/engine/cheat/write/removeCheatItemFx";
import { RendererRuntime } from "~/application-runtime/RendererRuntime";
import type { TileActorItem } from "~/ui/pixi/actor/TileActorItem";
import { PointerDragThreshold } from "~/ui/drag/PointerDragThreshold";
import type { MainActorStore } from "~/ui/pixi/actor/MainActorStore";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import { readActorCursorFn } from "~/ui/pixi/actor/fn/readActorCursorFn";
import type { ActorAnimator } from "~/ui/pixi/animation/ActorAnimator";
import { burstFeedbackParticlesFx } from "~/ui/pixi/animation/burstFeedbackParticlesFx";
import type { ActiveDrag } from "~/ui/pixi/drag/ActiveDrag";
import type { CursorGrabMotion } from "~/ui/pixi/drag/CursorGrabMotion";
import type { MainDragController } from "~/ui/pixi/drag/MainDragController";
import { createDragPreviewFx } from "~/ui/pixi/drag/createDragPreviewFx";
import { createPointerSamplerFx } from "~/ui/pixi/drag/createPointerSamplerFx";
import { makePointerOffsetReaderFx } from "~/ui/pixi/drag/makePointerOffsetReaderFx";
import { readInventoryShortcutFx } from "~/ui/pixi/drag/readInventoryShortcutFx";
import { setDraggedActorPoseFx } from "~/ui/pixi/drag/setDraggedActorPoseFx";
import { settleDraggedActorFx } from "~/ui/pixi/drag/settleDraggedActorFx";
import { updateMagneticFieldFx } from "~/ui/pixi/drag/updateMagneticFieldFx";
import type { DropSubmission } from "~/ui/pixi/drop/DropSubmission";
import type { MagneticField } from "~/ui/pixi/magnet/MagneticField";
import type { MotionRuntime } from "~/ui/pixi/motion/MotionRuntime";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import type { MainSurface } from "~/ui/pixi/scene/MainSurface";
import type { MainActivationIntent } from "~/ui/pixi/scene/MainActivationIntent";

export namespace createMainDragControllerFx {
	export interface Props {
		readonly actorStore: MainActorStore;
		readonly animator: ActorAnimator;
		readonly application: PixiApplicationOwner;
		readonly cursorGrab: CursorGrabMotion;
		readonly dropSubmission: DropSubmission;
		readonly game: GameEngine;
		readonly magneticField: MagneticField;
		readonly motion: MotionRuntime;
		readonly onActivate: (
			item: TileActorItem,
			intent: MainActivationIntent,
			origin: HTMLElement,
		) => void | PromiseLike<void>;
		readonly readAckTint: () => number;
		readonly surface: MainSurface;
	}
}

const removeCheatItemFx = Effect.fn("createMainDragControllerFx.removeCheatItemFx")(
	({ game, sourceItem }: { readonly game: GameEngine; readonly sourceItem: TileActorItem }) =>
		game
			.runFx(
				removeEngineCheatItemFx({
					itemId: sourceItem.id,
					revision: sourceItem.revision,
				}),
			)
			.pipe(
				Effect.as(true),
				Effect.catch(() => Effect.succeed(false)),
			),
);

/**
 * Owns one main-scene pointer gesture from press through activation or drop release.
 *
 * Press-time identity anchors the gesture, while the release command rebases to the latest
 * canonical revision of that same actor at that same location. This lets an engine-committed
 * incoming stack update a held item without turning the eventual drop into a stale command.
 * Geometry drives presentation only; the engine preview and command remain the authority for
 * every drop outcome. A submitted drop retains only its exact source actor and immediately
 * releases the scene-wide gesture slot.
 */
export const createMainDragControllerFx = Effect.fn("createMainDragControllerFx")(function* ({
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
}: createMainDragControllerFx.Props) {
	let activeDrag: ActiveDrag | null = null;
	let closed = false;
	let interactionBlocked = false;
	let thresholdCrossed = false;
	const readPointerOffset = yield* makePointerOffsetReaderFx();

	const dragPreview = yield* createDragPreviewFx({
		actorStore,
		game,
		surface,
	});
	const pointerSampler = yield* createPointerSamplerFx({
		frames: application.frames,
		onApply: (sample) => applyPointerMoveSafely(sample),
	});

	const settleActor = (actor: PixiTileActor) => {
		RendererRuntime.runSync(
			settleDraggedActorFx({
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

	const cancelDrag = (drag: ActiveDrag) => {
		RendererRuntime.runSync(pointerSampler.cancelFx);
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
		RendererRuntime.runSync(pointerSampler.cancelFx);
		const drag = activeDrag;
		activeDrag = null;
		releaseDragPointer(drag.pointerId);
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

	const applyPointerMove = (sample: createPointerSamplerFx.Sample) => {
		const event = {
			global: {
				x: sample.x,
				y: sample.y,
			},
			pointerId: sample.pointerId,
		};
		const pointer = readPointerOffset(event, activeDrag);
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
			releaseDragPointer(drag.pointerId);
			return;
		}
		if (drag.phase === "pressed" && drag.mode === "motion-handoff") {
			const actorStillCanonicalBeforeHandoff =
				actorStore.actors.get(drag.sourceItem.id) === drag.actor &&
				actorStore.canonicalItems.has(drag.sourceItem.id) &&
				!drag.actor.container.destroyed;
			if (!actorStillCanonicalBeforeHandoff) {
				activeDrag = null;
				releaseDragPointer(drag.pointerId);
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
				releaseDragPointer(drag.pointerId);
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
			const sourceItem = RendererRuntime.runSync(dragPreview.readCurrentSourceFx(drag));
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
			setDraggedActorPoseFx({
				actor: drag.actor,
				animator,
				x: drag.startX + offsetX,
				y: drag.startY + offsetY,
			}),
		);
		const targetFacts = RendererRuntime.runSync(surface.readTargetFactsFx(sample.x, sample.y));
		const sourceItem = RendererRuntime.runSync(
			dragPreview.previewTargetFx({
				drag,
				targetFacts,
			}),
		);
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
			drag.actor.container.x - drag.actor.container.pivot.x * drag.actor.container.scale.x;
		const sourceY =
			drag.actor.container.y - drag.actor.container.pivot.y * drag.actor.container.scale.y;
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
		RendererRuntime.runSync(
			dragPreview.refreshAttractionEligibilityFx({
				candidateActorIds,
				drag,
				sourceItem,
				targetFacts,
			}),
		);
		RendererRuntime.runSync(
			updateMagneticFieldFx({
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

	const recordThresholdCrossing = (sample: createPointerSamplerFx.Sample) => {
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
			Math.hypot(sample.x - drag.pressX, sample.y - drag.pressY) >= PointerDragThreshold;
	};

	const recoverPointerFailure = (cause: unknown, fallbackDrag?: ActiveDrag) => {
		const drag = activeDrag ?? fallbackDrag ?? null;
		if (drag !== null) {
			try {
				cancelDrag(drag);
			} catch {
				RendererRuntime.runSync(pointerSampler.cancelFx);
				activeDrag = null;
				drag.actor.dragging = false;
				drag.actor.container.cursor = "default";
			}
		} else {
			RendererRuntime.runSync(pointerSampler.cancelFx);
		}
		game.reportCriticalFailure("game-presentation", cause);
	};

	const applyPointerMoveSafely = (sample: createPointerSamplerFx.Sample) => {
		try {
			applyPointerMove(sample);
		} catch (cause) {
			recoverPointerFailure(cause);
		}
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
		RendererRuntime.runSync(pointerSampler.scheduleFx(sample));
	};

	const finishPointer = (event: FederatedPointerEvent) => {
		const pendingDrag = activeDrag;
		if (pendingDrag === null || event.pointerId !== pendingDrag.pointerId) {
			return;
		}
		const releaseSample = {
			pointerId: event.pointerId,
			x: event.global.x,
			y: event.global.y,
		};
		recordThresholdCrossing(releaseSample);
		RendererRuntime.runSync(pointerSampler.flushFx(releaseSample));
		const drag = activeDrag;
		if (drag === null || event.pointerId !== drag.pointerId) return;
		releaseDragPointer(event.pointerId);
		if (drag.phase === "pressed") {
			activeDrag = null;
			const currentActor = actorStore.actors.get(drag.sourceItem.id);
			if (currentActor === undefined || currentActor.container.destroyed) return;
			try {
				RendererRuntime.runSync(
					burstFeedbackParticlesFx({
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
					return onActivate(currentItem, drag.activationIntent, application.app.canvas);
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
			const sourceItem = RendererRuntime.runSync(
				dragPreview.previewTargetFx({
					drag,
					force: true,
					targetFacts,
				}),
			);
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
		RendererRuntime.runSync(pointerSampler.flushFx());
		const drag = activeDrag;
		if (drag === null || drag.mode !== "drag" || drag.phase !== "dragging") {
			return;
		}
		event.preventDefault();
		event.stopImmediatePropagation();
		let submission: readInventoryShortcutFx.Result;
		try {
			submission = RendererRuntime.runSync(
				readInventoryShortcutFx({
					actorStore,
					drag,
					preview: dragPreview,
					surface,
				}),
			);
		} catch (cause) {
			recoverPointerFailure(cause);
			return;
		}
		if (submission === null) return;
		releaseDragPointer(drag.pointerId);
		RendererRuntime.runSync(pointerSampler.cancelFx);
		activeDrag = null;
		RendererRuntime.runSync(dropSubmission.submitFx(submission));
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
		RendererRuntime.runSync(pointerSampler.flushFx());
		const drag = activeDrag;
		if (drag === null || drag.mode !== "drag" || drag.phase !== "dragging") {
			return;
		}
		const sourceItem = RendererRuntime.runSync(dragPreview.readCurrentSourceFx(drag));
		if (sourceItem === null) return;
		event.preventDefault();
		event.stopImmediatePropagation();
		cancelDrag(drag);
		void RendererRuntime.runPromise(
			removeCheatItemFx({
				game,
				sourceItem,
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
			RendererRuntime.runSync(
				pointerSampler.scheduleFallbackFx({
					pointerId: drag.pointerId,
					x: drag.lastPointerX,
					y: drag.lastPointerY,
				}),
			);
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
		attachActorFx: Effect.fn("MainDragController.attachActorFx")((actor) =>
			Effect.gen(function* () {
				if (actor.onPointerDown !== null) {
					actor.container.off("pointerdown", actor.onPointerDown);
				}
				actor.container.eventMode = "static";
				actor.container.cursor = readActorCursorFn({
					phase: "idle",
					previewKind: null,
					running: actor.item.running,
				});
				const onPointerDown = (event: FederatedPointerEvent) => {
					const motionSnapshot = RendererRuntime.runSync(motion.readSnapshotFx);
					const motionClaim = motionSnapshot.interactionClaimByActorId.get(actor.item.id);
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
						RendererRuntime.runSync(dropSubmission.isPendingActorFx(actor.item.id)) ||
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
									: event.ctrlKey && !event.altKey && !event.metaKey
										? "fill-default-line-queue"
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
		detachActorFx: Effect.fn("MainDragController.detachActorFx")((actor) =>
			Effect.sync(() => detachActor(actor)),
		),
		requestRefreshFx: Effect.gen(function* () {
			const drag = activeDrag;
			if (drag === null || drag.mode !== "drag" || drag.phase !== "dragging") return;
			yield* pointerSampler.scheduleFallbackFx({
				pointerId: drag.pointerId,
				x: drag.lastPointerX,
				y: drag.lastPointerY,
			});
		}),
		setInteractionBlockedFx: Effect.fn("MainDragController.setInteractionBlockedFx")(
			(blocked) =>
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
			yield* pointerSampler.cancelFx;
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
	} satisfies MainDragController;
});
