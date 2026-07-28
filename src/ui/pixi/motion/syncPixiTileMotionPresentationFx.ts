import { Effect } from "effect";

import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import { updatePixiTileActorFx } from "~/ui/pixi/actor/updatePixiTileActorFx";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import type { PixiTextureStore } from "~/ui/pixi/runtime/createPixiTextureStoreFx";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";
import type { PixiTileQuantityPresentation } from "~/ui/pixi/motion/PixiTileQuantityPresentation";
import { projectPixiTileMotionItem } from "~/ui/pixi/motion/projectPixiTileMotionItem";

export namespace syncPixiTileMotionPresentationFx {
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
export const syncPixiTileMotionPresentationFx = Effect.fn("syncPixiTileMotionPresentationFx")(
	function* ({
		actorStore,
		animator,
		application,
		readPalette,
		surface,
		textures,
		quantityPresentationByActorId,
	}: syncPixiTileMotionPresentationFx.Props) {
		for (const [actorId, canonical] of actorStore.canonicalItems) {
			const actor = actorStore.actors.get(actorId);
			const pose = yield* surface.readActorPoseFx(canonical);
			if (actor === undefined || canonical === undefined || pose === null) continue;
			const item = projectPixiTileMotionItem(
				canonical,
				quantityPresentationByActorId.get(actorId),
			);
			const size = actor.dragging ? actor.size : pose.size;
			if (
				actor.item.quantity === item.quantity &&
				actor.item.badgeCount === item.badgeCount &&
				actor.size === size
			) {
				continue;
			}
			yield* updatePixiTileActorFx({
				actor,
				animator,
				frames: application.frames,
				item,
				palette: readPalette(),
				size,
				textures,
			});
		}
	},
);
