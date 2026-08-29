import { Effect } from "effect";

import type { MainActorStore } from "~/ui/pixi/actor/MainActorStore";
import { updateTileActorFx } from "~/ui/pixi/actor/updateTileActorFx";
import type { ActorAnimator } from "~/ui/pixi/animation/ActorAnimator";
import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import type { TextureStore } from "~/ui/pixi/runtime/createTextureStoreFx";
import type { MainSurface } from "~/ui/pixi/scene/MainSurface";
import type { QuantityPresentation } from "~/ui/pixi/motion/QuantityPresentation";
import { projectMotionItemFn } from "~/ui/pixi/motion/fn/projectMotionItemFn";

export namespace syncMotionPresentationFx {
	export interface Props {
		readonly actorStore: MainActorStore;
		readonly animator: ActorAnimator;
		readonly application: PixiApplicationOwner;
		readonly readPalette: () => PixiScenePalette;
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
	readPalette,
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
			palette: readPalette(),
			size,
			textures,
		});
	}
});
