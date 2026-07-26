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
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import { createPixiTileActorFx } from "~/ui/pixi/actor/createPixiTileActorFx";
import { destroyPixiTileActorFx } from "~/ui/pixi/actor/destroyPixiTileActorFx";
import { updatePixiTileActorFx } from "~/ui/pixi/actor/updatePixiTileActorFx";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import type { PixiTextureStore } from "~/ui/pixi/runtime/createPixiTextureStoreFx";
import type { PixiInventoryDropTarget } from "~/ui/pixi/scene/PixiInventoryDropTarget";
import type { PixiInventorySceneSurface } from "~/ui/pixi/scene/PixiInventorySceneSurface";

export namespace createPixiInventoryActorStoreFx {
	export interface Props {
		readonly application: PixiApplicationOwner;
		readonly game: GameEngine;
		readonly surface: PixiInventorySceneSurface;
		readonly textures: PixiTextureStore;
	}
}

const sameVisual = (left: TileActorItem, right: TileActorItem) =>
	left.revision === right.revision &&
	left.title === right.title &&
	left.quantity === right.quantity &&
	left.sourceUrl === right.sourceUrl &&
	left.compositeUrl === right.compositeUrl &&
	left.running === right.running;

/** Owns retained Inventory actors and their canonical transition reconciliation. */
export const createPixiInventoryActorStoreFx = Effect.fn("createPixiInventoryActorStoreFx")(
	({ application, game, surface, textures }: createPixiInventoryActorStoreFx.Props) =>
		Effect.sync((): PixiInventoryActorStore => {
			const actors = new Map<string, PixiTileActor>();
			let closed = false;

			const updateActor = (actor: PixiTileActor, item: TileActorItem, size: number) => {
				RendererRuntime.runSync(
					updatePixiTileActorFx({
						actor,
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
					for (const actor of actors.values()) yield* destroyPixiTileActorFx(actor);
					actors.clear();
				}),
				destroyRemovedFx: Effect.fn("PixiInventoryActorStore.destroyRemovedFx")((removed) =>
					Effect.forEach(removed, destroyPixiTileActorFx, {
						discard: true,
					}),
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
							if (actor === undefined) {
								changed = true;
								actor = RendererRuntime.runSync(
									createPixiTileActorFx({
										frames: application.frames,
										item,
										palette: RendererRuntime.runSync(surface.readPaletteFx),
										textures,
									}),
								);
								actors.set(item.id, actor);
								surface.actorLayer.addChild(actor.container);
								created.push(actor);
							}
							if (!sameVisual(actor.item, item) || actor.size !== actorSize) {
								changed = true;
								updateActor(actor, item, actorSize);
							} else {
								actor.item = item;
							}
							if (actor.dragging) continue;
							if (actor.container.x !== pose.x || actor.container.y !== pose.y) {
								changed = true;
							}
							actor.container.x = pose.x;
							actor.container.y = pose.y;
						}
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
