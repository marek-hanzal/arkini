import { Effect } from "effect";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { TileDelivery } from "~/game-scene/fx/readTileDeliveriesFx";
import type { MainActorStore } from "~/tile-rendering/service/MainActorStore";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import type { ParticleTextures } from "~/tile-rendering/service/ParticleTextures";
import { createTileActorFx } from "~/tile-rendering/fx/createTileActorFx";
import { updateTileActorFx } from "~/tile-rendering/fx/updateTileActorFx";
import type { ActorAnimator } from "~/tile-rendering/service/ActorAnimator";
import { startActorExitFx } from "~/tile-rendering/fx/startActorExitFx";
import { restoreActorExitFx } from "~/tile-rendering/fx/restoreActorExitFx";
import type { PixiScenePalette } from "~/tile-rendering/type/PixiScenePalette";
import type { DeliveryRuntime } from "~/game-scene/service/DeliveryRuntime";
import type { MainDragController } from "~/tile-interaction/fx/createMainDragControllerFx";
import { chaseTargetFx } from "~/tile-motion/fx/chaseTargetFx";
import { createLiveContactPoseReaderFx } from "~/tile-motion/fx/createLiveContactPoseReaderFx";
import { flashMotionTargetFx } from "~/tile-motion/fx/flashMotionTargetFx";
import type { PixiApplicationOwner } from "~/tile-rendering/service/PixiApplicationOwner";
import type { TextureStore } from "~/tile-rendering/fx/createTextureStoreFx";
import type { MainSurface } from "~/game-scene/service/MainSurface";
import type { ActorPose } from "~/game-scene/type/ActorPose";

interface CreateDeliveryRuntimeProps {
	readonly actorStore: MainActorStore;
	readonly animator: ActorAnimator;
	readonly application: PixiApplicationOwner;
	readonly drag: MainDragController;
	readonly particleTextures: ParticleTextures;
	readonly readPaletteFn: () => PixiScenePalette;
	readonly surface: MainSurface;
	readonly textures: TextureStore;
}

