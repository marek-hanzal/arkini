import { Effect } from "effect";

import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";

/** Owns canonical item projections and retained actor identity for the main Pixi scene. */
export const createPixiMainSceneActorStoreFx = Effect.fn("createPixiMainSceneActorStoreFx")(() =>
	Effect.sync((): PixiMainSceneActorStore => {
		const actors = new Map<string, PixiTileActor>();
		const canonicalItems = new Map<string, PixiTileActor["item"]>();
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
			setActorFx: Effect.fn("PixiMainSceneActorStore.setActorFx")((actor) =>
				Effect.sync(() => {
					if (closed) {
						actor.textureGeneration += 1;
						actor.container.destroy({
							children: true,
						});
						return;
					}
					actors.set(actor.item.id, actor);
				}),
			),
			closeFx: Effect.sync(() => {
				if (closed) return;
				closed = true;
				for (const actor of actors.values()) actor.textureGeneration += 1;
				actors.clear();
				canonicalItems.clear();
			}),
		};
	}),
);
