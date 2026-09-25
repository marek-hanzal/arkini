import { Effect } from "effect";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { GameEngine } from "~/playable-game/type/GameEngine";
import type { GameTransition } from "~/game-session/type/GameSession";
import { readTileActorsFx } from "~/tile-presentation/fx/readTileActorsFx";
import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import type { MainActorStore } from "~/tile-rendering/service/MainActorStore";
import { createTileActorFx } from "~/tile-rendering/fx/createTileActorFx";
import { updateTileActorFx } from "~/tile-rendering/fx/updateTileActorFx";
import type { ActorAnimator } from "~/tile-rendering/service/ActorAnimator";
import type { PixiScenePalette } from "~/tile-rendering/type/PixiScenePalette";
import type { MainDragController } from "~/tile-interaction/fx/createMainDragControllerFx";
import type { PixiApplicationOwner } from "~/tile-rendering/service/PixiApplicationOwner";
import type { TextureStore } from "~/tile-rendering/fx/createTextureStoreFx";
import type { MainSurface } from "~/game-scene/service/MainSurface";
import type { ActorPose } from "~/game-scene/type/ActorPose";
import type {
	PresentationRuntime,
	PresentationTarget,
} from "~/game-scene/service/PresentationRuntime";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import { isSameTileActorLocationFn } from "~/tile-rendering/fn/isSameTileActorLocationFn";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";

interface CreateMainReconcilerProps {
	readonly actorStore: MainActorStore;
	readonly animator: ActorAnimator;
	readonly application: PixiApplicationOwner;
	readonly drag: MainDragController;
	readonly game: GameEngine;
	readonly presentation: PresentationRuntime;
	readonly readPaletteFn: () => PixiScenePalette;
	readonly surface: MainSurface;
	readonly textures: TextureStore;
}

interface MainReconciler {
	readonly hydrateFx: (transition: GameTransition) => Effect.Effect<void, never, never>;
	readonly reconcileFx: (transition: GameTransition) => Effect.Effect<void, never, never>;
	readonly boardArriveFx: (transition: GameTransition) => Effect.Effect<void, never, never>;
	readonly exitVisibleItemsFx: Effect.Effect<void, never, never>;
	readonly refreshVisualsFx: Effect.Effect<void, never, never>;
	readonly closeFx: Effect.Effect<void, never, never>;
}

/** Aligns visible centers even while an actor has a grab pivot or a scale. */
const readContactPoseFn = ({
	moving,
	target,
}: {
	readonly moving: PixiTileActor | null;
	readonly target: PixiTileActor | ActorPose;
}): PresentationTarget => {
	const scale = "container" in target ? target.container.scale.x : 1;
	const targetX = "container" in target ? target.container.x : target.x;
	const targetY = "container" in target ? target.container.y : target.y;
	const targetPivotX = "container" in target ? target.container.pivot.x : 0;
	const targetPivotY = "container" in target ? target.container.pivot.y : 0;
	const size = target.size * scale;
	return {
		size,
		x:
			targetX -
			targetPivotX * scale +
			((moving?.container.pivot.x ?? 0) * size) / Math.max(1, moving?.size ?? 1),
		y:
			targetY -
			targetPivotY * scale +
			((moving?.container.pivot.y ?? 0) * size) / Math.max(1, moving?.size ?? 1),
	};
};

