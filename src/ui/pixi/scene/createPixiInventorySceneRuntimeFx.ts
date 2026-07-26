import { Effect } from "effect";

import type { GameEngine } from "~/bridge/game/GameEngine";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { runTileDropAtom } from "~/bridge/tile/runTileDropAtom";
import type { PixiInventoryActorStore } from "~/ui/pixi/actor/PixiInventoryActorStore";
import { createPixiInventoryActorStoreFx } from "~/ui/pixi/actor/createPixiInventoryActorStoreFx";
import type { PixiInventoryDragController } from "~/ui/pixi/drag/PixiInventoryDragController";
import { createPixiInventoryDragControllerFx } from "~/ui/pixi/drag/createPixiInventoryDragControllerFx";
import { createPixiApplicationOwnerFx } from "~/ui/pixi/runtime/createPixiApplicationOwnerFx";
import type { PixiTextureStore } from "~/ui/pixi/runtime/createPixiTextureStoreFx";
import type { PixiInventorySceneRuntime } from "~/ui/pixi/scene/PixiInventorySceneRuntime";
import type { PixiInventorySceneSurface } from "~/ui/pixi/scene/PixiInventorySceneSurface";
import { createPixiInventorySceneSurfaceFx } from "~/ui/pixi/scene/createPixiInventorySceneSurfaceFx";

export namespace createPixiInventorySceneRuntimeFx {
	export interface Props {
		readonly game: GameEngine;
		readonly host: HTMLElement;
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
		readonly onDrop: (command: runTileDropAtom.Command) => PromiseLike<runTileDropAtom.Result>;
		readonly textures: PixiTextureStore;
	}
}

type GameTransition = ReturnType<GameEngine["getTransitionSnapshot"]>;

/** Composes the routed Inventory Pixi owners and their exact disposal order. */
export const createPixiInventorySceneRuntimeFx = Effect.fn("createPixiInventorySceneRuntimeFx")(
	function* ({
		game,
		host,
		onActivate,
		onDrop,
		textures,
	}: createPixiInventorySceneRuntimeFx.Props) {
		const application = yield* createPixiApplicationOwnerFx({
			host,
		});
		let surface: PixiInventorySceneSurface | null = null;
		let actorStore: PixiInventoryActorStore | null = null;
		let drag: PixiInventoryDragController | null = null;
		let removeResizeListener: (() => void) | null = null;
		let appearanceObserver: MutationObserver | null = null;
		let unsubscribeTransitions: (() => void) | null = null;
		let closed = false;
		const ignoreCleanupFailure = (cleanupFx: Effect.Effect<void>) =>
			cleanupFx.pipe(Effect.catchCause(() => Effect.void));
		const closeFx = Effect.gen(function* () {
			if (closed) return;
			closed = true;
			const releaseTransitions = unsubscribeTransitions;
			unsubscribeTransitions = null;
			if (releaseTransitions !== null) {
				yield* ignoreCleanupFailure(Effect.sync(releaseTransitions));
			}
			const observer = appearanceObserver;
			appearanceObserver = null;
			if (observer !== null) {
				yield* ignoreCleanupFailure(Effect.sync(() => observer.disconnect()));
			}
			const releaseResize = removeResizeListener;
			removeResizeListener = null;
			if (releaseResize !== null) {
				yield* ignoreCleanupFailure(Effect.sync(releaseResize));
			}
			if (drag !== null) yield* ignoreCleanupFailure(drag.closeFx);
			if (actorStore !== null) yield* ignoreCleanupFailure(actorStore.closeFx);
			if (surface !== null) yield* ignoreCleanupFailure(surface.closeFx);
			yield* ignoreCleanupFailure(application.closeFx);
		});

		return yield* Effect.gen(function* () {
			const createdSurface = yield* createPixiInventorySceneSurfaceFx({
				application,
				game,
				host,
			});
			surface = createdSurface;
			const createdActorStore = yield* createPixiInventoryActorStoreFx({
				application,
				game,
				surface: createdSurface,
				textures,
			});
			actorStore = createdActorStore;
			let replayCurrentTransition: () => void = () => undefined;
			const createdDrag = yield* createPixiInventoryDragControllerFx({
				actorStore: createdActorStore,
				application,
				game,
				onActivate,
				onAcceptedDropFx: Effect.sync(() => replayCurrentTransition()),
				onDrop,
				surface: createdSurface,
			});
			drag = createdDrag;
			let latestTransition: GameTransition = game.getTransitionSnapshot();

			const reconcile = (transition: GameTransition) => {
				latestTransition = transition;
				const result = RendererRuntime.runSync(createdActorStore.reconcileFx(transition));
				for (const actor of result.removed) {
					RendererRuntime.runSync(createdDrag.removeActorFx(actor));
				}
				RendererRuntime.runSync(createdActorStore.destroyRemovedFx(result.removed));
				for (const actor of result.created) {
					RendererRuntime.runSync(createdDrag.attachActorFx(actor));
				}
				RendererRuntime.runSync(createdDrag.refreshPreviewFx);
			};
			replayCurrentTransition = () => reconcile(game.getTransitionSnapshot());

			const redraw = () => {
				RendererRuntime.runSync(createdSurface.redrawFx);
				reconcile(latestTransition);
			};

			removeResizeListener = yield* application.addResizeListenerFx(redraw);
			redraw();
			appearanceObserver = new MutationObserver(() => {
				RendererRuntime.runSync(createdSurface.refreshPaletteFx);
				reconcile(latestTransition);
				RendererRuntime.runSync(createdActorStore.refreshAppearanceFx);
			});
			appearanceObserver.observe(document.documentElement, {
				attributeFilter: [
					"data-accent",
					"data-theme",
				],
				attributes: true,
			});
			unsubscribeTransitions = game.subscribeTransitions(reconcile);

			return {
				canvas: application.app.canvas,
				cancelInteractionFx: createdDrag.cancelInteractionFx,
				closeFx,
			} satisfies PixiInventorySceneRuntime;
		}).pipe(Effect.onError(() => closeFx));
	},
);
