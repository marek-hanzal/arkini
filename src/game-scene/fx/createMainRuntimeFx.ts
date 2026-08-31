import { Effect } from "effect";

import type { GameEngine } from "~/playable-game/type/GameEngine";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { runTileDropAtom } from "~/tile-interaction/atom/runTileDropAtom";
import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import { createMainActorStoreFx } from "~/tile-rendering/fx/createMainActorStoreFx";
import { createParticleTexturesFx } from "~/tile-rendering/fx/createParticleTexturesFx";
import { createAnimationDriverFx } from "~/tile-rendering/fx/createAnimationDriverFx";
import { createDropFeedbackFx } from "~/game-scene/fx/createDropFeedbackFx";
import { createActorAnimatorFx } from "~/tile-rendering/fx/createActorAnimatorFx";
import { readScenePaletteFx } from "~/tile-rendering/fx/readScenePaletteFx";
import { createCursorGrabMotionFx } from "~/tile-interaction/fx/createCursorGrabMotionFx";
import { createMainDragControllerFx } from "~/tile-interaction/fx/createMainDragControllerFx";
import { createDeliveryRuntimeFx } from "~/game-scene/fx/createDeliveryRuntimeFx";
import { createDropPresentationFx } from "~/tile-interaction/fx/createDropPresentationFx";
import { createDropSubmissionFx } from "~/tile-interaction/fx/createDropSubmissionFx";
import { createMagneticFieldFx } from "~/tile-motion/fx/createMagneticFieldFx";
import { createMotionRuntimeFx } from "~/tile-motion/fx/createMotionRuntimeFx";
import { createApplicationOwnerFx } from "~/tile-rendering/fx/createApplicationOwnerFx";
import type { TextureStore } from "~/tile-rendering/fx/createTextureStoreFx";
import type { MainActivationIntent } from "~/tile-interaction/type/MainActivationIntent";
import { createMainReconcilerFx } from "~/game-scene/fx/createMainReconcilerFx";
import { createSubscriptionReplayGateFx } from "~/game-scene/fx/createSubscriptionReplayGateFx";
import { createMainSurfaceFx } from "~/game-scene/fx/createMainSurfaceFx";
import { createSpaceActionPresenterFx } from "~/game-scene/fx/createSpaceActionPresenterFx";