/** Projects the current canonical Board into retained Pixi actors. Interaction owns held poses. */
export const createMainReconcilerFx = Effect.fn("createMainReconcilerFx")(function* ({
	actorStore,
	animator,
	application,
	drag,
	game,
	presentation,
	readPaletteFn,
	surface,
	textures,
}: CreateMainReconcilerProps) {
	let closed = false;
	const pendingTravel = new WeakMap<PixiTileActor, PixiTileActor | null>();

	const readSlotKeyFn = (item: TileActorItem) =>
		item.location.scope === "board"
			? `${item.location.space}:${item.location.position.x}:${item.location.position.y}`
			: null;
	const readItemsFn = (transition: GameTransition) =>
		game.readOrThrowFn(
			readTileActorsFx({
				game,
				runtime: transition.runtime,
			}),
		);

	const updateActorFx = Effect.fn("MainReconciler.updateActorFx")(function* ({
		actor,
		item,
		pose,
	}: {
		readonly actor: PixiTileActor;
		readonly item: TileActorItem;
		readonly pose: ActorPose;
	}) {
		yield* updateTileActorFx({
			actor,
			animator,
			crossfadeArtworkFx: presentation.crossfadeArtworkFx,
			frames: application.frames,
			item,
			palette: readPaletteFn(),
			size: pose.size,
			textures,
		});
	});

	const createActorFx = Effect.fn("MainReconciler.createActorFx")(function* ({
		hidden,
		item,
		origin,
		pose,
	}: {
		readonly hidden: boolean;
		readonly item: TileActorItem;
		readonly origin?: PresentationTarget;
		readonly pose: ActorPose;
	}) {
		const actor = yield* createTileActorFx({
			frames: application.frames,
			item,
			palette: readPaletteFn(),
			textures,
		});
		for (const exiting of [
			...actorStore.exitingActors,
		]) {
			if (exiting.item.id !== item.id) continue;
			yield* presentation.cancelActorFx(exiting);
			yield* animator.cancelActorFx(exiting);
			yield* actorStore.destroyExitingActorFx(exiting);
		}
		// Prepare the first drawable pose before publishing the actor to the scene.
		const initialPose = origin ?? pose;
		yield* animator.setFx({
			actor,
			channel: "lifecycle-opacity",
			alpha: hidden ? 0 : 1,
		});
		yield* animator.setFx({
			actor,
			channel: "pose",
			scale: initialPose.size / Math.max(1, pose.size),
			x: initialPose.x,
			y: initialPose.y,
		});
		yield* drag.attachActorFx(actor);
		yield* updateActorFx({
			actor,
			item,
			pose,
		});
		yield* actorStore.setActorFx(actor);
		(origin === undefined ? pose.layer : surface.transientActorLayer).addChild(actor.container);
		return actor;
	});

	const releaseActorFx = Effect.fn("MainReconciler.releaseActorFx")(function* (
		actor: PixiTileActor,
	) {
		if (actorStore.actors.get(actor.item.id) !== actor) return;
		pendingTravel.delete(actor);
		yield* drag.detachActorFx(actor);
		yield* presentation.cancelActorFx(actor);
		yield* animator.cancelActorFx(actor);
		yield* actorStore.releaseActorFx(actor.item.id);
	});

	const destroyReleasedActorFn = (actor: PixiTileActor) => {
		if (!actorStore.exitingActors.has(actor)) return;
		RendererRuntime.runSync(actorStore.destroyExitingActorFx(actor));
	};
	const destroyReleasedActorFx = Effect.fn("MainReconciler.destroyReleasedActorFx")(function* (
		actor: PixiTileActor,
	) {
		yield* releaseActorFx(actor);
		yield* actorStore.destroyExitingActorFx(actor);
	});

	const placeActorFx = Effect.fn("MainReconciler.placeActorFx")(function* ({
		actor,
		item,
		pose,
		present,
		targetActor,
	}: {
		readonly actor: PixiTileActor;
		readonly item: TileActorItem;
		readonly pose: ActorPose;
		readonly present: boolean;
		readonly targetActor: PixiTileActor | undefined;
	}) {
		const moved = !isSameTileActorLocationFn(actor.item.location, item.location);
		const previousSize = actor.size * actor.container.scale.x;
		const poseChannelActive = yield* animator.isChannelActiveFx(actor, "pose");
		const traveling = yield* presentation.isTravelingFx(actor);
		const retargetTravel = present && moved && traveling;
		// A request owns position while artwork loads and between its animation phases too.
		const poseOwned = actor.dragging || ((poseChannelActive || traveling) && !retargetTravel);
		yield* updateActorFx({
			actor,
			item,
			pose,
		});
		if (poseOwned) {
			if (present && moved) pendingTravel.set(actor, targetActor ?? null);
			return;
		}
		const shouldTravel = (present && moved) || pendingTravel.has(actor);
		const flightTargetActor = pendingTravel.has(actor)
			? (pendingTravel.get(actor) ?? undefined)
			: targetActor;
		pendingTravel.delete(actor);
		if (shouldTravel) {
			if (previousSize !== pose.size) {
				yield* animator.setFx({
					actor,
					channel: "pose",
					scale: previousSize / Math.max(1, pose.size),
					x: actor.container.x,
					y: actor.container.y,
				});
			}
			surface.transientActorLayer.addChild(actor.container);
			yield* presentation.travelFx({
				actor,
				target: readContactPoseFn({
					moving: actor,
					target: pose,
				}),
				readTargetFn: () => {
					if (actorStore.actors.get(item.id) !== actor) return null;
					const latest = RendererRuntime.runSync(surface.readActorPoseFx(actor.item));
					if (latest === null) return null;
					if (
						flightTargetActor !== undefined &&
						flightTargetActor !== actor &&
						!flightTargetActor.container.destroyed &&
						flightTargetActor.dragging
					) {
						return readContactPoseFn({
							moving: actor,
							target: flightTargetActor,
						});
					}
					return readContactPoseFn({
						moving: actor,
						target: latest,
					});
				},
				onCompleteFn: () => {
					if (actorStore.actors.get(item.id) !== actor || actor.container.destroyed)
						return;
					const latest = RendererRuntime.runSync(surface.readActorPoseFx(actor.item));
					if (latest !== null) latest.layer.addChild(actor.container);
					RendererRuntime.runSync(drag.settleOriginGhostFx(actor));
				},
			});
			return;
		}
		if (actor.container.parent !== pose.layer) pose.layer.addChild(actor.container);
		if (
			actor.container.x !== pose.x ||
			actor.container.y !== pose.y ||
			actor.container.scale.x !== 1
		) {
			yield* animator.setFx({
				actor,
				channel: "pose",
				scale: 1,
				x: pose.x,
				y: pose.y,
			});
		}
		yield* drag.settleOriginGhostFx(actor);
	});

	const reconcileTransitionFx = Effect.fn("MainReconciler.reconcileTransitionFx")(function* ({
		present,
		transition,
	}: {
		readonly present: boolean;
		readonly transition: GameTransition;
	}) {
		if (closed) return;
		const nextItems = readItemsFn(transition);
		yield* actorStore.replaceCanonicalItemsFx(nextItems);
		const nextById = new Map(
			nextItems.map(
				(item) =>
					[
						item.id,
						item,
					] as const,
			),
		);
		const inputTargetBySource = new Map<string, string>();
		const spawnOriginByItem = new Map<
			string,
			{
				readonly actor: PixiTileActor;
				readonly pose: PresentationTarget;
			}
		>();
		if (present) {
			const previousById = new Map(
				(transition.previousRuntime?.items ?? []).map((item) => [
					item.id,
					item,
				]),
			);
			for (const item of transition.runtime.items) {
				if (item.location.scope !== "delivery" || item.location.phase !== "outbound")
					continue;
				const previous = previousById.get(item.id);
				const actor = actorStore.actors.get(item.id);
				const owner = nextById.get(item.location.target.ownerItemId);
				if (
					previous?.location.scope !== "board" ||
					actor === undefined ||
					owner?.location.scope !== "board" ||
					previous.item.uid !== item.item.uid ||
					actor.item.itemUid !== item.item.uid ||
					!isSameTileActorLocationFn(previous.location, item.location.origin) ||
					!isSameTileActorLocationFn(actor.item.location, previous.location) ||
					owner.location.space !== previous.location.space
				)
					continue;
				inputTargetBySource.set(item.id, owner.id);
			}
			for (const event of transition.events) {
				if (
					event.type === GameEventEnumSchema.enum.ItemSpawned ||
					event.type === GameEventEnumSchema.enum.ItemPlaced
				) {
					const item = nextById.get(event.itemId);
					const origin = actorStore.actors.get(event.originItemId);
					if (
						item === undefined ||
						origin === undefined ||
						item.itemUid !== event.itemUid ||
						!isSameTileActorLocationFn(item.location, event.location) ||
						actorStore.actors.has(item.id)
					)
						continue;
					spawnOriginByItem.set(item.id, {
						actor: origin,
						pose: readContactPoseFn({
							moving: null,
							target: origin,
						}),
					});
				}
			}
		}
		const priorBySlot = new Map<string, PixiTileActor>();
		const departures: PixiTileActor[] = [];
		for (const actor of actorStore.actors.values()) {
			const key = readSlotKeyFn(actor.item);
			if (key !== null) priorBySlot.set(key, actor);
			const next = nextById.get(actor.item.id);
			if (
				next === undefined ||
				(actor.item.location.scope === "board" &&
					(next.location.scope !== "board" ||
						actor.item.location.space !== next.location.space))
			)
				departures.push(actor);
		}
		const departureBySlot = new Map(
			departures.flatMap((actor) => {
				const key = readSlotKeyFn(actor.item);
				return key === null
					? []
					: [
							[
								key,
								actor,
							] as const,
						];
			}),
		);
		const replacementById = new Map(
			present
				? nextItems.flatMap((item) => {
						if (actorStore.actors.has(item.id)) return [];
						const key = readSlotKeyFn(item);
						const outgoing = key === null ? undefined : departureBySlot.get(key);
						const origin = spawnOriginByItem.get(item.id);
						return outgoing === undefined ||
							outgoing.item.id === item.id ||
							(origin !== undefined && origin.actor !== outgoing) ||
							inputTargetBySource.has(outgoing.item.id)
							? []
							: [
									[
										item.id,
										outgoing,
									] as const,
								];
					})
				: [],
		);
		const paired = new Set(replacementById.values());
		const inputDepartures: {
			actor: PixiTileActor;
			targetId: string;
		}[] = [];
		for (const actor of departures) {
			yield* releaseActorFx(actor);
			const inputTarget = inputTargetBySource.get(actor.item.id);
			if (inputTarget !== undefined) {
				inputDepartures.push({
					actor,
					targetId: inputTarget,
				});
			} else if (!present || !paired.has(actor)) {
				if (present) {
					yield* presentation.disappearFx({
						actor,
						onCompleteFn: () => destroyReleasedActorFn(actor),
					});
				} else yield* actorStore.destroyExitingActorFx(actor);
			}
		}
		for (const item of nextItems) {
			const pose = yield* surface.readActorPoseFx(item);
			if (pose === null) {
				const actor = actorStore.actors.get(item.id);
				if (actor !== undefined) yield* destroyReleasedActorFx(actor);
				continue;
			}
			const actor = actorStore.actors.get(item.id);
			if (actor === undefined) {
				const outgoing = present ? replacementById.get(item.id) : undefined;
				const origin =
					present && outgoing === undefined ? spawnOriginByItem.get(item.id) : undefined;
				const created = yield* createActorFx({
					hidden: present,
					item,
					origin: origin?.pose,
					pose,
				});
				if (present) {
					if (outgoing === undefined) {
						if (origin !== undefined) {
							yield* presentation.arriveFromFx({
								actor: created,
								origin: origin.pose,
								target: pose,
								readTargetFn: () =>
									actorStore.actors.get(item.id) === created
										? RendererRuntime.runSync(
												surface.readActorPoseFx(created.item),
											)
										: null,
								onCompleteFn: () => {
									if (
										actorStore.actors.get(item.id) !== created ||
										created.container.destroyed
									)
										return;
									const latest = RendererRuntime.runSync(
										surface.readActorPoseFx(created.item),
									);
									if (latest !== null) latest.layer.addChild(created.container);
								},
							});
						} else
							yield* presentation.appearFx({
								actor: created,
							});
					} else {
						yield* presentation.crossfadeFx({
							incoming: created,
							outgoing,
							onCompleteFn: () => destroyReleasedActorFn(outgoing),
						});
					}
				}
				continue;
			}
			const key = readSlotKeyFn(item);
			yield* placeActorFx({
				actor,
				item,
				pose,
				present,
				targetActor: key === null ? undefined : priorBySlot.get(key),
			});
		}
		for (const { actor, targetId } of inputDepartures) {
			const target = actorStore.actors.get(targetId);
			if (target === undefined) {
				yield* actorStore.destroyExitingActorFx(actor);
				continue;
			}
			const targetPose = yield* surface.readActorPoseFx(target.item);
			if (targetPose === null) {
				yield* actorStore.destroyExitingActorFx(actor);
				continue;
			}
			surface.transientActorLayer.addChild(actor.container);
			yield* presentation.travelFx({
				actor,
				target: readContactPoseFn({
					moving: actor,
					target: targetPose,
				}),
				readTargetFn: () => {
					const live = actorStore.actors.get(targetId);
					if (live === undefined || live.container.destroyed) return null;
					const canonical = RendererRuntime.runSync(surface.readActorPoseFx(live.item));
					if (canonical === null) return null;
					return readContactPoseFn({
						moving: actor,
						target: live.dragging ? live : canonical,
					});
				},
				onCompleteFn: () => {
					if (!actorStore.exitingActors.has(actor)) return;
					RendererRuntime.runSync(
						presentation.disappearFx({
							actor,
							onCompleteFn: () => destroyReleasedActorFn(actor),
						}),
					);
				},
			});
		}
		yield* drag.requestRefreshFx;
	});

	const boardArriveFx = Effect.fn("MainReconciler.boardArriveFx")(function* (
		transition: GameTransition,
	) {
		if (closed) return;
		for (const actor of [
			...actorStore.actors.values(),
		])
			yield* destroyReleasedActorFx(actor);
		for (const actor of [
			...actorStore.exitingActors,
		]) {
			yield* presentation.cancelActorFx(actor);
			yield* animator.cancelActorFx(actor);
			yield* actorStore.destroyExitingActorFx(actor);
		}
		const items = readItemsFn(transition);
		yield* actorStore.replaceCanonicalItemsFx(items);
		const arrivals: {
			actor: PixiTileActor;
			pose: ActorPose;
		}[] = [];
		for (const item of items) {
			const pose = yield* surface.readActorPoseFx(item);
			if (pose === null) continue;
			const actor = yield* createActorFx({
				hidden: true,
				item,
				pose,
			});
			arrivals.push({
				actor,
				pose,
			});
		}
		arrivals.sort(
			(left, right) =>
				left.pose.y - right.pose.y ||
				left.pose.x - right.pose.x ||
				left.actor.item.id.localeCompare(right.actor.item.id),
		);
		for (const [index, arrival] of arrivals.entries()) {
			yield* presentation.appearFx({
				actor: arrival.actor,
				delayMs: 120 + Math.min(index * 12, 150),
			});
		}
		yield* drag.requestRefreshFx;
	});

	const exitVisibleItemsFx = Effect.gen(function* () {
		if (closed) return;
		for (const actor of actorStore.actors.values())
			yield* presentation.disappearFx({
				actor,
			});
	});

	const refreshVisualsFx = Effect.gen(function* () {
		if (closed) return;
		for (const actor of actorStore.actors.values()) {
			const pose = yield* surface.readActorPoseFx(actor.item);
			if (pose === null) continue;
			yield* updateTileActorFx({
				actor,
				animator,
				crossfadeArtworkFx: presentation.crossfadeArtworkFx,
				frames: application.frames,
				item: actor.item,
				palette: readPaletteFn(),
				size: pose.size,
				textures,
			});
		}
	});

	return {
		hydrateFx: (transition) =>
			reconcileTransitionFx({
				present: false,
				transition,
			}),
		reconcileFx: (transition) =>
			reconcileTransitionFx({
				present: true,
				transition,
			}),
		boardArriveFx,
		exitVisibleItemsFx,
		refreshVisualsFx,
		closeFx: Effect.sync(() => {
			closed = true;
		}),
	} satisfies MainReconciler;
});
