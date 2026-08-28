import { Effect } from "effect";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { TileDelivery } from "~/bridge/tile/readTileDeliveriesFx";
import type { MainActorStore } from "~/ui/pixi/actor/MainActorStore";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { ParticleTextures } from "~/ui/pixi/actor/ParticleTextures";
import { createTileActorFx } from "~/ui/pixi/actor/createTileActorFx";
import { updateTileActorFx } from "~/ui/pixi/actor/updateTileActorFx";
import type { ActorAnimator } from "~/ui/pixi/animation/ActorAnimator";
import { startActorExitFx } from "~/ui/pixi/animation/startActorExitFx";
import { startRemainderFeedbackFx } from "~/ui/pixi/animation/startRemainderFeedbackFx";
import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";
import type { DeliveryRuntime } from "~/ui/pixi/delivery/DeliveryRuntime";
import type { MainDragController } from "~/ui/pixi/drag/MainDragController";
import type { MagneticField } from "~/ui/pixi/magnet/MagneticField";
import { chaseTargetFx } from "~/ui/pixi/motion/chaseTargetFx";
import { createMagneticProjectorFx } from "~/ui/pixi/motion/createMagneticProjectorFx";
import { flashMotionTargetFx } from "~/ui/pixi/motion/flashMotionTargetFx";
import { makeLiveContactPoseReaderFx } from "~/ui/pixi/motion/makeLiveContactPoseReaderFx";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import type { TextureStore } from "~/ui/pixi/runtime/createTextureStoreFx";
import type { MainSurface } from "~/ui/pixi/scene/MainSurface";
import type { ActorPose } from "~/ui/pixi/scene/ActorPose";

export namespace createDeliveryRuntimeFx {
	export interface Props {
		readonly actorStore: MainActorStore;
		readonly animator: ActorAnimator;
		readonly application: PixiApplicationOwner;
		readonly drag: MainDragController;
		readonly magneticField: MagneticField;
		readonly particleTextures: ParticleTextures;
		readonly readPalette: () => PixiScenePalette;
		readonly surface: MainSurface;
		readonly textures: TextureStore;
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
	readPalette,
	surface,
	textures,
}: createDeliveryRuntimeFx.Props) {
	const readLiveContactPose = yield* makeLiveContactPoseReaderFx();
	const activeByItemId = new Map<string, ActiveDelivery>();
	let closed = false;

	const destroyCompletedDeliveryActorFx = Effect.fn("destroyCompletedDeliveryActorFx")(function* (
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

	const markContact = (itemId: string, generation: number) => {
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
		active.releaseMagnet();
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
		active.releaseMagnet = () => magneticProjector?.release();
		const readLiveTarget = () =>
			delivery.targetActorId === undefined
				? null
				: readLiveContactPose({
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
			onPose: magneticProjector?.projectPose,
			onSettled: () => {
				active.releaseMagnet();
				if (delivery.phase === "outbound" && delivery.targetActorId !== undefined) {
					RendererRuntime.runSync(
						flashMotionTargetFx({
							actorStore,
							animator,
							targetActorId: delivery.targetActorId,
						}),
					);
				}
				markContact(delivery.item.id, delivery.generation);
			},
			ownerKey: `delivery:${delivery.item.id}:${delivery.generation}`,
			readLiveTarget,
			shouldSettle: () => {
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
				active.releaseMagnet();
				yield* animator.cancelChannelFx(active.actor, "pose");
				const canonical = actorStore.canonicalItems.get(itemId);
				if (canonical !== undefined) {
					activeByItemId.delete(itemId);
					yield* drag.attachActorFx(active.actor);
					continue;
				}
				if (active.stage === "exiting") continue;
				if (active.stage === "contacted") {
					active.stage = "exiting";
					let settled = false;
					const settle = () => {
						if (settled) return;
						settled = true;
						RendererRuntime.runSync(destroyCompletedDeliveryActorFx(itemId, active));
					};
					yield* startActorExitFx({
						actor: active.actor,
						animator,
						onCancel: settle,
						onComplete: settle,
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
						active.releaseMagnet();
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
					actor = yield* createTileActorFx({
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
					active.stage === "contacted" &&
					delivery.phase === "returning";
				if (!contactReturn) {
					yield* updateTileActorFx({
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
	} satisfies DeliveryRuntime;
});
