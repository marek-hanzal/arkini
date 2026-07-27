import { Effect } from "effect";

import type { GameEngine } from "~/bridge/game/GameEngine";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import { readTileActorFeedbackCuesFx } from "~/bridge/tile/feedback/readTileActorFeedbackCuesFx";
import type { runTileDropAtom } from "~/bridge/tile/runTileDropAtom";
import type { PixiInventoryActorStore } from "~/ui/pixi/actor/PixiInventoryActorStore";
import type { PixiTileActorParticleTextures } from "~/ui/pixi/actor/PixiTileActorParticleTextures";
import { createPixiInventoryActorStoreFx } from "~/ui/pixi/actor/createPixiInventoryActorStoreFx";
import { createPixiTileActorParticleTexturesFx } from "~/ui/pixi/actor/createPixiTileActorParticleTexturesFx";
import { createPixiActorAnimatorFx } from "~/ui/pixi/animation/createPixiActorAnimatorFx";
import { createPixiAnimationDriverFx } from "~/ui/pixi/animation/createPixiAnimationDriverFx";
import { createPixiGridDropFeedbackFx } from "~/ui/pixi/grid/createPixiGridDropFeedbackFx";
import { flashPixiTileActorConsumedSourceFx } from "~/ui/pixi/animation/flashPixiTileActorConsumedSourceFx";
import type { PixiInventoryDragController } from "~/ui/pixi/drag/PixiInventoryDragController";
import { createPixiInventoryDragControllerFx } from "~/ui/pixi/drag/createPixiInventoryDragControllerFx";
import type { PixiGridDropFeedback } from "~/ui/pixi/grid/PixiGridDropFeedback";
import { createPixiApplicationOwnerFx } from "~/ui/pixi/runtime/createPixiApplicationOwnerFx";
import type { PixiTextureStore } from "~/ui/pixi/runtime/createPixiTextureStoreFx";
import type { PixiInventorySceneRuntime } from "~/ui/pixi/scene/PixiInventorySceneRuntime";
import type { PixiInventorySceneSurface } from "~/ui/pixi/scene/PixiInventorySceneSurface";
import { createPixiInventorySceneSurfaceFx } from "~/ui/pixi/scene/createPixiInventorySceneSurfaceFx";
import { createPixiMainSceneSubscriptionReplayGateFx } from "~/ui/pixi/scene/createPixiMainSceneSubscriptionReplayGateFx";

export namespace createPixiInventorySceneRuntimeFx {
	export interface Props {
		readonly game: GameEngine;
		readonly host: HTMLElement;
		readonly onActivate: (
			item: TileActorItem,
			openDetail: boolean,
			origin: HTMLElement,
		) => void | PromiseLike<unknown>;
		readonly onDrop: (command: runTileDropAtom.Command) => PromiseLike<runTileDropAtom.Result>;
		readonly textures: PixiTextureStore;
	}
}

type GameTransition = ReturnType<GameEngine["getTransitionSnapshot"]>;

/**
 * Composes the routed Inventory canvas without sharing display objects with the main scene.
 *
 * Subscription and DOM observers stop first, then drag releases actors before their store,
 * surface, and application disappear. The same close path rolls back partial acquisition.
 */
