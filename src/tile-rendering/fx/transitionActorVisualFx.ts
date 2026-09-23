import { Effect } from "effect";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import type { PixiScenePalette } from "~/tile-rendering/type/PixiScenePalette";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import { whenVisualReadyFx } from "~/tile-rendering/fx/whenVisualReadyFx";
import { createActorVisualFx } from "~/tile-rendering/fx/createActorVisualFx";
import { destroyActorVisualFx } from "~/tile-rendering/fx/destroyActorVisualFx";
import { updateActorVisualFx } from "~/tile-rendering/fx/updateActorVisualFx";
import type { DemandFrameLoop } from "~/tile-rendering/service/DemandFrameLoop";
import type { TextureStore } from "~/tile-rendering/fx/createTextureStoreFx";

export namespace transitionActorVisualFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly frames: DemandFrameLoop;
		readonly item: TileActorItem;
		readonly palette: PixiScenePalette;
		readonly size: number;
		readonly textures: TextureStore;
	}
}

/** Keeps the old face visible until the complete replacement is ready to publish. */
export const transitionActorVisualFx = Effect.fn("transitionActorVisualFx")(function* ({
	actor,
	frames,
	item,
	palette,
	size,
	textures,
}: transitionActorVisualFx.Props) {
	const generation = ++actor.visualTransitionGeneration;

	const superseded = actor.pendingVisual;
	if (
		actor.currentVisual.item.sourceUrl === item.sourceUrl &&
		actor.currentVisual.item.compositeUrl === item.compositeUrl
	) {
		actor.pendingVisual = null;
		if (superseded !== null) {
			actor.visuals.delete(superseded);
			yield* destroyActorVisualFx(superseded);
		}
		yield* updateActorVisualFx({
			item,
			palette,
			size,
			visual: actor.currentVisual,
		});
		yield* frames.invalidateFx;
		return;
	}

	const incoming = yield* createActorVisualFx({
		frames,
		item,
		palette,
		size,
		textures,
	});
	incoming.container.alpha = 0;
	actor.visuals.add(incoming);
	actor.pendingVisual = incoming;
	actor.visualLayer.addChild(incoming.container);
	if (superseded !== null) {
		actor.visuals.delete(superseded);
		yield* destroyActorVisualFx(superseded);
	}

	const ownsIncomingFn = () =>
		!actor.container.destroyed &&
		actor.visualTransitionGeneration === generation &&
		actor.pendingVisual === incoming;

	yield* whenVisualReadyFx({
		visual: incoming,
		onCancelFn: () => {
			if (!ownsIncomingFn()) return;
			actor.pendingVisual = null;
			actor.visuals.delete(incoming);
			RendererRuntime.runSync(destroyActorVisualFx(incoming));
			RendererRuntime.runSync(frames.invalidateFx);
		},
		onReadyFn: () => {
			if (!ownsIncomingFn()) return;
			actor.currentVisual = incoming;
			actor.pendingVisual = null;
			for (const visual of [
				...actor.visuals,
			]) {
				if (visual === incoming) continue;
				actor.visuals.delete(visual);
				RendererRuntime.runSync(destroyActorVisualFx(visual));
			}
			incoming.container.alpha = 1;
			RendererRuntime.runSync(frames.invalidateFx);
		},
	});
});
