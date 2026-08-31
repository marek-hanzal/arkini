import { Effect } from "effect";

import type { MainActorStore } from "~/tile-rendering/service/MainActorStore";
import { updateTileActorFx } from "~/tile-rendering/fx/updateTileActorFx";
import type { ActorAnimator } from "~/tile-rendering/service/ActorAnimator";
import type { PixiScenePalette } from "~/tile-rendering/type/PixiScenePalette";
import type { PixiApplicationOwner } from "~/tile-rendering/service/PixiApplicationOwner";
import type { TextureStore } from "~/tile-rendering/fx/createTextureStoreFx";
import type { MainSurface } from "~/game-scene/service/MainSurface";
import type { QuantityPresentation } from "~/tile-motion/type/QuantityPresentation";
import { projectMotionItemFn } from "~/tile-motion/fn/projectMotionItemFn";

export namespace syncMotionPresentationFx {
	export interface Props {
		readonly actorStore: MainActorStore;
		readonly animator: ActorAnimator;
		readonly application: PixiApplicationOwner;
		readonly readPaletteFn: () => PixiScenePalette;
		readonly surface: MainSurface;
		readonly textures: TextureStore;
		readonly quantityPresentationByActorId: ReadonlyMap<string, QuantityPresentation>;
	}
}

/** Re-applies the runtime-owned motion overlay without waiting for another engine transition. */
export const syncMotionPresentationFx = Effect.fn("syncMotionPresentationFx")(function* ({
	actorStore,
	animator,
	application,
	readPaletteFn,
	surface,
	textures,
	quantityPresentationByActorId,
}: syncMotionPresentationFx.Props) {
	for (const [actorId, canonical] of actorStore.canonicalItems) {
		const actor = actorStore.actors.get(actorId);
		const pose = yield* surface.readActorPoseFx(canonical);
		if (actor === undefined || canonical === undefined || pose === null) continue;
		const item = projectMotionItemFn(canonical, quantityPresentationByActorId.get(actorId));
		const size = actor.dragging ? actor.size : pose.size;
		if (
			actor.item.quantity === item.quantity &&
			actor.item.badgeCount === item.badgeCount &&
			actor.item.badgeKind === item.badgeKind &&
			actor.size === size
		) {
			continue;
		}
		yield* updateTileActorFx({
			actor,
			animator,
			frames: application.frames,
			item,
			palette: readPaletteFn(),
			size,
			textures,
		});
	}
});
