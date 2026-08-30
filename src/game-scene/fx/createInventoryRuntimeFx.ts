import { Effect } from "effect";

import type { GameEngine } from "~/renderer/game/GameEngine";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { readSpaceActionPresentationPhasesFn } from "~/game-scene/fn/readSpaceActionPresentationPhasesFn";
import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import { readTileActorFeedbackCuesFn } from "~/tile-presentation/fn/readTileActorFeedbackCuesFn";
import type { runTileDropAtom } from "~/tile-interaction/atom/runTileDropAtom";
import type { InventoryActorStore } from "~/game-scene/service/InventoryActorStore";
import type { ParticleTextures } from "~/tile-rendering/service/ParticleTextures";
import { createInventoryActorStoreFx } from "~/game-scene/fx/createInventoryActorStoreFx";
import { createParticleTexturesFx } from "~/tile-rendering/fx/createParticleTexturesFx";
import { createActorAnimatorFx } from "~/tile-rendering/fx/createActorAnimatorFx";
import { createAnimationDriverFx } from "~/tile-rendering/fx/createAnimationDriverFx";
import { createDropFeedbackFx } from "~/game-scene/fx/createDropFeedbackFx";
import { flashConsumedSourceFx } from "~/tile-rendering/fx/flashConsumedSourceFx";
import type { InventoryDragController } from "~/tile-interaction/fx/createInventoryDragControllerFx";
import { createInventoryDragControllerFx } from "~/tile-interaction/fx/createInventoryDragControllerFx";
import type { DropFeedback } from "~/game-scene/service/DropFeedback";
import { createApplicationOwnerFx } from "~/tile-rendering/fx/createApplicationOwnerFx";
import type { TextureStore } from "~/tile-rendering/fx/createTextureStoreFx";
import type { InventorySurface } from "~/game-scene/service/InventorySurface";
import { createInventorySurfaceFx } from "~/game-scene/fx/createInventorySurfaceFx";
import { createSubscriptionReplayGateFx } from "~/game-scene/fx/createSubscriptionReplayGateFx";

interface CreateInventoryRuntimeProps {
	readonly dragThreshold: number;
	readonly game: GameEngine;
	readonly host: HTMLElement;
	readonly onActivate: (
		item: TileActorItem,
		openDetail: boolean,
		origin: HTMLElement,
	) => void | PromiseLike<unknown>;
	readonly onDrop: (command: runTileDropAtom.Command) => PromiseLike<runTileDropAtom.Result>;
	readonly textures: TextureStore;
}

type GameTransition = ReturnType<GameEngine["getTransitionSnapshot"]>;

/**
 * Composes the routed Inventory canvas without sharing display objects with the main scene.
 *
 * Subscription and DOM observers stop first, then drag releases actors before their store,
 * surface, and application disappear. The same close path rolls back partial acquisition.
 */
export const createInventoryRuntimeFx = Effect.fn("createInventoryRuntimeFx")(function* ({
	dragThreshold,
	game,
	host,
	onActivate,
	onDrop,
	textures,
}: CreateInventoryRuntimeProps) {
	const reportCriticalFailure = (cause: unknown) =>
		game.reportCriticalFailure("game-presentation", cause);
	const application = yield* createApplicationOwnerFx({
		host,
		reportCriticalFailure,
	});
	const animationDriver = yield* createAnimationDriverFx({
		frames: application.frames,
	});
	const animator = yield* createActorAnimatorFx({
		animationDriver,
		frames: application.frames,
	});
	let surface: InventorySurface | null = null;
	let dropFeedback: DropFeedback | null = null;
	let actorStore: InventoryActorStore | null = null;
	let particleTextures: ParticleTextures | null = null;
	let drag: InventoryDragController | null = null;
	let removeResizeListener: (() => void) | null = null;
	let appearanceObserver: MutationObserver | null = null;
	let unsubscribeTransitions: (() => void) | null = null;
	let closed = false;
	const pendingProjectionResumes = new Set<() => void>();
	const processedFeedbackKeys = new Set<string>();
	const ignoreCleanupFailure = (cleanupFx: Effect.Effect<void>) =>
		cleanupFx.pipe(Effect.catchCause(() => Effect.void));
	const closeFx = Effect.gen(function* () {
		if (closed) return;
		closed = true;
		for (const resume of Array.from(pendingProjectionResumes)) resume();
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
		const createdDropFeedback = yield* createDropFeedbackFx({
			animationDriver,
			label: "InventoryDropFeedback",
		});
		dropFeedback = createdDropFeedback;
		const createdSurface = yield* createInventorySurfaceFx({
			application,
			dropFeedback: createdDropFeedback,
			game,
			host,
		});
		surface = createdSurface;
		const createdParticleTextures = yield* createParticleTexturesFx();
		particleTextures = createdParticleTextures;
		const createdActorStore = yield* createInventoryActorStoreFx({
			animator,
			application,
			game,
			particleTextures: createdParticleTextures,
			surface: createdSurface,
			textures,
		});
		actorStore = createdActorStore;
		let replayCurrentTransition: () => void = () => undefined;
		const createdDrag = yield* createInventoryDragControllerFx({
			actorStore: createdActorStore,
			animator,
			application,
			dragThreshold,
			game,
			onActivate,
			onAcceptedDropFx: Effect.sync(() => replayCurrentTransition()),
			onDrop,
			surface: createdSurface,
		});
		drag = createdDrag;
		let latestTransition: GameTransition = game.getTransitionSnapshot();
		const subscriptionReplayGate = yield* createSubscriptionReplayGateFx(
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
				const cues = readTileActorFeedbackCuesFn(transition);
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
						flashConsumedSourceFx({
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
		const projectSpaceActivationFx = (transition: GameTransition) =>
			Effect.gen(function* () {
				if (closed) return;
				const phases = readSpaceActionPresentationPhasesFn(transition);
				const accounting = phases[0];
				if (accounting?.kind !== "accounting") return;
				if (transition.sequence >= latestTransition.sequence) {
					reconcile(accounting.transition, true);
				}
				yield* Effect.callback<void>((resumeEffect) => {
					let settled = false;
					let cancelFrame: () => void = () => undefined;
					const resume = () => {
						if (settled) return;
						settled = true;
						pendingProjectionResumes.delete(resume);
						cancelFrame();
						resumeEffect(Effect.void);
					};
					pendingProjectionResumes.add(resume);
					cancelFrame = RendererRuntime.runSync(
						application.frames.scheduleAfterRenderFx(resume),
					);
					if (closed) resume();
					return Effect.sync(() => {
						if (settled) return;
						settled = true;
						pendingProjectionResumes.delete(resume);
						cancelFrame();
					});
				});
			});

		return {
			canvas: application.app.canvas,
			cancelInteractionFx: createdDrag.cancelInteractionFx,
			projectSpaceActivationFx,
			closeFx,
		};
	}).pipe(Effect.onError(() => closeFx));
});
