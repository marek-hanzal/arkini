import { Effect } from "effect";

import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import { updateTileActorFx } from "~/ui/pixi/actor/updateTileActorFx";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import type { PixiTextureStore } from "~/ui/pixi/runtime/createTextureStoreFx";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";
import type { PixiTileQuantityPresentation } from "~/ui/pixi/motion/PixiTileQuantityPresentation";
import { projectMotionItemFx } from "~/ui/pixi/motion/projectMotionItemFx";

export namespace syncMotionPresentationFx {
	export interface Props {
		readonly actorStore: PixiMainSceneActorStore;
		readonly animator: PixiActorAnimator;
		readonly application: PixiApplicationOwner;
		readonly readPalette: () => PixiScenePalette;
		readonly surface: PixiMainSceneSurface;
		readonly textures: PixiTextureStore;
		readonly quantityPresentationByActorId: ReadonlyMap<string, PixiTileQuantityPresentation>;
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
		const item = yield* projectMotionItemFx(
			canonical,
			quantityPresentationByActorId.get(actorId),
		);
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
