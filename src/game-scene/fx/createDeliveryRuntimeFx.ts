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
import { startRemainderFeedbackFx } from "~/tile-rendering/fx/startRemainderFeedbackFx";
import type { PixiScenePalette } from "~/tile-rendering/type/PixiScenePalette";
import type { DeliveryRuntime } from "~/game-scene/service/DeliveryRuntime";
import type { MainDragController } from "~/tile-interaction/fx/createMainDragControllerFx";
import type { MagneticField } from "~/tile-motion/service/MagneticField";
import { chaseTargetFx } from "~/tile-motion/fx/chaseTargetFx";
import { createLiveContactPoseReaderFx } from "~/tile-motion/fx/createLiveContactPoseReaderFx";
import { createMagneticProjectorFx } from "~/tile-motion/fx/createMagneticProjectorFx";
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
	readonly magneticField: MagneticField;
	readonly particleTextures: ParticleTextures;
	readonly readPaletteFn: () => PixiScenePalette;
	readonly surface: MainSurface;
	readonly textures: TextureStore;
}

interface ActiveDelivery {
	readonly actor: PixiTileActor;
	delivery: TileDelivery;
	readonly generation: number;
	releaseMagnetFn: () => void;
	stage:
		| "awaiting-return-geometry"
		| "awaiting-travel-geometry"
		| "contact-fade-in"
		| "contact-fade-out"
		| "exiting"
		| "contacted"
		| "traveling";
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
	magneticField,
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
		active.releaseMagnetFn();
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
		active.releaseMagnetFn();
		const magneticProjector =
			delivery.phase === "outbound" && delivery.targetActorId !== undefined
				? yield* createMagneticProjectorFx({
						actor: active.actor,
						attractedActorId: delivery.targetActorId,
						eligibleAttractionActorIds: new Set([
							delivery.targetActorId,
						]),
						magneticField,
						surface,
					})
				: null;
		active.releaseMagnetFn = () => magneticProjector?.releaseFn();
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
			onPoseFn: magneticProjector?.projectPoseFn,
			onSettledFn: () => {
				active.releaseMagnetFn();
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

	const revealReturningDeliveryFx = Effect.fn("revealReturningDeliveryFx")(function* ({
		active,
		delivery,
		to,
	}: {
		readonly active: ActiveDelivery;
		readonly delivery: TileDelivery;
		readonly to: ActorPose;
	}) {
		const ownerKey = `delivery:${delivery.item.id}:${delivery.generation}:consume`;
		active.stage = "contact-fade-out";
		yield* startRemainderFeedbackFx({
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
				yield* updateTileActorFx({
					actor: active.actor,
					animator,
					frames: application.frames,
					item: active.delivery.item,
					palette: readPaletteFn(),
					size: latestTarget.size,
					textures,
				});
				active.stage = "contact-fade-in";
			}),
			onRevealedFn: () => {
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
				active.releaseMagnetFn();
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
				active.releaseMagnetFn();
				yield* animator.cancelChannelFx(active.actor, "pose");
				const canonical = actorStore.canonicalItems.get(itemId);
				if (canonical !== undefined) {
					// Off-screen delivery geometry must not hide its settled grid identity.
					active.actor.container.visible = true;
					yield* application.frames.invalidateFx;
					activeByItemId.delete(itemId);
					yield* drag.attachActorFx(active.actor);
					continue;
				}
				if (active.stage === "exiting") continue;
				if (active.stage === "contacted") {
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
				const generationChanged =
					active === undefined || active.generation !== delivery.generation;
				if (from === null || to === null) {
					if (active !== undefined) {
						active.releaseMagnetFn();
						const contactReturn =
							generationChanged &&
							active.delivery.phase === "outbound" &&
							active.stage === "contacted" &&
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
								releaseMagnetFn: () => undefined,
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
						active.stage === "contacted"
					) {
						continue;
					}
					if (
						active.stage === "awaiting-return-geometry" ||
						active.stage === "awaiting-travel-geometry"
					) {
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
				active?.releaseMagnetFn();

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
				const contactReturn =
					active?.delivery.phase === "outbound" &&
					active.stage === "contacted" &&
					delivery.phase === "returning";
				if (!contactReturn) {
					yield* updateTileActorFx({
						actor,
						animator,
						frames: application.frames,
						item: delivery.item,
						palette: readPaletteFn(),
						size: to.size,
						textures,
					});
				}
				active = {
					actor,
					delivery,
					generation: delivery.generation,
					releaseMagnetFn: () => undefined,
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
	} satisfies DeliveryRuntime;
});
