import { readBoardSizeFn } from "~/game-runtime/fn/readBoardSizeFn";
import { Effect } from "effect";
import { match } from "ts-pattern";

import type { GameEngine } from "~/playable-game/type/GameEngine";
import type { GameTransition } from "~/game-session/type/GameSession";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { DropItemCommand } from "~/item-interaction/type/DropItemCommand";
import type { DropItemResult } from "~/item-interaction/type/DropItemResult";
import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import { createMainActorStoreFx } from "~/tile-rendering/fx/createMainActorStoreFx";
import { createAnimationDriverFx } from "~/tile-rendering/fx/createAnimationDriverFx";
import { createDropFeedbackFx } from "~/game-scene/fx/createDropFeedbackFx";
import { createActorAnimatorFx } from "~/tile-rendering/fx/createActorAnimatorFx";
import { readScenePaletteFx } from "~/tile-rendering/fx/readScenePaletteFx";
import { createCursorGrabMotionFx } from "~/tile-interaction/fx/createCursorGrabMotionFx";
import { createMainDragControllerFx } from "~/tile-interaction/fx/createMainDragControllerFx";
import { createDropPresentationFx } from "~/tile-interaction/fx/createDropPresentationFx";
import { createDropSubmissionFx } from "~/tile-interaction/fx/createDropSubmissionFx";
import { createApplicationOwnerFx } from "~/tile-rendering/fx/createApplicationOwnerFx";
import type { TextureStore } from "~/tile-rendering/fx/createTextureStoreFx";
import type { MainActivationIntent } from "~/tile-interaction/type/MainActivationIntent";
import { createMainReconcilerFx } from "~/game-scene/fx/createMainReconcilerFx";
import { createBoardCameraFx } from "~/game-scene/fx/createBoardCameraFx";
import { readTileInfoGeometryFn } from "~/tile-rendering/fn/readTileInfoGeometryFn";
import { readMainLayoutFn } from "~/game-scene/fn/readMainLayoutFn";
import { createMainSurfaceFx } from "~/game-scene/fx/createMainSurfaceFx";
import { createBoardTransitionPresenterFx } from "~/game-scene/fx/createBoardTransitionPresenterFx";
import { createPresentationRuntimeFx } from "~/game-scene/fx/createPresentationRuntimeFx";
import type { MainRuntime } from "~/game-scene/service/MainRuntime";
import { createDragOriginGhostsFx } from "~/tile-interaction/fx/createDragOriginGhostsFx";

interface CreateMainRuntimeProps {
	readonly dragThreshold: number;
	readonly game: GameEngine;
	readonly host: HTMLElement;
	readonly onActivateFn: (
		item: TileActorItem,
		intent: MainActivationIntent,
		origin: HTMLElement,
	) => void | PromiseLike<void>;
	readonly onRejectedDropFn?: () => void;
	readonly onDropFn: (command: DropItemCommand) => PromiseLike<DropItemResult>;
	readonly textures: TextureStore;
}

/**
 * Composes the main scene's explicit owner graph without taking ownership of gameplay state.
 *
 * Every acquisition registers a reverse-order rollback immediately. Transition subscribers,
 * interactions, animations, actors, surfaces, and finally the Pixi application must close in that
 * dependency order on both partial initialization failure and normal teardown.
 */
