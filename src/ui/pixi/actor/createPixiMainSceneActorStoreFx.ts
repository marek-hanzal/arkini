import { Effect } from "effect";

import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import { destroyPixiTileActorFx } from "~/ui/pixi/actor/destroyPixiTileActorFx";

/** Owns canonical item projections and retained actor identity for the main Pixi scene. */
export const createPixiMainSceneActorStoreFx = Effect.fn("createPixiMainSceneActorStoreFx")(() =>
	Effect.sync((): PixiMainSceneActorStore => {
		const actors = new Map<string, PixiTileActor>();
		const canonicalItems = new Map<string, PixiTileActor["item"]>();
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
			replaceCanonicalItemsFx: Effect.fn("PixiMainSceneActorStore.replaceCanonicalItemsFx")(
				(items) =>
					Effect.sync(() => {
						canonicalItems.clear();
						for (const item of items) canonicalItems.set(item.id, item);
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
				exitingActors.clear();
			}),
		};
	}),
);