interface CreateMainRuntimeProps {
	readonly dragThreshold: number;
	readonly game: GameEngine;
	readonly host: HTMLElement;
	readonly onActivate: (
		item: TileActorItem,
		intent: MainActivationIntent,
		origin: HTMLElement,
	) => void | PromiseLike<void>;
	readonly onDrop: (command: runTileDropAtom.Command) => PromiseLike<runTileDropAtom.Result>;
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
	onActivate,
	onDrop,
	textures,
}: CreateMainRuntimeProps) {
	const reportCriticalFailure = (cause: unknown) =>
		game.reportCriticalFailure("game-presentation", cause);
	const application = yield* createApplicationOwnerFx({
		host,
		reportCriticalFailure,
	});
	const rollbackEffects: Effect.Effect<void, unknown>[] = [];
	const registerRollback = (closeFx: Effect.Effect<void, unknown>) => {
		rollbackEffects.unshift(closeFx);
	};
	registerRollback(application.closeFx);
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
		const particleTextures = yield* createParticleTexturesFx();
		registerRollback(particleTextures.closeFx);
		const actorStore = yield* createMainActorStoreFx();
		const animationDriver = yield* createAnimationDriverFx({
			frames: application.frames,
		});
		registerRollback(animationDriver.closeFx);
		const animator = yield* createActorAnimatorFx({
			animationDriver,
			frames: application.frames,
		});
		const dropFeedback = yield* createDropFeedbackFx({
			animationDriver,
			label: "DropFeedbackLayer",
		});
		registerRollback(dropFeedback.closeFx);
		const surface = yield* createMainSurfaceFx({
			actorStore,
			application,
			dropFeedback,
			game,
			palette: paletteState.current,
		});
		registerRollback(surface.closeFx);
		// Retained actors must die before their parent surface destroys its layers.
		registerRollback(actorStore.closeFx);
		registerRollback(animator.closeFx);
		const magneticField = yield* createMagneticFieldFx({
			actorStore,
			animationDriver,
			scheduleApply: (apply) => RendererRuntime.runSync(application.frames.scheduleFx(apply)),
		});
		registerRollback(magneticField.closeFx);
		const motion = yield* createMotionRuntimeFx({
			actorStore,
			animator,
			application,
			magneticField,
			readPalette: () => paletteState.current,
			surface,
			textures,
		});
		registerRollback(motion.closeFx);
		const cursorGrab = yield* createCursorGrabMotionFx({
			animationDriver,
			animator,
		});
		registerRollback(cursorGrab.closeFx);
		const dropPresentation = yield* createDropPresentationFx();
		registerRollback(dropPresentation.closeFx);
		let replayCurrentTransition: () => void = () => undefined;
		const dropSubmission = yield* createDropSubmissionFx({
			actorStore,
			animator,
			cursorGrab,
			dropPresentation,
			game,
			magneticField,
			motion,
			onAcceptedDrop: () => replayCurrentTransition(),
			onDrop,
			surface,
		});
		registerRollback(dropSubmission.closeFx);
		const drag = yield* createMainDragControllerFx({
			actorStore,
			animator,
			application,
			cursorGrab,
			dragThreshold,
			dropSubmission,
			game,
			magneticField,
			motion,
			onActivate,
			readAckTint: () => paletteState.current.success,
			surface,
		});
		registerRollback(drag.closeFx);
		const delivery = yield* createDeliveryRuntimeFx({
			actorStore,
			animator,
			application,
			drag,
			magneticField,
			particleTextures,
			readPalette: () => paletteState.current,
			surface,
			textures,
		});
		registerRollback(delivery.closeFx);
		const reconciler = yield* createMainReconcilerFx({
			actorStore,
			animator,
			application,
			drag,
			delivery,
			dropPresentation,
			game,
			magneticField,
			motion,
			particleTextures,
			readPalette: () => paletteState.current,
			surface,
			textures,
		});
		registerRollback(reconciler.closeFx);
		let closed = false;
		let latestTransition = game.getTransitionSnapshot();

		const applyTransition = (
			transition: ReturnType<GameEngine["getTransitionSnapshot"]>,
			delivery: "hydrate" | "present",
		) => {
			if (closed) return;
			latestTransition = transition;
			// Surface hit testing and actor reconciliation must observe one committed snapshot.
			RendererRuntime.runSync(surface.setTransitionFx(transition));
			RendererRuntime.runSync(
				delivery === "hydrate"
					? reconciler.hydrateFx(transition)
					: reconciler.reconcileFx(transition),
			);
		};
		const transitionPresenter = yield* createSpaceActionPresenterFx({
			applyTransition,
			initialSequence: latestTransition.sequence,
			scheduleAfterRender: (work) =>
				RendererRuntime.runSync(application.frames.scheduleAfterRenderFx(work)),
			setInteractionBlocked: (blocked) =>
				RendererRuntime.runSync(drag.setInteractionBlockedFx(blocked)),
		});
		registerRollback(transitionPresenter.closeFx);
		replayCurrentTransition = () => transitionPresenter.refresh(game.getTransitionSnapshot());

		const redraw = () => {
			if (closed) return;
			RendererRuntime.runSync(surface.redrawFx);
			RendererRuntime.runSync(reconciler.hydrateFx(latestTransition));
		};

		RendererRuntime.runSync(surface.redrawFx);
		applyTransition(latestTransition, "hydrate");
		const subscriptionReplayGate = yield* createSubscriptionReplayGateFx(
			latestTransition.sequence,
		);
		const removeResizeListener = yield* application.addResizeListenerFx(redraw);
		registerRollback(Effect.sync(() => removeResizeListener()));
		const appearanceObserver = new MutationObserver(() => {
			paletteState.current = RendererRuntime.runSync(readScenePaletteFx(host));
			RendererRuntime.runSync(surface.setPaletteFx(paletteState.current));
			RendererRuntime.runSync(surface.redrawFx);
			RendererRuntime.runSync(reconciler.refreshVisualsFx);
		});
		appearanceObserver.observe(document.documentElement, {
			attributeFilter: [
				"data-accent",
				"data-theme",
			],
			attributes: true,
		});
		registerRollback(Effect.sync(() => appearanceObserver.disconnect()));
		const unsubscribeTransitions = game.subscribeTransitions((transition) => {
			try {
				const delivery = RendererRuntime.runSync(
					subscriptionReplayGate.classifyFx(transition.sequence),
				);
				transitionPresenter.present(transition, delivery);
			} catch (cause) {
				reportCriticalFailure(cause);
			}
		});
		registerRollback(Effect.sync(() => unsubscribeTransitions()));

		return {
			canvas: application.app.canvas,
			cancelInteractionFx: drag.cancelInteractionFx,
			setInteractionBlockedFx: transitionPresenter.setInteractionBlockedFx,
			closeFx: Effect.gen(function* () {
				if (closed) return;
				closed = true;
				yield* rollbackFx;
			}),
		};
	}).pipe(Effect.onError(() => rollbackFx));
});