export const createMainRuntimeFx = Effect.fn("createMainRuntimeFx")(function* ({
	dragThreshold,
	game,
	host,
	onActivateFn,
	onDropFn,
	onRejectedDropFn,
	textures,
}: CreateMainRuntimeProps) {
	const reportCriticalFailureFn = (cause: unknown) =>
		game.reportCriticalFailureFn("game-presentation", cause);
	const application = yield* createApplicationOwnerFx({
		host,
		reportCriticalFailureFn,
	});
	const rollbackEffects: Effect.Effect<void, unknown, never>[] = [];
	const registerRollbackFn = (closeFx: Effect.Effect<void, unknown, never>) => {
		rollbackEffects.unshift(closeFx);
	};
	registerRollbackFn(application.closeFx);
	const rollbackFx = Effect.suspend(() =>
		Effect.forEach(
			rollbackEffects,
			(closeFx) => closeFx.pipe(Effect.catchCause(() => Effect.void)),
			{
				discard: true,
			},
		),
	);
	return yield* Effect.gen(function* () {
		const paletteState = {
			current: yield* readScenePaletteFx(host),
		};
		const actorStore = yield* createMainActorStoreFx();
		const animationDriver = yield* createAnimationDriverFx({
			frames: application.frames,
		});
		registerRollbackFn(animationDriver.closeFx);
		const animator = yield* createActorAnimatorFx({
			animationDriver,
			frames: application.frames,
		});
		const dropFeedback = yield* createDropFeedbackFx({
			animationDriver,
			label: "DropFeedbackLayer",
		});
		registerRollbackFn(dropFeedback.closeFx);
		const surface = yield* createMainSurfaceFx({
			actorStore,
			application,
			dropFeedback,
			game,
			palette: paletteState.current,
		});
		registerRollbackFn(surface.closeFx);
		// Retained actors must die before their parent surface destroys its layers.
		registerRollbackFn(actorStore.closeFx);
		registerRollbackFn(animator.closeFx);
		const dragOriginGhosts = yield* createDragOriginGhostsFx({
			animationDriver,
			application,
			surface,
		});
		registerRollbackFn(dragOriginGhosts.closeFx);
		const cursorGrab = yield* createCursorGrabMotionFx({
			animationDriver,
			animator,
		});
		registerRollbackFn(cursorGrab.closeFx);
		const dropPresentation = yield* createDropPresentationFx();
		registerRollbackFn(dropPresentation.closeFx);
		let replayCurrentTransitionFn: () => void = () => undefined;
		const dropSubmission = yield* createDropSubmissionFx({
			actorStore,
			animator,
			cursorGrab,
			dropPresentation,
			game,
			onSettledDropFn: () => replayCurrentTransitionFn(),
			onDropFn,
			onRejectedDropFn,
			surface,
		});
		registerRollbackFn(dropSubmission.closeFx);
		const presentation = yield* createPresentationRuntimeFx({
			animator,
			animationDriver,
			frames: application.frames,
			surface,
		});
		registerRollbackFn(presentation.closeFx);
		const drag = yield* createMainDragControllerFx({
			actorStore,
			animator,
			application,
			cursorGrab,
			dragThreshold,
			dragOriginGhosts,
			dropSubmission,
			game,
			isTravelingFx: presentation.isTravelingFx,
			onActivateFn,
			surface,
		});
		registerRollbackFn(drag.closeFx);
		const initialRuntime = game.getTransitionSnapshotFn().runtime;
		const initialSize = readBoardSizeFn({
			runtime: initialRuntime,
			config: game.config,
			space: initialRuntime.currentSpace,
		});
		const layout = readMainLayoutFn({
			boardHeight: initialSize.height,
			boardWidth: initialSize.width,
		});
		const camera = yield* createBoardCameraFx({
			animationDriver,
			application,
			drag,
			dragThreshold,
			onScaleFn: (zoom) => {
				for (const actor of actorStore.actors.values()) {
					const info = readTileInfoGeometryFn(zoom, actor.size);
					actor.infoButton.position.set(info.inset, info.inset);
					actor.infoButton.scale.set(info.scale);
					actor.infoShadow.position.set(info.shadowOffset, info.shadowOffset);
				}
			},
			surfaces: [
				layout,
			],
		});
		registerRollbackFn(camera.closeFx);
		const reconciler = yield* createMainReconcilerFx({
			actorStore,
			animator,
			application,
			drag,
			game,
			presentation,
			readPaletteFn: () => paletteState.current,
			surface,
			textures,
		});
		registerRollbackFn(reconciler.closeFx);
		let closed = false;
		let latestTransition = game.getTransitionSnapshotFn();

		const applyTransitionFn = (
			transition: GameTransition,
			mode: "hydrate" | "present" | "board-arrive",
		) => {
			if (closed) return;
			const previousSize = readBoardSizeFn({
				runtime: latestTransition.runtime,
				config: game.config,
				space: latestTransition.runtime.currentSpace,
			});
			const nextSize = readBoardSizeFn({
				runtime: transition.runtime,
				config: game.config,
				space: transition.runtime.currentSpace,
			});
			latestTransition = transition;
			// Surface hit testing and actor reconciliation must observe one committed snapshot.
			RendererRuntime.runSync(surface.setTransitionFx(transition));
			if (
				mode === "board-arrive" ||
				previousSize.width !== nextSize.width ||
				previousSize.height !== nextSize.height
			) {
				RendererRuntime.runSync(surface.redrawFx);
				const nextLayout = readMainLayoutFn({
					boardHeight: nextSize.height,
					boardWidth: nextSize.width,
				});
				RendererRuntime.runSync(
					camera.setSurfacesFx(
						[
							nextLayout,
						],
						{
							animate: mode !== "board-arrive",
						},
					),
				);
			}
			RendererRuntime.runSync(
				match(mode)
					.with("hydrate", () => reconciler.hydrateFx(transition))
					.with("board-arrive", () => reconciler.boardArriveFx(transition))
					.with("present", () => reconciler.reconcileFx(transition))
					.exhaustive(),
			);
		};
		const transitionPresenter = yield* createBoardTransitionPresenterFx({
			applyTransitionFn,
			exitVisibleItemsFn: () => RendererRuntime.runSync(reconciler.exitVisibleItemsFx),
			initialTransition: latestTransition,
			presentation,
			readLatestTransitionFn: game.getTransitionSnapshotFn,
			scheduleAfterRenderFn: (workFn) =>
				RendererRuntime.runSync(application.frames.scheduleAfterRenderFx(workFn)),
			setInteractionBlockedFn: (blocked) =>
				RendererRuntime.runSync(camera.setInteractionBlockedFx(blocked)),
		});
		registerRollbackFn(transitionPresenter.closeFx);
		replayCurrentTransitionFn = () =>
			transitionPresenter.refreshFn(game.getTransitionSnapshotFn());

		const redrawFn = () => {
			if (closed) return;
			RendererRuntime.runSync(surface.redrawFx);
			RendererRuntime.runSync(reconciler.hydrateFx(latestTransition));
		};

		RendererRuntime.runSync(surface.redrawFx);
		applyTransitionFn(latestTransition, "hydrate");
		const removeResizeListenerFn = yield* application.addResizeListenerFx(redrawFn);
		registerRollbackFn(Effect.sync(() => removeResizeListenerFn()));
		const appearanceObserver = new MutationObserver(() => {
			paletteState.current = RendererRuntime.runSync(readScenePaletteFx(host));
			RendererRuntime.runSync(surface.setPaletteFx(paletteState.current));
			RendererRuntime.runSync(surface.redrawFx);
			RendererRuntime.runSync(reconciler.refreshVisualsFx);
		});
		appearanceObserver.observe(document.documentElement, {
			attributeFilter: [
				"data-accent",
			],
			attributes: true,
		});
		registerRollbackFn(Effect.sync(() => appearanceObserver.disconnect()));
		const unsubscribeTransitionsFn = game.subscribeTransitionsFn((transition) => {
			try {
				transitionPresenter.presentFn(transition);
			} catch (cause) {
				reportCriticalFailureFn(cause);
			}
		});
		registerRollbackFn(Effect.sync(() => unsubscribeTransitionsFn()));

		return {
			canvas: application.app.canvas,
			cancelInteractionFx: camera.cancelInteractionFx,
			setInteractionBlockedFx: transitionPresenter.setInteractionBlockedFx,
			closeFx: Effect.gen(function* () {
				if (closed) return;
				closed = true;
				yield* rollbackFx;
			}),
		} satisfies MainRuntime;
	}).pipe(Effect.onError(() => rollbackFx));
});
