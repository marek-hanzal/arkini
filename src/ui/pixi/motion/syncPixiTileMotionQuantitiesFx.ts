import { Effect } from "effect";

import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import { updatePixiTileActorFx } from "~/ui/pixi/actor/updatePixiTileActorFx";
import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import type { PixiTextureStore } from "~/ui/pixi/runtime/createPixiTextureStoreFx";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";

export namespace syncPixiTileMotionQuantitiesFx {
	export interface Props {
		readonly actorStore: PixiMainSceneActorStore;
		readonly application: PixiApplicationOwner;
		readonly readPalette: () => PixiScenePalette;
		readonly surface: PixiMainSceneSurface;
		readonly textures: PixiTextureStore;
		readonly unsettledQuantities: ReadonlyMap<string, number>;
	}
}

/** Projects canonical quantities while hiding stack payloads that are still in flight. */
export const syncPixiTileMotionQuantitiesFx = Effect.fn("syncPixiTileMotionQuantitiesFx")(
	function* ({
		actorStore,
		application,
		readPalette,
		surface,
		textures,
		unsettledQuantities,
	}: syncPixiTileMotionQuantitiesFx.Props) {
		for (const [actorId, hiddenQuantity] of unsettledQuantities) {
			const actor = actorStore.actors.get(actorId);
			const canonical = actorStore.canonicalItems.get(actorId);
			const pose = canonical === undefined ? null : yield* surface.readActorPoseFx(canonical);
			if (actor === undefined || canonical === undefined || pose === null) continue;
			yield* updatePixiTileActorFx({
				actor,
				frames: application.frames,
				item: {
					...canonical,
					quantity: Math.max(1, canonical.quantity - hiddenQuantity),
				},
				palette: readPalette(),
				size: pose.size,
				textures,
			});
		}
		for (const [actorId, canonical] of actorStore.canonicalItems) {
			if (unsettledQuantities.has(actorId)) continue;
			const actor = actorStore.actors.get(actorId);
			const pose = yield* surface.readActorPoseFx(canonical);
			if (
				actor === undefined ||
				pose === null ||
				actor.item.quantity === canonical.quantity
			) {
				continue;
			}
			yield* updatePixiTileActorFx({
				actor,
				frames: application.frames,
				item: canonical,
				palette: readPalette(),
				size: pose.size,
				textures,
			});
		}
	},
);
