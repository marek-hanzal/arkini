import { Effect } from "effect";

import type { GameEngine } from "~/renderer/game/GameEngine";
import { RendererRuntime } from "~/application-runtime/RendererRuntime";
import type { TileActorItem } from "~/ui/pixi/actor/TileActorItem";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { readTileActorsFx } from "~/ui/pixi/actor/readTileActorsFx";
import type {
	InventoryReconciliation,
	InventoryActorStore,
} from "~/ui/pixi/actor/InventoryActorStore";
import type { ParticleTextures } from "~/ui/pixi/actor/ParticleTextures";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import { createTileActorFx } from "~/ui/pixi/actor/createTileActorFx";
import { readCrowdAlphaFn } from "~/ui/pixi/actor/fn/readCrowdAlphaFn";
import { destroyTileActorFx } from "~/ui/pixi/actor/destroyTileActorFx";
import { updateTileActorFx } from "~/ui/pixi/actor/updateTileActorFx";
import type { ActorAnimator } from "~/ui/pixi/animation/ActorAnimator";
import { animateRetargetablePoseFx } from "~/ui/pixi/animation/animateRetargetablePoseFx";
import { startActivityParticlesFx } from "~/ui/pixi/animation/startActivityParticlesFx";
import { stopActivityParticlesFx } from "~/ui/pixi/animation/stopActivityParticlesFx";
import { restoreActorExitFx } from "~/ui/pixi/animation/restoreActorExitFx";
import { startActorEnterFx } from "~/ui/pixi/animation/startActorEnterFx";
import { startActorExitFx } from "~/ui/pixi/animation/startActorExitFx";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import type { TextureStore } from "~/ui/pixi/runtime/createTextureStoreFx";
import type { InventoryDropTarget } from "~/ui/pixi/scene/InventoryDropTarget";
import type { InventorySurface } from "~/ui/pixi/scene/InventorySurface";

export namespace createInventoryActorStoreFx {
	export interface Props {
		readonly animator: ActorAnimator;
		readonly application: PixiApplicationOwner;
		readonly game: GameEngine;
		readonly particleTextures: Pick<ParticleTextures, "star">;
		readonly surface: InventorySurface;
		readonly textures: TextureStore;
	}
}

const sameVisual = (left: TileActorItem, right: TileActorItem) =>
	left.revision === right.revision &&
	left.title === right.title &&
	left.badgeCount === right.badgeCount &&
	left.badgeKind === right.badgeKind &&
	left.quantity === right.quantity &&
	left.sourceUrl === right.sourceUrl &&
	left.compositeUrl === right.compositeUrl &&
	left.running === right.running &&
	left.activityEffect === right.activityEffect &&
	left.progressRatio === right.progressRatio;

/** Owns retained Inventory actors and their canonical transition reconciliation. */
export const createInventoryActorStoreFx = Effect.fn("createInventoryActorStoreFx")(
	({
		animator,
		application,
		game,
		particleTextures,
		surface,
		textures,
	}: createInventoryActorStoreFx.Props) =>
		Effect.sync((): InventoryActorStore => {
			const actors = new Map<string, PixiTileActor>();
			const exitingActors = new Map<string, PixiTileActor>();
			let closed = false;
			let hydrated = false;

			const updateActor = (actor: PixiTileActor, item: TileActorItem, size: number) => {
				RendererRuntime.runSync(
					updateTileActorFx({
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
						...exitingActors.values(),
					])) {
						yield* animator.cancelActorFx(actor);
						yield* destroyTileActorFx(actor);
					}
					actors.clear();
					exitingActors.clear();
				}),
				destroyRemovedFx: Effect.fn("InventoryActorStore.destroyRemovedFx")((removed) =>
					Effect.forEach(
						removed,
						(actor) =>
							Effect.gen(function* () {
								const actorId = actor.item.id;
								if (
									closed ||
									actor.container.destroyed ||
									exitingActors.has(actorId)
								)
									return;
								exitingActors.set(actorId, actor);
								yield* startActorExitFx({
									actor,
									animator,
									onComplete: () => {
										if (exitingActors.get(actorId) !== actor) return;
										exitingActors.delete(actorId);
										RendererRuntime.runSync(animator.cancelActorFx(actor));
										RendererRuntime.runSync(destroyTileActorFx(actor));
									},
								});
							}),
						{
							discard: true,
						},
					),
				),
				readActorFx: Effect.fn("InventoryActorStore.readActorFx")((itemId) =>
					Effect.sync(() => actors.get(itemId) ?? null),
				),
				readOccupantFx: Effect.fn("InventoryActorStore.readOccupantFx")(
					(target: InventoryDropTarget) =>
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
				reconcileFx: Effect.fn("InventoryActorStore.reconcileFx")((transition) =>
					Effect.sync((): InventoryReconciliation => {
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
							const exiting =
								actor === undefined ? exitingActors.get(item.id) : undefined;
							if (exiting !== undefined) {
								exitingActors.delete(item.id);
								if (!exiting.container.destroyed) {
									actor = exiting;
									actors.set(item.id, actor);
									surface.actorLayer.addChild(actor.container);
									created.push(actor);
									changed = true;
									RendererRuntime.runSync(
										restoreActorExitFx({
											actor,
											animator,
										}),
									);
								}
							}
							const createdNow = actor === undefined;
							if (actor === undefined) {
								changed = true;
								actor = RendererRuntime.runSync(
									createTileActorFx({
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
								readCrowdAlphaFn(actor.item) !== readCrowdAlphaFn(item);
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
										toCrowdAlpha: readCrowdAlphaFn(item),
									}),
								);
							}
							if (activityEffectChanged) {
								RendererRuntime.runSync(
									(item.activityEffect
										? startActivityParticlesFx
										: stopActivityParticlesFx)({
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
										startActorEnterFx({
											actor,
											animator,
										}),
									);
								}
								if (item.activityEffect) {
									RendererRuntime.runSync(
										startActivityParticlesFx({
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
									animateRetargetablePoseFx({
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