export const createPixiInventorySceneRuntimeFx = Effect.fn("createPixiInventorySceneRuntimeFx")(
	function* ({
		game,
		host,
		onActivate,
		onDrop,
		textures,
	}: createPixiInventorySceneRuntimeFx.Props) {
		const reportCriticalFailure = (cause: unknown) =>
			game.reportCriticalFailure("game-presentation", cause);
		const application = yield* createPixiApplicationOwnerFx({
			host,
			reportCriticalFailure,
		});
		const animationDriver = yield* createPixiAnimationDriverFx({
			frames: application.frames,
		});
		const animator = yield* createPixiActorAnimatorFx({
			animationDriver,
			frames: application.frames,
		});
		let surface: PixiInventorySceneSurface | null = null;
		let dropFeedback: PixiGridDropFeedback | null = null;
		let actorStore: PixiInventoryActorStore | null = null;
		let particleTextures: PixiTileActorParticleTextures | null = null;
		let drag: PixiInventoryDragController | null = null;
		let removeResizeListener: (() => void) | null = null;
		let appearanceObserver: MutationObserver | null = null;
		let unsubscribeTransitions: (() => void) | null = null;
		let closed = false;
		const processedFeedbackKeys = new Set<string>();
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
			processedFeedbackKeys.clear();
			yield* ignoreCleanupFailure(animator.closeFx);
			if (dropFeedback !== null) yield* ignoreCleanupFailure(dropFeedback.closeFx);
			if (surface !== null) yield* ignoreCleanupFailure(surface.closeFx);
			if (particleTextures !== null) {
				yield* ignoreCleanupFailure(particleTextures.closeFx);
			}
			yield* ignoreCleanupFailure(animationDriver.closeFx);
			yield* ignoreCleanupFailure(application.closeFx);
		});

		return yield* Effect.gen(function* () {
			const createdDropFeedback = yield* createPixiGridDropFeedbackFx({
				animationDriver,
				label: "InventoryDropFeedback",
			});
			dropFeedback = createdDropFeedback;
			const createdSurface = yield* createPixiInventorySceneSurfaceFx({
				application,
				dropFeedback: createdDropFeedback,
				game,
				host,
			});
			surface = createdSurface;
			const createdParticleTextures = yield* createPixiTileActorParticleTexturesFx();
			particleTextures = createdParticleTextures;
			const createdActorStore = yield* createPixiInventoryActorStoreFx({
				animator,
				application,
				game,
				particleTextures: createdParticleTextures,
				surface: createdSurface,
				textures,
			});
			actorStore = createdActorStore;
			let replayCurrentTransition: () => void = () => undefined;
			const createdDrag = yield* createPixiInventoryDragControllerFx({
				actorStore: createdActorStore,
				animator,
				application,
				game,
				onActivate,
				onAcceptedDropFx: Effect.sync(() => replayCurrentTransition()),
				onDrop,
				surface: createdSurface,
			});
			drag = createdDrag;
			let latestTransition: GameTransition = game.getTransitionSnapshot();
			const subscriptionReplayGate = yield* createPixiMainSceneSubscriptionReplayGateFx(
				latestTransition.sequence,
			);

			const reconcile = (transition: GameTransition, presentFeedback: boolean) => {
				latestTransition = transition;
				const result = RendererRuntime.runSync(createdActorStore.reconcileFx(transition));
				for (const actor of result.removed) {
					RendererRuntime.runSync(createdDrag.removeActorFx(actor));
				}
				RendererRuntime.runSync(createdActorStore.destroyRemovedFx(result.removed));
				for (const actor of result.created) {
					RendererRuntime.runSync(createdDrag.attachActorFx(actor));
				}
				if (presentFeedback) {
					const cues = RendererRuntime.runSync(readTileActorFeedbackCuesFx(transition));
					for (const cue of cues) {
						if (cue.kind !== "consume-source" || processedFeedbackKeys.has(cue.key)) {
							continue;
						}
						const source = RendererRuntime.runSync(
							createdActorStore.readActorFx(cue.actorId),
						);
						if (source === null) continue;
						processedFeedbackKeys.add(cue.key);
						RendererRuntime.runSync(
							flashPixiTileActorConsumedSourceFx({
								actor: source,
								animator,
							}),
						);
					}
					while (processedFeedbackKeys.size > 256) {
						const oldest = processedFeedbackKeys.values().next().value;
						if (oldest === undefined) break;
						processedFeedbackKeys.delete(oldest);
					}
				}
				RendererRuntime.runSync(createdDrag.refreshPreviewFx);
			};
			replayCurrentTransition = () => reconcile(game.getTransitionSnapshot(), false);

			const redraw = () => {
				RendererRuntime.runSync(createdSurface.redrawFx);
				reconcile(latestTransition, false);
			};

			removeResizeListener = yield* application.addResizeListenerFx(redraw);
			redraw();
			appearanceObserver = new MutationObserver(() => {
				RendererRuntime.runSync(createdSurface.refreshPaletteFx);
				reconcile(latestTransition, false);
				RendererRuntime.runSync(createdActorStore.refreshAppearanceFx);
			});
			appearanceObserver.observe(document.documentElement, {
				attributeFilter: [
					"data-accent",
					"data-theme",
				],
				attributes: true,
			});
			unsubscribeTransitions = game.subscribeTransitions((transition) => {
				try {
					const delivery = RendererRuntime.runSync(
						subscriptionReplayGate.classifyFx(transition.sequence),
					);
					reconcile(transition, delivery === "present");
				} catch (cause) {
					reportCriticalFailure(cause);
				}
			});

			return {
				canvas: application.app.canvas,
				cancelInteractionFx: createdDrag.cancelInteractionFx,
				closeFx,
			} satisfies PixiInventorySceneRuntime;
		}).pipe(Effect.onError(() => closeFx));
	},
);
