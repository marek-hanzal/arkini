import { Effect } from "effect";

import type { GameEngine } from "~/bridge/game/GameEngine";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { runTileDropAtom } from "~/bridge/tile/runTileDropAtom";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import { createPixiMainSceneActorStoreFx } from "~/ui/pixi/actor/createPixiMainSceneActorStoreFx";
import { createPixiAnimationDriverFx } from "~/ui/pixi/animation/createPixiAnimationDriverFx";
import { createPixiActorAnimatorFx } from "~/ui/pixi/animation/createPixiActorAnimatorFx";
import { readPixiScenePaletteFx } from "~/ui/pixi/appearance/readPixiScenePaletteFx";
import { createPixiCursorGrabMotionFx } from "~/ui/pixi/drag/createPixiCursorGrabMotionFx";
import { createPixiMainSceneDragControllerFx } from "~/ui/pixi/drag/createPixiMainSceneDragControllerFx";
import { createPixiMainSceneDropPresentationFx } from "~/ui/pixi/drop/createPixiMainSceneDropPresentationFx";
import type { TileSceneHandoffStore } from "~/ui/pixi/handoff/createTileSceneHandoffStoreFx";
import { createPixiTileMagneticFieldFx } from "~/ui/pixi/magnet/createPixiTileMagneticFieldFx";
import { createPixiTileMotionRuntimeFx } from "~/ui/pixi/motion/createPixiTileMotionRuntimeFx";
import { createPixiApplicationOwnerFx } from "~/ui/pixi/runtime/createPixiApplicationOwnerFx";
import type { PixiTextureStore } from "~/ui/pixi/runtime/createPixiTextureStoreFx";
import type { PixiMainSceneRuntime } from "~/ui/pixi/scene/PixiMainSceneRuntime";
import { createPixiMainSceneReconcilerFx } from "~/ui/pixi/scene/createPixiMainSceneReconcilerFx";
import { createPixiMainSceneSurfaceFx } from "~/ui/pixi/scene/createPixiMainSceneSurfaceFx";

export namespace createPixiMainSceneRuntimeFx {
	export interface Props {
		readonly game: GameEngine;
		readonly handoffs: TileSceneHandoffStore;
		readonly host: HTMLElement;
		readonly onActivate: (
			item: TileActorItem,
			shiftKey: boolean,
			origin: HTMLElement,
		) => void | PromiseLike<void>;
		readonly onDrop: (command: runTileDropAtom.Command) => PromiseLike<runTileDropAtom.Result>;
		readonly textures: PixiTextureStore;
	}
}

/**
 * Composes the main scene's explicit owner graph without taking ownership of gameplay state.
 *
 * Every acquisition registers a reverse-order rollback immediately. Transition subscribers,
 * interactions, animations, actors, surfaces, and finally the Pixi application must close in that
 * dependency order on both partial initialization failure and normal teardown.
 */
export const createPixiMainSceneRuntimeFx = Effect.fn("createPixiMainSceneRuntimeFx")(function* ({
	game,
	handoffs,
	host,
	onActivate,
	onDrop,
	textures,
}: createPixiMainSceneRuntimeFx.Props) {
	const application = yield* createPixiApplicationOwnerFx({
		host,
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
			current: yield* readPixiScenePaletteFx(host),
		};
		const actorStore = yield* createPixiMainSceneActorStoreFx();
		const animationDriver = yield* createPixiAnimationDriverFx({
			frames: application.frames,
		});
		registerRollback(animationDriver.closeFx);
		const animator = yield* createPixiActorAnimatorFx({
			animationDriver,
		});
		const surface = yield* createPixiMainSceneSurfaceFx({
			application,
			game,
			palette: paletteState.current,
			readActors: () => actorStore.actors.values(),
		});
		registerRollback(surface.closeFx);
		// Retained actors must die before their parent surface destroys its layers.
		registerRollback(actorStore.closeFx);
		registerRollback(animator.closeFx);
		const motion = yield* createPixiTileMotionRuntimeFx({
			actorStore,
			animator,
			application,
			handoffs,
			readPalette: () => paletteState.current,
			surface,
			textures,
		});
		registerRollback(motion.closeFx);
		const cursorGrab = yield* createPixiCursorGrabMotionFx({
			animationDriver,
			frames: application.frames,
		});
		registerRollback(cursorGrab.closeFx);
		const magneticField = yield* createPixiTileMagneticFieldFx({
			actorStore,
			animationDriver,
			surface,
		});
		registerRollback(magneticField.closeFx);
		const dropPresentation = yield* createPixiMainSceneDropPresentationFx();
		registerRollback(dropPresentation.closeFx);
		let replayCurrentTransition: () => void = () => undefined;
		const drag = yield* createPixiMainSceneDragControllerFx({
			actorStore,
			animator,
			application,
			cursorGrab,
			dropPresentation,
			game,
			magneticField,
			motion,
			onActivate,
			onAcceptedDrop: () => replayCurrentTransition(),
			onDrop,
			surface,
		});
		registerRollback(drag.closeFx);
		const reconciler = yield* createPixiMainSceneReconcilerFx({
			actorStore,
			animator,
			application,
			drag,
			dropPresentation,
			game,
			magneticField,
			motion,
			readPalette: () => paletteState.current,
			surface,
			textures,
		});
		registerRollback(reconciler.closeFx);
		let closed = false;
		let latestTransition = game.getTransitionSnapshot();

		const applyTransition = (transition: ReturnType<GameEngine["getTransitionSnapshot"]>) => {
			if (closed) return;
			latestTransition = transition;
			// Surface hit testing and actor reconciliation must observe one committed snapshot.
			RendererRuntime.runSync(surface.setTransitionFx(transition));
			RendererRuntime.runSync(reconciler.reconcileFx(transition));
		};
		replayCurrentTransition = () => applyTransition(game.getTransitionSnapshot());

		const redraw = () => {
			if (closed) return;
			RendererRuntime.runSync(surface.redrawFx);
			RendererRuntime.runSync(reconciler.reconcileFx(latestTransition));
		};

		RendererRuntime.runSync(surface.redrawFx);
		applyTransition(latestTransition);
		const removeResizeListener = yield* application.addResizeListenerFx(redraw);
		registerRollback(Effect.sync(() => removeResizeListener()));
		const appearanceObserver = new MutationObserver(() => {
			paletteState.current = RendererRuntime.runSync(readPixiScenePaletteFx(host));
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
				applyTransition(transition);
			} catch (cause) {
				console.error("Pixi main-scene transition reconciliation failed.", cause);
			}
		});
		registerRollback(Effect.sync(() => unsubscribeTransitions()));

		return {
			canvas: application.app.canvas,
			cancelInteractionFx: drag.cancelInteractionFx,
			setInteractionBlockedFx: drag.setInteractionBlockedFx,
			closeFx: Effect.gen(function* () {
				if (closed) return;
				closed = true;
				yield* rollbackFx;
			}),
		} satisfies PixiMainSceneRuntime;
	}).pipe(Effect.onError(() => rollbackFx));
});
