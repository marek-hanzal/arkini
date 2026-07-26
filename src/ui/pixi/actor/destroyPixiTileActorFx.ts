import { Effect } from "effect";

import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";

/** Invalidates pending texture writes and physically destroys one retained Pixi actor once. */
export const destroyPixiTileActorFx = Effect.fn("destroyPixiTileActorFx")((actor: PixiTileActor) =>
	Effect.sync(() => {
		if (actor.container.destroyed) return;
		actor.textureGeneration += 1;
		actor.container.destroy({
			children: true,
		});
	}),
);
