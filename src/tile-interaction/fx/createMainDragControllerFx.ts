import { Effect } from "effect";
import { match } from "ts-pattern";
import type { FederatedPointerEvent } from "pixi.js";

import type { GameEngine } from "~/playable-game/type/GameEngine";
import { removeCheatItemFx as removeEngineCheatItemFx } from "~/game-cheat/fx/removeCheatItemFx";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import type { MainActorStore } from "~/tile-rendering/service/MainActorStore";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import { readActorCursorFn } from "~/tile-rendering/fn/readActorCursorFn";
import type { ActorAnimator } from "~/tile-rendering/service/ActorAnimator";
import type { CursorGrabMotion } from "~/tile-interaction/fx/createCursorGrabMotionFx";
import { createMainDragPreviewFx } from "~/tile-interaction/fx/createMainDragPreviewFx";
import { createPointerFrameSamplerFx } from "~/tile-interaction/fx/createPointerFrameSamplerFx";
import { readPointerOffsetFn } from "~/tile-interaction/fn/readPointerOffsetFn";
import { setDraggedActorPoseFx } from "~/tile-interaction/fx/setDraggedActorPoseFx";
import { settleDraggedActorFx } from "~/tile-interaction/fx/settleDraggedActorFx";
import type { DropSubmission } from "~/tile-interaction/fx/createDropSubmissionFx";
import type { PixiApplicationOwner } from "~/tile-rendering/service/PixiApplicationOwner";
import type {
	MainInteractionSurface,
	MainInteractionTargetFacts,
} from "~/tile-interaction/type/MainInteractionSurface";
import type { MainActivationIntent } from "~/tile-interaction/type/MainActivationIntent";
import type { DragOriginGhosts } from "~/tile-interaction/type/DragOriginGhosts";

export interface MainDragController {
	readonly attachActorFx: (actor: PixiTileActor) => Effect.Effect<void, never, never>;
	readonly cancelInteractionFx: Effect.Effect<void, never, never>;
	readonly clearHoverFx: (actor: PixiTileActor) => Effect.Effect<void, never, never>;
	readonly detachActorFx: (actor: PixiTileActor) => Effect.Effect<void, never, never>;
	readonly settleOriginGhostFx: (actor: PixiTileActor) => Effect.Effect<void, never, never>;
	/** Coalesces canonical/layout invalidation onto the current drag frame slot. */
	readonly requestRefreshFx: Effect.Effect<void, never, never>;
	/** Rechecks the stationary pointer after a committed actor finishes traveling. */
	readonly refreshHoverFx: Effect.Effect<void, never, never>;
	/** Rechecks a DOM-owned pointer release that Pixi did not receive during camera pan. */
	readonly refreshHoverAtFx: (pointer: {
		readonly x: number;
		readonly y: number;
	}) => Effect.Effect<void, never, never>;
	/** Reprojects a held pointer after a camera change without promoting a pressed gesture. */
	readonly refreshPointerFx: (pointer: {
		readonly pointerId?: number;
		readonly x: number;
		readonly y: number;
	}) => Effect.Effect<void, never, never>;
	readonly setInteractionBlockedFx: (blocked: boolean) => Effect.Effect<void, never, never>;
	readonly closeFx: Effect.Effect<void, never, never>;
}

interface Props {
	readonly actorStore: MainActorStore;
	readonly animator: ActorAnimator;
	readonly application: PixiApplicationOwner;
	readonly cursorGrab: CursorGrabMotion;
	readonly dragThreshold: number;
	readonly dragOriginGhosts: DragOriginGhosts;
	readonly dropSubmission: DropSubmission;
	readonly game: GameEngine;
	readonly isTravelingFx: (actor: PixiTileActor) => Effect.Effect<boolean, never, never>;
	readonly onActivateFn: (
		item: TileActorItem,
		intent: MainActivationIntent,
		origin: HTMLElement,
	) => void | PromiseLike<void>;
	readonly surface: MainInteractionSurface;
}

