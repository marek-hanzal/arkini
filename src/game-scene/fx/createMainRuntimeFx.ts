import { Effect } from "effect";

import type { GameEngine } from "~/playable-game/type/GameEngine";
import type { GameTransition } from "~/game-session/type/GameSession";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { DropItemCommand } from "~/item-interaction/type/DropItemCommand";
import type { DropItemResult } from "~/item-interaction/type/DropItemResult";
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
import type { MainRuntime } from "~/game-scene/service/MainRuntime";

interface CreateMainRuntimeProps {
	readonly dragThreshold: number;
	readonly game: GameEngine;
	readonly host: HTMLElement;
	readonly onActivateFn: (
		item: TileActorItem,
		intent: MainActivationIntent,
		origin: HTMLElement,
	) => void | PromiseLike<void>;
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
		const particleTextures = yield* createParticleTexturesFx();
		registerRollbackFn(particleTextures.closeFx);
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
		const magneticField = yield* createMagneticFieldFx({
			actorStore,
			animationDriver,
			scheduleApplyFn: (applyFn) =>
				RendererRuntime.runSync(application.frames.scheduleFx(applyFn)),
		});
		registerRollbackFn(magneticField.closeFx);
		const motion = yield* createMotionRuntimeFx({
			actorStore,
			animator,
			application,
			magneticField,
			readPaletteFn: () => paletteState.current,
			surface,
			textures,
		});
		registerRollbackFn(motion.closeFx);
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
			magneticField,
			motion,
			onAcceptedDropFn: () => replayCurrentTransitionFn(),
			onDropFn,
			surface,
		});
		registerRollbackFn(dropSubmission.closeFx);
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
			onActivateFn,
			readAckTintFn: () => paletteState.current.success,
			surface,
		});
		registerRollbackFn(drag.closeFx);
		const delivery = yield* createDeliveryRuntimeFx({
			actorStore,
			animator,
			application,
			drag,
			magneticField,
			particleTextures,
			readPaletteFn: () => paletteState.current,
			surface,
			textures,
		});
		registerRollbackFn(delivery.closeFx);
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
			readPaletteFn: () => paletteState.current,
			surface,
			textures,
		});
		registerRollbackFn(reconciler.closeFx);
		let closed = false;
		let latestTransition = game.getTransitionSnapshotFn();

		const applyTransitionFn = (transition: GameTransition, delivery: "hydrate" | "present") => {
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
			applyTransitionFn,
			initialSequence: latestTransition.sequence,
			scheduleAfterRenderFn: (workFn) =>
				RendererRuntime.runSync(application.frames.scheduleAfterRenderFx(workFn)),
			setInteractionBlockedFn: (blocked) =>
				RendererRuntime.runSync(drag.setInteractionBlockedFx(blocked)),
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
		const subscriptionReplayGate = yield* createSubscriptionReplayGateFx(
			latestTransition.sequence,
		);
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
				"data-theme",
			],
			attributes: true,
		});
		registerRollbackFn(Effect.sync(() => appearanceObserver.disconnect()));
		const unsubscribeTransitionsFn = game.subscribeTransitionsFn((transition) => {
			try {
				const delivery = RendererRuntime.runSync(
					subscriptionReplayGate.classifyFx(transition.sequence),
				);
				transitionPresenter.presentFn(transition, delivery);
			} catch (cause) {
				reportCriticalFailureFn(cause);
			}
		});
		registerRollbackFn(Effect.sync(() => unsubscribeTransitionsFn()));

		return {
			canvas: application.app.canvas,
			cancelInteractionFx: drag.cancelInteractionFx,
			setInteractionBlockedFx: transitionPresenter.setInteractionBlockedFx,
			closeFx: Effect.gen(function* () {
				if (closed) return;
				closed = true;
				yield* rollbackFx;
			}),
		} satisfies MainRuntime;
	}).pipe(Effect.onError(() => rollbackFx));
});
