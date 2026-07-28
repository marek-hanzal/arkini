import { Effect } from "effect";

import type { GameEngine } from "~/bridge/game/GameEngine";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { TileDelivery } from "~/bridge/tile/readTileDeliveriesFx";
import { settleTileDeliveryFx } from "~/bridge/tile/settleTileDeliveryFx";
import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiTileActorParticleTextures } from "~/ui/pixi/actor/PixiTileActorParticleTextures";
import { createPixiTileActorFx } from "~/ui/pixi/actor/createPixiTileActorFx";
import { updatePixiTileActorFx } from "~/ui/pixi/actor/updatePixiTileActorFx";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { startPixiTileActorRemovalFeedbackFx } from "~/ui/pixi/animation/startPixiTileActorRemovalFeedbackFx";
import { startPixiTileActorRemainderFeedbackFx } from "~/ui/pixi/animation/startPixiTileActorRemainderFeedbackFx";
import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";
import type { PixiDeliveryMotionRuntime } from "~/ui/pixi/delivery/PixiDeliveryMotionRuntime";
import type { PixiMainSceneDragController } from "~/ui/pixi/drag/PixiMainSceneDragController";
import type { PixiTileMagneticField } from "~/ui/pixi/magnet/PixiTileMagneticField";
import { chasePixiTileMotionTargetFx } from "~/ui/pixi/motion/chasePixiTileMotionTargetFx";
import { createPixiTileMotionMagneticProjectorFx } from "~/ui/pixi/motion/createPixiTileMotionMagneticProjectorFx";
import { flashPixiMotionTargetFx } from "~/ui/pixi/motion/flashPixiMotionTargetFx";
import { readPixiLiveActorContactPose } from "~/ui/pixi/motion/readPixiLiveActorContactPose";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import type { PixiTextureStore } from "~/ui/pixi/runtime/createPixiTextureStoreFx";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";
import type { PixiTileActorPose } from "~/ui/pixi/scene/PixiTileActorPose";

export namespace createPixiDeliveryMotionRuntimeFx {
	export interface Props {
		readonly actorStore: PixiMainSceneActorStore;
		readonly animator: PixiActorAnimator;
		readonly application: PixiApplicationOwner;
		readonly drag: PixiMainSceneDragController;
		readonly game: GameEngine;
		readonly magneticField: PixiTileMagneticField;
		readonly particleTextures: PixiTileActorParticleTextures;
		readonly readPalette: () => PixiScenePalette;
		readonly surface: PixiMainSceneSurface;
		readonly textures: PixiTextureStore;
	}
}

interface ActiveDelivery {
	readonly actor: PixiTileActor;
	delivery: TileDelivery;
	readonly generation: number;
	releaseMagnet: () => void;
	stage:
		| "awaiting-return-geometry"
		| "awaiting-travel-geometry"
		| "consuming"
		| "contact-fade-in"
		| "contact-fade-out"
		| "settling"
		| "traveling";
	target: PixiTileActorPose | null;
}

const deliveryOutboundCurve = {
	bounce: 0.1,
	kind: "spring",
} as const;
const deliveryReturnCurve = {
	bounce: 0.22,
	kind: "spring",
} as const;

/**
 * Animates canonical delivery identities and submits only their guarded contact command.
 *
 * A live actor continuously chases an outbound owner's retained physical pose and turns from its
 * current frame when the engine increments generation. Hydration reconstructs the start from
 * persisted `origin` or `returnFrom`. Missing off-screen geometry freezes the delivery without
 * inventing an engine result.
 */
