import { Effect } from "effect";

import type { GameEngine } from "~/bridge/game/GameEngine";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import { LocationScopeEnumSchema } from "~/bridge/tile/LocationScopeEnumSchema";
import { readTileActorsFx } from "~/bridge/tile/readTileActorsFx";
import type {
	PixiInventoryActorReconciliation,
	PixiInventoryActorStore,
} from "~/ui/pixi/actor/PixiInventoryActorStore";
import type { PixiTileActorParticleTextures } from "~/ui/pixi/actor/PixiTileActorParticleTextures";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import { createPixiTileActorFx } from "~/ui/pixi/actor/createPixiTileActorFx";
import { readPixiTileActorCrowdAlpha } from "~/ui/pixi/actor/readPixiTileActorCrowdAlpha";
import { destroyPixiTileActorFx } from "~/ui/pixi/actor/destroyPixiTileActorFx";
import { updatePixiTileActorFx } from "~/ui/pixi/actor/updatePixiTileActorFx";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { animatePixiActorToRetargetablePoseFx } from "~/ui/pixi/animation/animatePixiActorToRetargetablePoseFx";
import {
	startPixiTileActorActivityParticlesFx,
	stopPixiTileActorActivityParticlesFx,
} from "~/ui/pixi/animation/runPixiTileActorActivityParticlesFx";
import { startPixiTileActorFadeInFx } from "~/ui/pixi/animation/startPixiTileActorFadeInFx";
import { startPixiInventoryActorRemovalFeedbackFx } from "~/ui/pixi/drag/startPixiInventoryActorRemovalFeedbackFx";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import type { PixiTextureStore } from "~/ui/pixi/runtime/createPixiTextureStoreFx";
import type { PixiInventoryDropTarget } from "~/ui/pixi/scene/PixiInventoryDropTarget";
import type { PixiInventorySceneSurface } from "~/ui/pixi/scene/PixiInventorySceneSurface";

export namespace createPixiInventoryActorStoreFx {
	export interface Props {
		readonly animator: PixiActorAnimator;
		readonly application: PixiApplicationOwner;
		readonly game: GameEngine;
		readonly particleTextures: Pick<PixiTileActorParticleTextures, "star">;
		readonly surface: PixiInventorySceneSurface;
		readonly textures: PixiTextureStore;
	}
}

const sameVisual = (left: TileActorItem, right: TileActorItem) =>
	left.revision === right.revision &&
	left.title === right.title &&
	left.badgeCount === right.badgeCount &&
	left.quantity === right.quantity &&
	left.sourceUrl === right.sourceUrl &&
	left.compositeUrl === right.compositeUrl &&
	left.running === right.running &&
	left.activityEffect === right.activityEffect &&
	left.progressRatio === right.progressRatio;