interface ActiveDelivery {
	readonly actor: PixiTileActor;
	delivery: TileDelivery;
	readonly generation: number;
	stage: "awaiting-travel-geometry" | "exiting" | "contacted" | "traveling";
	target: ActorPose | null;
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
 * Animates canonical delivery identities without owning gameplay settlement.
 *
 * A live actor continuously chases an outbound owner's retained physical pose and turns from its
 * current frame when the engine increments generation. Hydration reconstructs the start from
 * persisted `origin` or `returnFrom`. Missing off-screen geometry affects only presentation; the
 * engine countdown and settlement continue independently.
 */
export const createDeliveryRuntimeFx = Effect.fn("createDeliveryRuntimeFx")(function* ({
	actorStore,
	animator,
	application,
	drag,
	particleTextures,
	readPaletteFn,
	surface,
	textures,
}: CreateDeliveryRuntimeProps) {
	const readLiveContactPoseFn = yield* createLiveContactPoseReaderFx();
	const activeByItemId = new Map<string, ActiveDelivery>();
	let closed = false;

	const destroyCompletedDeliveryActorFx = Effect.fn("destroyCompletedDeliveryActorFx")(function* (
		itemId: string,
		active: ActiveDelivery,
	) {
		if (activeByItemId.get(itemId) !== active) return;
		activeByItemId.delete(itemId);
		if (actorStore.actors.get(itemId) === active.actor) {
			yield* actorStore.releaseActorFx(itemId);
			yield* animator.cancelActorFx(active.actor);
			if (!active.actor.container.destroyed) {
				yield* actorStore.destroyExitingActorFx(active.actor);
			}
		}
	});

	const markContactFn = (itemId: string, generation: number) => {
		const active = activeByItemId.get(itemId);
		if (
			closed ||
			active === undefined ||
			active.generation !== generation ||
			active.stage !== "traveling"
		) {
			return;
		}
		active.stage = "contacted";
	};

	const startTravelFx = Effect.fn("startTravelFx")(function* ({
		active,
		delivery,
		to,
	}: {
		readonly active: ActiveDelivery;
		readonly delivery: TileDelivery;
		readonly to: ActorPose;
	}) {
		active.stage = "traveling";
		const readLiveTargetFn = () =>
			delivery.targetActorId === undefined
				? null
				: readLiveContactPoseFn({
						actorId: delivery.targetActorId,
						actors: actorStore.actors,
						movingActor: active.actor,
					});
		yield* chaseTargetFx({
			actor: active.actor,
			animator,
			durationMs: Math.max(0, delivery.remainingDurationMs - 100),
			curve: delivery.phase === "returning" ? deliveryReturnCurve : deliveryOutboundCurve,
			fallbackTarget: to,
			onSettledFn: () => {
				if (delivery.phase === "outbound" && delivery.targetActorId !== undefined) {
					RendererRuntime.runSync(
						flashMotionTargetFx({
							actorStore,
							animator,
							targetActorId: delivery.targetActorId,
						}),
					);
				}
				markContactFn(delivery.item.id, delivery.generation);
			},
			ownerKey: `delivery:${delivery.item.id}:${delivery.generation}`,
			readLiveTargetFn,
			shouldSettleFn: () => {
				const current = activeByItemId.get(delivery.item.id);
				return (
					closed || current === undefined || current.generation !== delivery.generation
				);
			},
			surface,
			targetLocation: delivery.to,
		});
	});

	return {
		closeFx: Effect.gen(function* () {
			if (closed) return;
			closed = true;
			for (const active of activeByItemId.values()) {
				yield* animator.cancelActorFx(active.actor);
			}
			activeByItemId.clear();
		}),
		readSnapshotFx: Effect.sync(() => ({
			retainedActorIds: new Set(activeByItemId.keys()),
		})),
		syncFx: Effect.fn("DeliveryRuntime.syncFx")(function* (
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
				yield* animator.cancelChannelFx(active.actor, "pose");
				const canonical = actorStore.canonicalItems.get(itemId);
				if (canonical !== undefined) {
					// Off-screen delivery geometry must not hide its settled grid identity.
					active.actor.container.visible = true;
					yield* application.frames.invalidateFx;
					activeByItemId.delete(itemId);
					if (active.stage === "exiting") {
						yield* restoreActorExitFx({
							actor: active.actor,
							animator,
						});
					}
					yield* drag.attachActorFx(active.actor);
					continue;
				}
				if (active.stage === "exiting") continue;
				// Engine settlement can overtake the final travel frame; visible payloads still exit smoothly.
				if (active.actor.container.visible) {
					active.stage = "exiting";
					let settled = false;
					const settleFn = () => {
						if (settled) return;
						settled = true;
						RendererRuntime.runSync(destroyCompletedDeliveryActorFx(itemId, active));
					};
					yield* startActorExitFx({
						actor: active.actor,
						animator,
						onCancelFn: settleFn,
						onCompleteFn: settleFn,
					});
					continue;
				}
				yield* destroyCompletedDeliveryActorFx(itemId, active);
			}

			for (const delivery of deliveries) {
				const from = yield* surface.readLocationPoseFx(delivery.from);
				const to = yield* surface.readLocationPoseFx(delivery.to);
				let active = activeByItemId.get(delivery.item.id);
				if (active?.stage === "exiting") {
					// Replace ownership before cancelling the exit: its cancellation also destroys.
					active = {
						actor: active.actor,
						delivery,
						generation: delivery.generation,
						stage: "awaiting-travel-geometry",
						target: null,
					};
					activeByItemId.set(delivery.item.id, active);
					yield* restoreActorExitFx({
						actor: active.actor,
						animator,
					});
				}
				const generationChanged =
					active === undefined || active.generation !== delivery.generation;
				if (from === null || to === null) {
					if (active !== undefined) {
						if (generationChanged) {
							const previous = active;
							active = {
								actor: previous.actor,
								delivery,
								generation: delivery.generation,
								stage: "awaiting-travel-geometry",
								target: null,
							};
							activeByItemId.set(delivery.item.id, active);
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
					if (active.stage === "contacted") {
						continue;
					}
					if (active.stage === "awaiting-travel-geometry") {
						yield* updateTileActorFx({
							actor: active.actor,
							animator,
							frames: application.frames,
							item: delivery.item,
							palette: readPaletteFn(),
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

				if (actor === undefined) {
					actor = yield* createTileActorFx({
						frames: application.frames,
						item: delivery.item,
						palette: readPaletteFn(),
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
				yield* updateTileActorFx({
					actor,
					animator,
					frames: application.frames,
					item: delivery.item,
					palette: readPaletteFn(),
					size: to.size,
					textures,
				});
				active = {
					actor,
					delivery,
					generation: delivery.generation,
					stage: "traveling",
					target: to,
				};
				activeByItemId.set(delivery.item.id, active);
				yield* startTravelFx({
					active,
					delivery,
					to,
				});
			}
		}),
	} satisfies DeliveryRuntime;
});
