import { Effect } from "effect";
import type { Texture } from "pixi.js";

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
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { createPixiRetargetablePoseSamplerFx } from "~/ui/pixi/animation/createPixiRetargetablePoseSamplerFx";
import { readPixiTileTravelDurationMsFx } from "~/ui/pixi/animation/readPixiTileTravelDurationMsFx";
import {
	startPixiTileActorRunningGlowFx,
	stopPixiTileActorRunningGlowFx,
} from "~/ui/pixi/animation/runPixiTileActorRunningGlowFx";
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
		readonly runningGlowTexture: Texture;
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
	left.running === right.running &&
	left.runningGlow === right.runningGlow;

/** Owns retained Inventory actors and their canonical transition reconciliation. */
export const createPixiInventoryActorStoreFx = Effect.fn("createPixiInventoryActorStoreFx")(
	({
		animator,
		application,
		game,
		runningGlowTexture,
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
										runningGlowTexture,
										textures,
									}),
								);
								actors.set(item.id, actor);
								surface.actorLayer.addChild(actor.container);
								created.push(actor);
							}
							const runningChanged = actor.item.running !== item.running;
							const runningGlowChanged = actor.item.runningGlow !== item.runningGlow;
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
							if (runningChanged) {
								RendererRuntime.runSync(
									animator.animateFx({
										actor,
										channel: "crowd-opacity",
										durationMs: 180,
										ownerKey: `running:${item.id}`,
										toCrowdAlpha: item.running ? 0.82 : 1,
									}),
								);
							}
							if (runningGlowChanged) {
								RendererRuntime.runSync(
									(item.runningGlow
										? startPixiTileActorRunningGlowFx
										: stopPixiTileActorRunningGlowFx)({
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
								if (item.runningGlow) {
									RendererRuntime.runSync(
										startPixiTileActorRunningGlowFx({
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
								const durationMs = RendererRuntime.runSync(
									readPixiTileTravelDurationMsFx({
										fromX: actor.container.x,
										fromY: actor.container.y,
										tileSize: actor.size,
										toX: pose.x,
										toY: pose.y,
									}),
								);
								const readPose = RendererRuntime.runSync(
									createPixiRetargetablePoseSamplerFx({
										from: {
											scale: actor.container.scale.x,
											x: actor.container.x,
											y: actor.container.y,
										},
										readTarget: () => {
											const latest =
												RendererRuntime.runSync(
													surface.readActorPoseFx(actor.item),
												) ?? pose;
											return {
												scale:
													RendererRuntime.runSync(
														surface.readActorSizeFx,
													) / Math.max(1, actor.size),
												x: latest.x,
												y: latest.y,
											};
										},
									}),
								);
								RendererRuntime.runSync(
									animator.animateFx({
										actor,
										channel: "pose",
										durationMs,
										readPose,
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
