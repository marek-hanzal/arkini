import { Effect } from "effect";

import type { GameEngine } from "~/playable-game/type/GameEngine";
import type { GameTransition } from "~/game-session/type/GameSession";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { readSpaceActionPresentationPhasesFn } from "~/game-scene/fn/readSpaceActionPresentationPhasesFn";
import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import { readTileActorFeedbackCuesFn } from "~/tile-presentation/fn/readTileActorFeedbackCuesFn";
import type { DropItemCommand } from "~/item-interaction/type/DropItemCommand";
import type { DropItemResult } from "~/item-interaction/type/DropItemResult";
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
import type { InventoryRuntime } from "~/game-scene/service/InventoryRuntime";

interface CreateInventoryRuntimeProps {
	readonly dragThreshold: number;
	readonly game: GameEngine;
	readonly host: HTMLElement;
	readonly onActivateFn: (
		item: TileActorItem,
		openDetail: boolean,
		origin: HTMLElement,
	) => void | PromiseLike<unknown>;
	readonly onDropFn: (command: DropItemCommand) => PromiseLike<DropItemResult>;
	readonly textures: TextureStore;
}

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
	onActivateFn,
	onDropFn,
	textures,
}: CreateInventoryRuntimeProps) {
	const reportCriticalFailureFn = (cause: unknown) =>
		game.reportCriticalFailureFn("game-presentation", cause);
	const application = yield* createApplicationOwnerFx({
		host,
		reportCriticalFailureFn,
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
	let removeResizeListenerFn: (() => void) | null = null;
	let appearanceObserver: MutationObserver | null = null;
	let unsubscribeTransitionsFn: (() => void) | null = null;
	let closed = false;
	const pendingProjectionResumes = new Set<() => void>();
	const processedFeedbackKeys = new Set<string>();
	const ignoreCleanupFailureFx = (cleanupFx: Effect.Effect<void, never, never>) =>
		cleanupFx.pipe(Effect.catchCause(() => Effect.void));
	const closeFx = Effect.gen(function* () {
		if (closed) return;
		closed = true;
		for (const resumeFn of Array.from(pendingProjectionResumes)) resumeFn();
		const releaseTransitionsFn = unsubscribeTransitionsFn;
		unsubscribeTransitionsFn = null;
		if (releaseTransitionsFn !== null) {
			yield* ignoreCleanupFailureFx(Effect.sync(releaseTransitionsFn));
		}
		const observer = appearanceObserver;
		appearanceObserver = null;
		if (observer !== null) {
			yield* ignoreCleanupFailureFx(Effect.sync(() => observer.disconnect()));
		}
		const releaseResizeFn = removeResizeListenerFn;
		removeResizeListenerFn = null;
		if (releaseResizeFn !== null) {
			yield* ignoreCleanupFailureFx(Effect.sync(releaseResizeFn));
		}
		if (drag !== null) yield* ignoreCleanupFailureFx(drag.closeFx);
		if (actorStore !== null) yield* ignoreCleanupFailureFx(actorStore.closeFx);
		processedFeedbackKeys.clear();
		yield* ignoreCleanupFailureFx(animator.closeFx);
		if (dropFeedback !== null) yield* ignoreCleanupFailureFx(dropFeedback.closeFx);
		if (surface !== null) yield* ignoreCleanupFailureFx(surface.closeFx);
		if (particleTextures !== null) {
			yield* ignoreCleanupFailureFx(particleTextures.closeFx);
		}
		yield* ignoreCleanupFailureFx(animationDriver.closeFx);
		yield* ignoreCleanupFailureFx(application.closeFx);
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
		let replayCurrentTransitionFn: () => void = () => undefined;
		const createdDrag = yield* createInventoryDragControllerFx({
			actorStore: createdActorStore,
			animator,
			application,
			dragThreshold,
			game,
			onActivateFn,
			onAcceptedDropFx: Effect.sync(() => replayCurrentTransitionFn()),
			onDropFn,
			surface: createdSurface,
		});
		drag = createdDrag;
		let latestTransition: GameTransition = game.getTransitionSnapshotFn();
		const subscriptionReplayGate = yield* createSubscriptionReplayGateFx(
			latestTransition.sequence,
		);

		const reconcileFn = (transition: GameTransition, presentFeedback: boolean) => {
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
		replayCurrentTransitionFn = () => reconcileFn(game.getTransitionSnapshotFn(), false);

		const redrawFn = () => {
			RendererRuntime.runSync(createdSurface.redrawFx);
			reconcileFn(latestTransition, false);
		};

		removeResizeListenerFn = yield* application.addResizeListenerFx(redrawFn);
		redrawFn();
		appearanceObserver = new MutationObserver(() => {
			RendererRuntime.runSync(createdSurface.refreshPaletteFx);
			reconcileFn(latestTransition, false);
			RendererRuntime.runSync(createdActorStore.refreshAppearanceFx);
		});
		appearanceObserver.observe(document.documentElement, {
			attributeFilter: [
				"data-accent",
				"data-theme",
			],
			attributes: true,
		});
		unsubscribeTransitionsFn = game.subscribeTransitionsFn((transition) => {
			try {
				const delivery = RendererRuntime.runSync(
					subscriptionReplayGate.classifyFx(transition.sequence),
				);
				reconcileFn(transition, delivery === "present");
			} catch (cause) {
				reportCriticalFailureFn(cause);
			}
		});
		const projectSpaceActivationFx = (transition: GameTransition) =>
			Effect.gen(function* () {
				if (closed) return;
				const phases = readSpaceActionPresentationPhasesFn(transition);
				const accounting = phases[0];
				if (accounting?.kind !== "accounting") return;
				if (transition.sequence >= latestTransition.sequence) {
					reconcileFn(accounting.transition, true);
				}
				yield* Effect.callback<void>((resumeEffectFn) => {
					let settled = false;
					let cancelFrameFn: () => void = () => undefined;
					const resumeFn = () => {
						if (settled) return;
						settled = true;
						pendingProjectionResumes.delete(resumeFn);
						cancelFrameFn();
						resumeEffectFn(Effect.void);
					};
					pendingProjectionResumes.add(resumeFn);
					cancelFrameFn = RendererRuntime.runSync(
						application.frames.scheduleAfterRenderFx(resumeFn),
					);
					if (closed) resumeFn();
					return Effect.sync(() => {
						if (settled) return;
						settled = true;
						pendingProjectionResumes.delete(resumeFn);
						cancelFrameFn();
					});
				});
			});

		return {
			canvas: application.app.canvas,
			cancelInteractionFx: createdDrag.cancelInteractionFx,
			projectSpaceActivationFx,
			closeFx,
		} satisfies InventoryRuntime;
	}).pipe(Effect.onError(() => closeFx));
});
