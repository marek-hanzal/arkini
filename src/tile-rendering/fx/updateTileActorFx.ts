import { Effect } from "effect";

import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import type { PixiScenePalette } from "~/tile-rendering/type/PixiScenePalette";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import { readActorCursorFn } from "~/tile-rendering/fn/readActorCursorFn";
import { transitionActorVisualFx } from "~/tile-rendering/fx/transitionActorVisualFx";
import { updateActorVisualFx } from "~/tile-rendering/fx/updateActorVisualFx";
import { updateActorProgressFx } from "~/tile-rendering/fx/updateActorProgressFx";
import type { DemandFrameLoop } from "~/tile-rendering/service/DemandFrameLoop";
import type { TextureStore } from "~/tile-rendering/fx/createTextureStoreFx";

export namespace updateTileActorFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly crossfadeArtworkFx: (props: {
			readonly actor: PixiTileActor;
			readonly onCompleteFn: () => void;
		}) => Effect.Effect<void>;
		readonly frames: DemandFrameLoop;
		readonly item: TileActorItem;
		readonly palette: PixiScenePalette;
		readonly size: number;
		readonly textures: TextureStore;
	}
}

const sameVisualRevisionFn = (left: TileActorItem, right: TileActorItem) =>
	left.revision === right.revision &&
	left.artworkScale === right.artworkScale &&
	left.badgeCount === right.badgeCount &&
	left.badgeKind === right.badgeKind &&
	left.location.scope === right.location.scope &&
	left.sourceUrl === right.sourceUrl &&
	left.compositeUrl === right.compositeUrl;

/** Reconciles metadata and geometry while texture-bearing revisions publish only when ready. */
export const updateTileActorFx = Effect.fn("updateTileActorFx")(function* ({
	actor,
	crossfadeArtworkFx,
	frames,
	item,
	palette,
	size,
	textures,
}: updateTileActorFx.Props) {
	const pendingMatches =
		actor.pendingVisual !== null && sameVisualRevisionFn(actor.pendingVisual.item, item);
	const currentMatches = sameVisualRevisionFn(actor.currentVisual.item, item);
	const texturesChanged =
		actor.currentVisual.item.sourceUrl !== item.sourceUrl ||
		actor.currentVisual.item.compositeUrl !== item.compositeUrl;

	actor.item = item;
	if (!actor.dragging) {
		actor.container.cursor = readActorCursorFn({
			phase: "idle",
			running: item.running,
		});
	}
	actor.size = size;
	actor.lifecycleLayer.position.set(size / 2, size / 2);
	actor.lifecycleLayer.pivot.set(size / 2, size / 2);
	actor.visualLayer.position.set(size / 2, size / 2);
	actor.visualLayer.pivot.set(size / 2, size / 2);
	actor.container.hitArea = {
		contains: (x: number, y: number) => x >= 0 && x <= size && y >= 0 && y <= size,
	};

	for (const visual of actor.visuals) {
		yield* updateActorVisualFx({
			item: visual.item,
			palette,
			size,
			visual,
		});
	}

	if (!pendingMatches) {
		if (texturesChanged || actor.pendingVisual !== null) {
			yield* transitionActorVisualFx({
				actor,
				crossfadeArtworkFx,
				frames,
				item,
				palette,
				size,
				textures,
			});
		} else if (!currentMatches) {
			yield* updateActorVisualFx({
				item,
				palette,
				size,
				visual: actor.currentVisual,
			});
		} else {
			actor.currentVisual.item = item;
		}
	}
	// Progress and Clock belong to the actor, so they follow canonical state even while artwork loads.
	yield* updateActorProgressFx({
		actor,
		frames,
		item,
		palette,
		size,
	});
});