/** Owns retained Inventory actors and their canonical transition reconciliation. */
export const createPixiInventoryActorStoreFx = Effect.fn("createPixiInventoryActorStoreFx")(
	({
		animator,
		application,
		game,
		particleTextures,
		surface,
		textures,
	}: createPixiInventoryActorStoreFx.Props) =>
		Effect.sync((): PixiInventoryActorStore => {
			const actors = new Map<string, PixiTileActor>();
			const exitingActors = new Set<PixiTileActor>();
			let closed = false;
			let hydrated = false;

			const updateActor = (actor: PixiTileActor, item: TileActorItem, size: number) => {
				RendererRuntime.runSync(
					updatePixiTileActorFx({
						actor,
						animator,
						frames: application.frames,
						item,
						palette: RendererRuntime.runSync(surface.readPaletteFx),
						size,
						textures,
					}),
				);
			};

			return {
				closeFx: Effect.gen(function* () {
					if (closed) return;
					closed = true;
					for (const actor of new Set([
						...actors.values(),
						...exitingActors,
					])) {
						yield* animator.cancelActorFx(actor);
						yield* destroyPixiTileActorFx(actor);
					}
					actors.clear();
					exitingActors.clear();
				}),
				destroyRemovedFx: Effect.fn("PixiInventoryActorStore.destroyRemovedFx")((removed) =>
					Effect.forEach(
						removed,
						(actor) =>
							Effect.gen(function* () {
								if (closed || actor.container.destroyed || exitingActors.has(actor))
									return;
								exitingActors.add(actor);
								yield* startPixiInventoryActorRemovalFeedbackFx({
									actor,
									animator,
									onComplete: () => {
										if (!exitingActors.delete(actor)) return;
										RendererRuntime.runSync(animator.cancelActorFx(actor));
										RendererRuntime.runSync(destroyPixiTileActorFx(actor));
									},
								});
							}),
						{
							discard: true,
						},
					),
				),
				readActorFx: Effect.fn("PixiInventoryActorStore.readActorFx")((itemId) =>
					Effect.sync(() => actors.get(itemId) ?? null),
				),
				readOccupantFx: Effect.fn("PixiInventoryActorStore.readOccupantFx")(
					(target: PixiInventoryDropTarget) =>
						Effect.sync(() => {
							for (const actor of actors.values()) {
								const location = actor.item.location;
								if (
									location.scope === LocationScopeEnumSchema.enum.Inventory &&
									location.position.x === target.x &&
									location.position.y === target.y
								) {
									return actor.item;
								}
							}
							return null;
						}),
				),
				reconcileFx: Effect.fn("PixiInventoryActorStore.reconcileFx")((transition) =>
					Effect.sync((): PixiInventoryActorReconciliation => {
						if (closed) {
							return {
								created: [],
								items: [],
								removed: [],
							};
						}
						let changed = false;
						const created: PixiTileActor[] = [];
						const removed: PixiTileActor[] = [];
						const nextItems = game.readOrThrow(
							readTileActorsFx({
								game,
								runtime: transition.runtime,
								surface: "inventory",
							}),
						);
						const nextIds = new Set(nextItems.map((item) => item.id));
						for (const [id, actor] of actors) {
							if (nextIds.has(id)) continue;
							actors.delete(id);
							removed.push(actor);
							changed = true;
						}
						const actorSize = RendererRuntime.runSync(surface.readActorSizeFx);
						for (const item of nextItems) {
							const pose = RendererRuntime.runSync(surface.readActorPoseFx(item));
							if (pose === null) continue;
							let actor = actors.get(item.id);
							const createdNow = actor === undefined;
							if (actor === undefined) {
								changed = true;
								actor = RendererRuntime.runSync(
									createPixiTileActorFx({
										frames: application.frames,
										item,
										palette: RendererRuntime.runSync(surface.readPaletteFx),
										particleTextures,
										textures,
									}),
								);
								actors.set(item.id, actor);
								surface.actorLayer.addChild(actor.container);
								created.push(actor);
							}
							const crowdAlphaChanged =
								readPixiTileActorCrowdAlpha(actor.item) !==
								readPixiTileActorCrowdAlpha(item);
							const activityEffectChanged =
								actor.item.activityEffect !== item.activityEffect;
							const sizeChanged = actor.size !== actorSize;
							const previousDisplayedSize = actor.size * actor.container.scale.x;
							const reconciledSize = actor.dragging ? actor.size : actorSize;
							if (
								!sameVisual(actor.currentVisual.item, item) ||
								actor.size !== reconciledSize
							) {
								changed = true;
								updateActor(actor, item, reconciledSize);
							} else {
								actor.item = item;
							}
							if (crowdAlphaChanged) {
								RendererRuntime.runSync(
									animator.animateFx({
										actor,
										channel: "crowd-opacity",
										durationMs: 180,
										ownerKey: `running:${item.id}`,
										toCrowdAlpha: readPixiTileActorCrowdAlpha(item),
									}),
								);
							}
							if (activityEffectChanged) {
								RendererRuntime.runSync(
									(item.activityEffect
										? startPixiTileActorActivityParticlesFx
										: stopPixiTileActorActivityParticlesFx)({
										actor,
										animator,
									}),
								);
							}
							if (createdNow) {
								RendererRuntime.runSync(
									animator.setFx({
										actor,
										channel: "pose",
										scale: 1,
										x: pose.x,
										y: pose.y,
									}),
								);
								if (hydrated) {
									RendererRuntime.runSync(
										animator.setFx({
											actor,
											alpha: 0,
											channel: "lifecycle-opacity",
										}),
									);
									RendererRuntime.runSync(
										startPixiTileActorFadeInFx({
											actor,
											animator,
										}),
									);
								} else {
									RendererRuntime.runSync(
										animator.setFx({
											actor,
											alpha: 1,
											channel: "lifecycle-opacity",
										}),
									);
								}
								if (item.activityEffect) {
									RendererRuntime.runSync(
										startPixiTileActorActivityParticlesFx({
											actor,
											animator,
										}),
									);
								}
								continue;
							}
							if (actor.dragging) continue;
							if (actor.container.x !== pose.x || actor.container.y !== pose.y) {
								changed = true;
							}
							if (sizeChanged) {
								RendererRuntime.runSync(
									animator.setFx({
										actor,
										channel: "pose",
										scale: previousDisplayedSize / Math.max(1, actor.size),
										x: actor.container.x,
										y: actor.container.y,
									}),
								);
							}
							if (
								actor.container.x !== pose.x ||
								actor.container.y !== pose.y ||
								actor.container.scale.x !== 1
							) {
								RendererRuntime.runSync(
									animatePixiActorToRetargetablePoseFx({
										actor,
										animator,
										readSize: () =>
											RendererRuntime.runSync(surface.readActorSizeFx),
										readTarget: () =>
											RendererRuntime.runSync(
												surface.readActorPoseFx(actor.item),
											),
										target: pose,
									}),
								);
							}
						}
						hydrated = true;
						if (changed) RendererRuntime.runSync(application.frames.invalidateFx);
						return {
							created,
							items: nextItems,
							removed,
						};
					}),
				),
				refreshAppearanceFx: Effect.gen(function* () {
					const actorSize = yield* surface.readActorSizeFx;
					for (const actor of actors.values()) {
						updateActor(actor, actor.item, actorSize);
					}
				}),
			};
		}),
);