export const createPixiDeliveryMotionRuntimeFx = Effect.fn("createPixiDeliveryMotionRuntimeFx")(
	function* ({
		actorStore,
		animator,
		application,
		drag,
		game,
		magneticField,
		particleTextures,
		readPalette,
		surface,
		textures,
	}: createPixiDeliveryMotionRuntimeFx.Props) {
		const activeByItemId = new Map<string, ActiveDelivery>();
		let closed = false;

		const destroyConsumedActorFx = Effect.fn("destroyConsumedDeliveryActorFx")(function* (
			itemId: string,
			active: ActiveDelivery,
		) {
			if (activeByItemId.get(itemId) !== active) return;
			active.releaseMagnet();
			activeByItemId.delete(itemId);
			if (actorStore.actors.get(itemId) === active.actor) {
				yield* actorStore.releaseActorFx(itemId);
				yield* animator.cancelActorFx(active.actor);
				if (!active.actor.container.destroyed) {
					yield* actorStore.destroyExitingActorFx(active.actor);
				}
			}
		});

		const submitSettlement = (itemId: string, generation: number) => {
			const active = activeByItemId.get(itemId);
			if (
				closed ||
				active === undefined ||
				active.generation !== generation ||
				active.stage !== "traveling"
			) {
				return;
			}
			active.stage = "settling";
			void game
				.run(
					settleTileDeliveryFx({
						itemId,
						generation,
					}),
				)
				.catch((cause) => {
					game.reportCriticalFailure("game-presentation", cause);
				});
		};

		const startTravelFx = Effect.fn("startPixiDeliveryTravelFx")(function* ({
			active,
			delivery,
			to,
		}: {
			readonly active: ActiveDelivery;
			readonly delivery: TileDelivery;
			readonly to: PixiTileActorPose;
		}) {
			active.stage = "traveling";
			active.releaseMagnet();
			const magneticProjector =
				delivery.phase === "outbound" && delivery.targetActorId !== undefined
					? yield* createPixiTileMotionMagneticProjectorFx({
							actor: active.actor,
							attractedActorId: delivery.targetActorId,
							eligibleAttractionActorIds: new Set([
								delivery.targetActorId,
							]),
							magneticField,
						})
					: null;
			active.releaseMagnet = () => magneticProjector?.release();
			const readLiveTarget = () =>
				delivery.targetActorId === undefined
					? null
					: readPixiLiveActorContactPose({
							actorId: delivery.targetActorId,
							actors: actorStore.actors,
							movingActor: active.actor,
						});
			yield* chasePixiTileMotionTargetFx({
				actor: active.actor,
				animator,
				curve: delivery.phase === "returning" ? deliveryReturnCurve : deliveryOutboundCurve,
				fallbackTarget: to,
				onPose: magneticProjector?.projectPose,
				onSettled: () => {
					active.releaseMagnet();
					if (delivery.phase === "outbound" && delivery.targetActorId !== undefined) {
						RendererRuntime.runSync(
							flashPixiMotionTargetFx({
								actorStore,
								animator,
								targetActorId: delivery.targetActorId,
							}),
						);
					}
					submitSettlement(delivery.item.id, delivery.generation);
				},
				ownerKey: `delivery:${delivery.item.id}:${delivery.generation}`,
				readLiveTarget,
				shouldSettle: () => {
					const current = activeByItemId.get(delivery.item.id);
					return (
						closed ||
						current === undefined ||
						current.generation !== delivery.generation
					);
				},
				surface,
				targetLocation: delivery.to,
			});
		});

		const revealReturningDeliveryFx = Effect.fn("revealReturningDeliveryFx")(function* ({
			active,
			delivery,
			to,
		}: {
			readonly active: ActiveDelivery;
			readonly delivery: TileDelivery;
			readonly to: PixiTileActorPose;
		}) {
			const ownerKey = `delivery:${delivery.item.id}:${delivery.generation}:consume`;
			active.stage = "contact-fade-out";
			yield* startPixiTileActorRemainderFeedbackFx({
				actor: active.actor,
				animator,
				onHiddenFx: Effect.gen(function* () {
					if (
						closed ||
						activeByItemId.get(delivery.item.id) !== active ||
						active.actor.container.destroyed
					) {
						return;
					}
					const latestTarget = active.target ?? to;
					yield* updatePixiTileActorFx({
						actor: active.actor,
						animator,
						frames: application.frames,
						item: active.delivery.item,
						palette: readPalette(),
						size: latestTarget.size,
						textures,
					});
					active.stage = "contact-fade-in";
				}),
				onRevealed: () => {
					if (closed || activeByItemId.get(delivery.item.id) !== active) return;
					const returnTarget = active.target;
					if (returnTarget === null) {
						active.stage = "awaiting-return-geometry";
						return;
					}
					RendererRuntime.runSync(
						startTravelFx({
							active,
							delivery: active.delivery,
							to: returnTarget,
						}),
					);
				},
				ownerKey,
			});
		});

		return {
			closeFx: Effect.gen(function* () {
				if (closed) return;
				closed = true;
				for (const active of activeByItemId.values()) {
					active.releaseMagnet();
					yield* animator.cancelActorFx(active.actor);
				}
				activeByItemId.clear();
			}),
			readSnapshotFx: Effect.sync(() => ({
				retainedActorIds: new Set(activeByItemId.keys()),
			})),
			syncFx: Effect.fn("PixiDeliveryMotionRuntime.syncFx")(function* (
				deliveries: ReadonlyArray<TileDelivery>,
			) {
				if (closed) return;
				const deliveryByItemId = new Map(
					deliveries.map((delivery) => [
						delivery.item.id,
						delivery,
					]),
				);
				for (const [itemId, active] of activeByItemId) {
					if (deliveryByItemId.has(itemId)) continue;
					active.releaseMagnet();
					yield* animator.cancelChannelFx(active.actor, "pose");
					const canonical = actorStore.canonicalItems.get(itemId);
					if (canonical !== undefined) {
						activeByItemId.delete(itemId);
						yield* drag.attachActorFx(active.actor);
						continue;
					}
					if (active.stage === "consuming") continue;
					if (active.delivery.phase === "outbound" && active.stage === "settling") {
						active.stage = "consuming";
						let settled = false;
						const settle = () => {
							if (settled) return;
							settled = true;
							RendererRuntime.runSync(destroyConsumedActorFx(itemId, active));
						};
						yield* startPixiTileActorRemovalFeedbackFx({
							actor: active.actor,
							animator,
							onCancel: settle,
							onComplete: settle,
						});
						continue;
					}
					yield* destroyConsumedActorFx(itemId, active);
				}

				for (const delivery of deliveries) {
					const from = yield* surface.readLocationPoseFx(delivery.from);
					const to = yield* surface.readLocationPoseFx(delivery.to);
					let active = activeByItemId.get(delivery.item.id);
					const generationChanged =
						active === undefined || active.generation !== delivery.generation;
					if (from === null || to === null) {
						if (active !== undefined) {
							active.releaseMagnet();
							const contactReturn =
								generationChanged &&
								active.delivery.phase === "outbound" &&
								active.stage === "settling" &&
								delivery.phase === "returning";
							if (generationChanged) {
								if (
									active.stage === "contact-fade-out" ||
									active.stage === "contact-fade-in"
								) {
									yield* animator.setFx({
										actor: active.actor,
										alpha: 1,
										channel: "lifecycle-opacity",
									});
								}
								const previous = active;
								active = {
									actor: previous.actor,
									delivery,
									generation: delivery.generation,
									releaseMagnet: () => undefined,
									stage: contactReturn
										? "contact-fade-out"
										: "awaiting-travel-geometry",
									target: null,
								};
								activeByItemId.set(delivery.item.id, active);
								if (contactReturn) {
									yield* revealReturningDeliveryFx({
										active,
										delivery,
										to: {
											layer: surface.transientActorLayer,
											size: Math.max(1, active.actor.size),
											x: active.actor.container.x,
											y: active.actor.container.y,
										},
									});
								}
							} else {
								active.delivery = delivery;
								active.target = null;
							}
							if (
								active.stage === "traveling" ||
								active.stage === "awaiting-travel-geometry"
							) {
								yield* animator.cancelChannelFx(active.actor, "pose");
								active.stage = "awaiting-travel-geometry";
							}
							if (active.actor.container.visible) {
								active.actor.container.visible = false;
								yield* application.frames.invalidateFx;
							}
						}
						continue;
					}
					let actor = active?.actor ?? actorStore.actors.get(delivery.item.id);
					const targetChanged =
						active === undefined ||
						active.delivery.targetActorId !== delivery.targetActorId ||
						active.target?.x !== to.x ||
						active.target?.y !== to.y ||
						active.target?.size !== to.size;
					if (!generationChanged && active !== undefined) {
						active.delivery = delivery;
						active.target = to;
						active.actor.container.visible = true;
						if (
							active.stage === "contact-fade-out" ||
							active.stage === "contact-fade-in" ||
							active.stage === "settling"
						) {
							continue;
						}
						if (
							active.stage === "awaiting-return-geometry" ||
							active.stage === "awaiting-travel-geometry"
						) {
							yield* updatePixiTileActorFx({
								actor: active.actor,
								animator,
								frames: application.frames,
								item: delivery.item,
								palette: readPalette(),
								size: to.size,
								textures,
							});
							yield* startTravelFx({
								active,
								delivery,
								to,
							});
							continue;
						}
						if (!targetChanged) continue;
					}
					if (
						generationChanged &&
						active !== undefined &&
						(active.stage === "contact-fade-out" || active.stage === "contact-fade-in")
					) {
						yield* animator.setFx({
							actor: active.actor,
							alpha: 1,
							channel: "lifecycle-opacity",
						});
					}
					active?.releaseMagnet();

					if (actor === undefined) {
						actor = yield* createPixiTileActorFx({
							frames: application.frames,
							item: delivery.item,
							palette: readPalette(),
							particleTextures,
							textures,
						});
						yield* actorStore.setActorFx(actor);
						yield* animator.setFx({
							actor,
							alpha: 1,
							channel: "lifecycle-opacity",
						});
						yield* animator.setFx({
							actor,
							channel: "pose",
							scale: 1,
							x: from.x,
							y: from.y,
						});
					}
					yield* drag.detachActorFx(actor);
					actor.container.visible = true;
					actor.container.eventMode = "none";
					actor.container.cursor = "default";
					surface.transientActorLayer.addChild(actor.container);
					const contactReturn =
						active?.delivery.phase === "outbound" &&
						active.stage === "settling" &&
						delivery.phase === "returning";
					if (!contactReturn) {
						yield* updatePixiTileActorFx({
							actor,
							animator,
							frames: application.frames,
							item: delivery.item,
							palette: readPalette(),
							size: to.size,
							textures,
						});
					}
					active = {
						actor,
						delivery,
						generation: delivery.generation,
						releaseMagnet: () => undefined,
						stage: "traveling",
						target: to,
					};
					activeByItemId.set(delivery.item.id, active);
					if (contactReturn) {
						yield* revealReturningDeliveryFx({
							active,
							delivery,
							to,
						});
					} else {
						yield* startTravelFx({
							active,
							delivery,
							to,
						});
					}
				}
			}),
		} satisfies PixiDeliveryMotionRuntime;
	},
);