interface ActiveDrag extends createMainDragPreviewFx.State {
	readonly activationIntent: MainActivationIntent;
	readonly pointerId: number;
	readonly pressX: number;
	readonly pressY: number;
	readonly pressScreenX: number;
	readonly pressScreenY: number;
	readonly startX: number;
	readonly startY: number;
	lastPointerX: number;
	lastPointerY: number;
	phase: "dragging" | "pressed";
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
 * committed revision update a held item without turning the eventual drop into a stale command.
 * Geometry drives presentation only; the engine preview and command remain the authority for
 * every drop outcome. A submitted drop retains only its exact source actor and immediately
 * releases the scene-wide gesture slot.
 */
export const createMainDragControllerFx = Effect.fn("createMainDragControllerFx")(function* ({
	actorStore,
	animator,
	application,
	cursorGrab,
	dragThreshold,
	dragOriginGhosts,
	dropSubmission,
	game,
	isTravelingFx,
	onActivateFn,
	surface,
}: Props) {
	let activeDrag: ActiveDrag | null = null;
	let closed = false;
	let interactionBlocked = false;
	let thresholdCrossed = false;
	let hoveredActor: PixiTileActor | null = null;
	let hoverPointer: {
		x: number;
		y: number;
	} | null = null;

	const dragPreview = yield* createMainDragPreviewFx({
		actorStore,
		animator,
		game,
		surface,
	});
	const pointerSampler = yield* createPointerFrameSamplerFx({
		frames: application.frames,
		onApplyFn: (sample) => applyPointerMoveSafelyFn(sample),
	});

	const isMovingFn = (actor: PixiTileActor) =>
		RendererRuntime.runSync(isTravelingFx(actor)) ||
		RendererRuntime.runSync(animator.isChannelActiveFx(actor, "pose"));

	const animateHoverScaleFn = (actor: PixiTileActor, scale: number) => {
		if (actor.container.destroyed) return;
		RendererRuntime.runSync(
			animator.animateFx({
				actor,
				channel: "hover-scale",
				curve: {
					kind: "spring",
					bounce: 0,
				},
				toScale: scale,
				durationMs: 220,
			}),
		);
	};

	const setHoveredActorFn = (actor: PixiTileActor | null) => {
		if (hoveredActor === actor) return;
		const previous = hoveredActor;
		hoveredActor = actor;
		for (const [target, scale] of [
			[
				previous,
				1,
			],
			[
				actor,
				1.08,
			],
		] as const) {
			if (target !== null) animateHoverScaleFn(target, scale);
		}
	};

	const isTargetMovingFn = (facts: MainInteractionTargetFacts) => {
		if (facts.occupant === null) return false;
		const actor = actorStore.actors.get(facts.occupant.id);
		return actor !== undefined && isMovingFn(actor);
	};
	const refreshHoverAtPointerFn = () => {
		if (closed || interactionBlocked || activeDrag !== null || hoverPointer === null) return;
		const pointer = hoverPointer;
		if (
			pointer.x < 0 ||
			pointer.y < 0 ||
			pointer.x > application.app.screen.width ||
			pointer.y > application.app.screen.height
		)
			return;
		const point = application.stage.toLocal(pointer);
		const facts = RendererRuntime.runSync(surface.readTargetFactsFx(point.x, point.y));
		const actor =
			facts.occupant === null ? null : (actorStore.actors.get(facts.occupant.id) ?? null);
		setHoveredActorFn(
			actor !== null &&
				!actor.dragging &&
				!isMovingFn(actor) &&
				!RendererRuntime.runSync(dropSubmission.isPendingActorFx(actor.item.id))
				? actor
				: null,
		);
	};

	const settleActorFn = (actor: PixiTileActor) => {
		RendererRuntime.runSync(
			settleDraggedActorFx({
				actor,
				animator,
				onCompleteFn: () => {
					RendererRuntime.runSync(dragOriginGhosts.settleFx(actor));
					refreshHoverAtPointerFn();
				},
				surface,
			}),
		);
	};

	const releaseDragPointerFn = (pointerId: number) => {
		try {
			application.app.canvas.releasePointerCapture(pointerId);
		} catch {
			// Capture may already be released by the browser.
		}
	};

	const cancelDragFn = (drag: ActiveDrag) => {
		RendererRuntime.runSync(dragPreview.clearTargetFx);
		RendererRuntime.runSync(pointerSampler.cancelFx);
		activeDrag = null;
		releaseDragPointerFn(drag.pointerId);
		RendererRuntime.runSync(surface.renderDropFeedbackFx(null, null));
		RendererRuntime.runSync(cursorGrab.finishFx(drag.actor));
		settleActorFn(drag.actor);
	};

	const cancelInteractionFn = () => {
		setHoveredActorFn(null);
		if (activeDrag === null) return;
		cancelDragFn(activeDrag);
	};

	const detachActorFn = (actor: PixiTileActor) => {
		if (hoveredActor === actor) setHoveredActorFn(null);
		else if (actor.hoverLayer.scale.x !== 1) animateHoverScaleFn(actor, 1);
		RendererRuntime.runSync(dragPreview.detachTargetFx(actor));
		if (actor.onPointerDownFn !== null) {
			actor.container.off("pointerdown", actor.onPointerDownFn);
			actor.onPointerDownFn = null;
		}
		if (actor.onPointerEnterFn !== null) {
			actor.container.off("pointerenter", actor.onPointerEnterFn);
			actor.onPointerEnterFn = null;
		}
		if (actor.onPointerLeaveFn !== null) {
			actor.container.off("pointerleave", actor.onPointerLeaveFn);
			actor.onPointerLeaveFn = null;
		}
		if (activeDrag?.actor !== actor) {
			RendererRuntime.runSync(dragOriginGhosts.settleFx(actor));
			return;
		}
		RendererRuntime.runSync(pointerSampler.cancelFx);
		const drag = activeDrag;
		activeDrag = null;
		RendererRuntime.runSync(dragPreview.clearTargetFx);
		releaseDragPointerFn(drag.pointerId);
		RendererRuntime.runSync(surface.renderDropFeedbackFx(null, null));
		RendererRuntime.runSync(cursorGrab.finishFx(actor));
		actor.dragging = false;
		actor.container.cursor = "default";
		RendererRuntime.runSync(dragOriginGhosts.settleFx(actor));
	};

	const applyPointerMoveFn = (sample: createPointerFrameSamplerFx.Sample) => {
		const event = {
			global: {
				x: sample.x,
				y: sample.y,
			},
			pointerId: sample.pointerId,
		};
		const pointer = readPointerOffsetFn(event, activeDrag);
		if (pointer === null) return;
		const { drag } = pointer;
		const { offsetX, offsetY } = pointer;
		const cursorGrabPointer = {
			x: drag.pressX,
			y: drag.pressY,
		};
		if (drag.phase === "pressed" && isMovingFn(drag.actor)) {
			activeDrag = null;
			releaseDragPointerFn(drag.pointerId);
			return;
		}
		if (drag.phase === "pressed" && !thresholdCrossed) return;
		if (drag.phase === "pressed") {
			drag.phase = "dragging";
			const sourceItem = RendererRuntime.runSync(dragPreview.readCurrentSourceFx(drag));
			if (sourceItem === null) {
				cancelDragFn(drag);
				return;
			}
			drag.actor.dragging = true;
			RendererRuntime.runSync(dragOriginGhosts.beginFx(drag.actor));
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
		const facts = RendererRuntime.runSync(surface.readTargetFactsFx(sample.x, sample.y));
		const targetFacts: MainInteractionTargetFacts = isTargetMovingFn(facts)
			? {
					commandTarget: {
						kind: "unsupported",
					},
					occupant: null,
					stableKey: `moving:${facts.stableKey}`,
					target: null,
				}
			: facts;
		const sourceItem = RendererRuntime.runSync(
			dragPreview.previewTargetFx({
				drag,
				targetFacts,
			}),
		);
		if (sourceItem === null) {
			cancelDragFn(drag);
			return;
		}
		drag.lastPointerX = sample.x;
		drag.lastPointerY = sample.y;
	};

	const recordThresholdCrossingFn = (event: FederatedPointerEvent) => {
		const drag = activeDrag;
		if (
			thresholdCrossed ||
			drag === null ||
			drag.pointerId !== event.pointerId ||
			drag.phase !== "pressed"
		)
			return;
		// Keep admission in original screen coordinates: a world round-trip can round an exact
		// threshold below the drag threshold and mistake a held left gesture for a click.
		thresholdCrossed =
			Math.hypot(event.global.x - drag.pressScreenX, event.global.y - drag.pressScreenY) >=
			dragThreshold;
	};

	const recoverPointerFailureFn = (cause: unknown, fallbackDrag?: ActiveDrag) => {
		const drag = activeDrag ?? fallbackDrag ?? null;
		if (drag !== null) {
			try {
				cancelDragFn(drag);
			} catch {
				RendererRuntime.runSync(pointerSampler.cancelFx);
				activeDrag = null;
				drag.actor.dragging = false;
				drag.actor.container.cursor = "default";
			}
		} else {
			RendererRuntime.runSync(pointerSampler.cancelFx);
		}
		game.reportCriticalFailureFn("game-presentation", cause);
	};

	const applyPointerMoveSafelyFn = (sample: createPointerFrameSamplerFx.Sample) => {
		try {
			applyPointerMoveFn(sample);
		} catch (cause) {
			recoverPointerFailureFn(cause);
		}
	};

	const onPointerMoveFn = (event: FederatedPointerEvent) => {
		hoverPointer = {
			x: event.global.x,
			y: event.global.y,
		};
		const drag = activeDrag;
		if (drag === null || event.pointerId !== drag.pointerId) return;
		const point = application.stage.toLocal(event.global);
		const sample = {
			pointerId: event.pointerId,
			x: point.x,
			y: point.y,
		};
		recordThresholdCrossingFn(event);
		RendererRuntime.runSync(pointerSampler.scheduleFx(sample));
	};

	const finishPointerFn = (event: FederatedPointerEvent) => {
		hoverPointer = {
			x: event.global.x,
			y: event.global.y,
		};
		const pendingDrag = activeDrag;
		if (pendingDrag === null || event.pointerId !== pendingDrag.pointerId) {
			return;
		}
		const point = application.stage.toLocal(event.global);
		const releaseSample = {
			pointerId: event.pointerId,
			x: point.x,
			y: point.y,
		};
		recordThresholdCrossingFn(event);
		RendererRuntime.runSync(pointerSampler.flushFx(releaseSample));
		const drag = activeDrag;
		if (drag === null || event.pointerId !== drag.pointerId) return;
		releaseDragPointerFn(event.pointerId);
		if (drag.phase === "pressed") {
			activeDrag = null;
			const currentActor = actorStore.actors.get(drag.sourceItem.id);
			if (currentActor === undefined || currentActor.container.destroyed) return;
			void Promise.resolve()
				.then(() => {
					if (closed) return;
					const latestActor = actorStore.actors.get(drag.sourceItem.id);
					if (latestActor === undefined || isMovingFn(latestActor)) return;
					const currentItem = latestActor.item;
					return onActivateFn(currentItem, drag.activationIntent, application.app.canvas);
				})
				.catch((cause) => {
					if (closed) return;
					game.reportCriticalFailureFn("game-presentation", cause);
				});
			return;
		}
		try {
			const targetFacts = RendererRuntime.runSync(
				surface.readTargetFactsFx(point.x, point.y),
			);
			if (isTargetMovingFn(targetFacts)) {
				cancelDragFn(drag);
				return;
			}
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
				cancelDragFn(drag);
				return;
			}
			activeDrag = null;
			RendererRuntime.runSync(dragPreview.clearTargetFx);
			RendererRuntime.runSync(
				dropSubmission.submitFx({
					actor: drag.actor,
					commandTarget: targetFacts.commandTarget,
					onReturnSettledFn: () => {
						RendererRuntime.runSync(dragOriginGhosts.settleFx(drag.actor));
						refreshHoverAtPointerFn();
					},
					sourceItem,
				}),
			);
		} catch (cause) {
			recoverPointerFailureFn(cause, drag);
		}
	};

	const cancelPointerFn = (event: FederatedPointerEvent) => {
		const drag = activeDrag;
		if (drag === null || event.pointerId !== drag.pointerId) {
			return;
		}
		cancelDragFn(drag);
	};

	const removeDraggedItemFn = (event: KeyboardEvent) => {
		if (
			closed ||
			event.repeat ||
			event.key.toLowerCase() !== "d" ||
			event.altKey ||
			event.ctrlKey ||
			event.metaKey ||
			!game.getSnapshotFn().cheats.enabled
		) {
			return;
		}
		RendererRuntime.runSync(pointerSampler.flushFx());
		const drag = activeDrag;
		if (drag === null || drag.phase !== "dragging") {
			return;
		}
		const sourceItem = RendererRuntime.runSync(dragPreview.readCurrentSourceFx(drag));
		if (sourceItem === null) return;
		event.preventDefault();
		event.stopImmediatePropagation();
		cancelDragFn(drag);
		void RendererRuntime.runPromise(
			removeCheatItemFx({
				game,
				sourceItem,
			}),
		).catch((cause) => {
			if (closed) return;
			game.reportCriticalFailureFn("game-presentation", cause);
		});
	};

	application.stage.on("globalpointermove", onPointerMoveFn);
	application.stage.on("pointerup", finishPointerFn);
	application.stage.on("pointerupoutside", finishPointerFn);
	application.stage.on("pointercancel", cancelPointerFn);
	const clearHoverPointerFn = () => {
		hoverPointer = null;
	};
	application.app.canvas.addEventListener("pointerleave", clearHoverPointerFn);
	const keyboardTarget = typeof window === "undefined" ? null : window;
	keyboardTarget?.addEventListener("keydown", removeDraggedItemFn, {
		capture: true,
	});

	return {
		attachActorFx: Effect.fn("MainDragController.attachActorFx")((actor) =>
			Effect.gen(function* () {
				if (actor.onPointerDownFn !== null) {
					actor.container.off("pointerdown", actor.onPointerDownFn);
				}
				if (actor.onPointerEnterFn !== null) {
					actor.container.off("pointerenter", actor.onPointerEnterFn);
				}
				if (actor.onPointerLeaveFn !== null) {
					actor.container.off("pointerleave", actor.onPointerLeaveFn);
				}
				actor.container.eventMode = "static";
				actor.container.cursor = readActorCursorFn({
					phase: "idle",
					running: actor.item.running,
				});
				const onPointerDownFn = (event: FederatedPointerEvent) => {
					if (
						closed ||
						interactionBlocked ||
						isMovingFn(actor) ||
						activeDrag !== null ||
						RendererRuntime.runSync(dropSubmission.isPendingActorFx(actor.item.id)) ||
						!event.isPrimary ||
						event.button !== 0
					) {
						return;
					}
					event.stopPropagation();
					setHoveredActorFn(null);
					try {
						application.app.canvas.setPointerCapture(event.pointerId);
					} catch {
						// Pixi still receives in-canvas pointer events without DOM capture.
					}
					const point = application.stage.toLocal(event.global);
					activeDrag = {
						activationIntent: match(event)
							.returnType<MainActivationIntent>()
							.with(
								{
									button: 0,
									ctrlKey: true,
									altKey: false,
									metaKey: false,
								},
								() => "fill-default-line-queue",
							)
							.with(
								{
									button: 0,
									shiftKey: true,
									ctrlKey: false,
									altKey: false,
									metaKey: false,
								},
								() => "primary",
							)
							.otherwise(() => "detail"),
						actor,
						pointerId: event.pointerId,
						pressScreenX: event.global.x,
						pressScreenY: event.global.y,
						pressX: point.x,
						pressY: point.y,
						lastPointerX: point.x,
						lastPointerY: point.y,
						previewKind: null,
						previewSource: null,
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
				actor.onPointerDownFn = onPointerDownFn;
				actor.container.on("pointerdown", onPointerDownFn);
				const onPointerEnterFn = () => {
					if (
						closed ||
						interactionBlocked ||
						activeDrag !== null ||
						actor.dragging ||
						isMovingFn(actor) ||
						RendererRuntime.runSync(dropSubmission.isPendingActorFx(actor.item.id))
					)
						return;
					setHoveredActorFn(actor);
				};
				const onPointerLeaveFn = () => {
					if (hoveredActor === actor) setHoveredActorFn(null);
				};
				actor.onPointerEnterFn = onPointerEnterFn;
				actor.onPointerLeaveFn = onPointerLeaveFn;
				actor.container.on("pointerenter", onPointerEnterFn);
				actor.container.on("pointerleave", onPointerLeaveFn);
			}),
		),
		cancelInteractionFx: Effect.sync(() => cancelInteractionFn()),
		clearHoverFx: Effect.fn("MainDragController.clearHoverFx")((actor) =>
			Effect.sync(() => {
				if (hoveredActor === actor) setHoveredActorFn(null);
			}),
		),
		detachActorFx: Effect.fn("MainDragController.detachActorFx")((actor) =>
			Effect.sync(() => detachActorFn(actor)),
		),
		settleOriginGhostFx: Effect.fn("MainDragController.settleOriginGhostFx")((actor) =>
			dragOriginGhosts.settleFx(actor),
		),
		requestRefreshFx: Effect.gen(function* () {
			const drag = activeDrag;
			if (drag === null || drag.phase !== "dragging") return;
			yield* pointerSampler.scheduleFallbackFx({
				pointerId: drag.pointerId,
				x: drag.lastPointerX,
				y: drag.lastPointerY,
			});
		}),
		refreshHoverFx: Effect.sync(() => refreshHoverAtPointerFn()),
		refreshHoverAtFx: Effect.fn("MainDragController.refreshHoverAtFx")((pointer) =>
			Effect.sync(() => {
				hoverPointer = pointer;
				refreshHoverAtPointerFn();
			}),
		),
		refreshPointerFx: Effect.fn("MainDragController.refreshPointerFx")((pointer) =>
			Effect.gen(function* () {
				const drag = activeDrag;
				if (
					drag === null ||
					drag.phase !== "dragging" ||
					(pointer.pointerId !== undefined && drag.pointerId !== pointer.pointerId)
				)
					return;
				const point = application.stage.toLocal(pointer);
				// Replace queued world coordinates captured before the camera moved.
				yield* pointerSampler.flushFx({
					pointerId: drag.pointerId,
					x: point.x,
					y: point.y,
				});
			}),
		),
		setInteractionBlockedFx: Effect.fn("MainDragController.setInteractionBlockedFx")(
			(blocked) =>
				Effect.sync(() => {
					interactionBlocked = blocked;
					if (blocked) cancelInteractionFn();
				}),
		),
		closeFx: Effect.gen(function* () {
			if (closed) return;
			closed = true;
			cancelInteractionFn();
			yield* pointerSampler.cancelFx;
			application.stage.off("globalpointermove", onPointerMoveFn);
			application.stage.off("pointerup", finishPointerFn);
			application.stage.off("pointerupoutside", finishPointerFn);
			application.stage.off("pointercancel", cancelPointerFn);
			application.app.canvas.removeEventListener("pointerleave", clearHoverPointerFn);
			keyboardTarget?.removeEventListener("keydown", removeDraggedItemFn, {
				capture: true,
			});
			for (const actor of actorStore.actors.values()) {
				detachActorFn(actor);
			}
		}),
	} satisfies MainDragController;
});
