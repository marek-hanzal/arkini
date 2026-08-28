import { Effect } from "effect";

import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import { destroyPixiTileActorFx } from "~/ui/pixi/actor/destroyPixiTileActorFx";

const readCanonicalSlotKey = (location: PixiTileActor["item"]["location"]) => {
	switch (location.scope) {
		case "board":
			return `board:${location.space}:${location.position.x}:${location.position.y}`;
		case "toolbar":
			return `toolbar:${location.position.x}`;
		default:
			return null;
	}
};

/** Owns canonical item projections and retained actor identity for the main Pixi scene. */
export const createPixiMainSceneActorStoreFx = Effect.fn("createPixiMainSceneActorStoreFx")(() =>
	Effect.sync((): PixiMainSceneActorStore => {
		const actors = new Map<string, PixiTileActor>();
		const canonicalItems = new Map<string, PixiTileActor["item"]>();
		const canonicalOccupants = new Map<string, PixiTileActor["item"]>();
		const exitingActors = new Set<PixiTileActor>();
		let closed = false;

		return {
			actors,
			canonicalItems,
			deleteActorFx: Effect.fn("PixiMainSceneActorStore.deleteActorFx")((actorId) =>
				Effect.sync(() => {
					const actor = actors.get(actorId) ?? null;
					actors.delete(actorId);
					return actor;
				}),
			),
			destroyExitingActorFx: Effect.fn("PixiMainSceneActorStore.destroyExitingActorFx")(
				(actor) =>
					Effect.gen(function* () {
						exitingActors.delete(actor);
						yield* destroyPixiTileActorFx(actor);
					}),
			),
			readActorFx: Effect.fn("PixiMainSceneActorStore.readActorFx")((actorId) =>
				Effect.sync(() => actors.get(actorId) ?? null),
			),
			readCanonicalItemFx: Effect.fn("PixiMainSceneActorStore.readCanonicalItemFx")(
				(actorId) => Effect.sync(() => canonicalItems.get(actorId) ?? null),
			),
			readCanonicalOccupantFx: Effect.fn("PixiMainSceneActorStore.readCanonicalOccupantFx")(
				(location) =>
					Effect.sync(() => {
						const key = readCanonicalSlotKey(location);
						return key === null ? null : (canonicalOccupants.get(key) ?? null);
					}),
			),
			readCanonicalOccupantsFx: Effect.fn("PixiMainSceneActorStore.readCanonicalOccupantsFx")(
				(locations) =>
					Effect.sync(() => {
						const seen = new Set<string>();
						const occupants: PixiTileActor["item"][] = [];
						for (const location of locations) {
							const key = readCanonicalSlotKey(location);
							if (key === null) continue;
							const occupant = canonicalOccupants.get(key);
							if (occupant === undefined || seen.has(occupant.id)) continue;
							seen.add(occupant.id);
							occupants.push(occupant);
						}
						return occupants;
					}),
			),
			replaceCanonicalItemsFx: Effect.fn("PixiMainSceneActorStore.replaceCanonicalItemsFx")(
				(items) =>
					Effect.sync(() => {
						if (closed) return;
						const nextCanonicalItems = new Map<string, PixiTileActor["item"]>();
						const nextCanonicalOccupants = new Map<string, PixiTileActor["item"]>();
						for (const item of items) {
							if (nextCanonicalItems.has(item.id)) {
								throw new Error(
									`Canonical Pixi actor ${item.id} was projected more than once.`,
								);
							}
							nextCanonicalItems.set(item.id, item);
							const key = readCanonicalSlotKey(item.location);
							if (key === null) continue;
							const existing = nextCanonicalOccupants.get(key);
							if (existing !== undefined && existing.id !== item.id) {
								throw new Error(
									`Canonical Pixi slot ${key} is occupied by both ${existing.id} and ${item.id}.`,
								);
							}
							nextCanonicalOccupants.set(key, item);
						}
						canonicalItems.clear();
						canonicalOccupants.clear();
						for (const [itemId, item] of nextCanonicalItems) {
							canonicalItems.set(itemId, item);
						}
						for (const [key, item] of nextCanonicalOccupants) {
							canonicalOccupants.set(key, item);
						}
					}),
			),
			releaseActorFx: Effect.fn("PixiMainSceneActorStore.releaseActorFx")((actorId) =>
				Effect.sync(() => {
					const actor = actors.get(actorId) ?? null;
					actors.delete(actorId);
					if (actor !== null && !actor.container.destroyed) {
						if (actor.onPointerDown !== null) {
							actor.container.off("pointerdown", actor.onPointerDown);
							actor.onPointerDown = null;
						}
						actor.container.eventMode = "none";
						actor.container.cursor = "default";
						actor.dragging = false;
						exitingActors.add(actor);
					}
					return actor;
				}),
			),
			setActorFx: Effect.fn("PixiMainSceneActorStore.setActorFx")(function* (actor) {
				if (closed) {
					yield* destroyPixiTileActorFx(actor);
					return;
				}
				for (const exitingActor of exitingActors) {
					if (exitingActor === actor || exitingActor.item.id !== actor.item.id) {
						continue;
					}
					exitingActors.delete(exitingActor);
					yield* destroyPixiTileActorFx(exitingActor);
				}
				actors.set(actor.item.id, actor);
			}),
			closeFx: Effect.gen(function* () {
				if (closed) return;
				closed = true;
				for (const actor of new Set([
					...actors.values(),
					...exitingActors,
				])) {
					yield* destroyPixiTileActorFx(actor);
				}
				actors.clear();
				canonicalItems.clear();
				canonicalOccupants.clear();
				exitingActors.clear();
			}),
		};
	}),
);
