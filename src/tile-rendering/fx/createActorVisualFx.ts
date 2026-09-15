import { Effect } from "effect";
import { Container, Graphics, Sprite, Text, Texture } from "pixi.js";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import type { ActorVisual } from "~/tile-rendering/type/ActorVisual";
import { runVisualReadinessFx } from "~/tile-rendering/fx/runVisualReadinessFx";
import { updateActorVisualFx } from "~/tile-rendering/fx/updateActorVisualFx";
import type { PixiScenePalette } from "~/tile-rendering/type/PixiScenePalette";
import type { DemandFrameLoop } from "~/tile-rendering/service/DemandFrameLoop";
import type { TextureStore } from "~/tile-rendering/fx/createTextureStoreFx";

export namespace createActorVisualFx {
	export interface Props {
		readonly frames: DemandFrameLoop;
		readonly item: TileActorItem;
		readonly palette: PixiScenePalette;
		readonly size: number;
		readonly textures: TextureStore;
	}
}

interface LoadVisualTexturesProps {
	readonly compositeTextureFx: Effect.Effect<Texture, unknown, never>;
	readonly frames: DemandFrameLoop;
	readonly primaryTextureFx: Effect.Effect<Texture, unknown, never>;
	readonly visual: ActorVisual;
}

/** Loads one complete visual revision before publishing any texture slot. */
const loadVisualTexturesFx = Effect.fn("loadVisualTexturesFx")(
	({ compositeTextureFx, frames, primaryTextureFx, visual }: LoadVisualTexturesProps) =>
		Effect.sync(() => {
			const generation = RendererRuntime.runSync(
				runVisualReadinessFx({
					kind: "begin",
					visual,
				}),
			);
			void Promise.all([
				RendererRuntime.runPromise(primaryTextureFx),
				RendererRuntime.runPromise(compositeTextureFx),
			])
				.then(([primary, composite]) => {
					if (
						visual.textureState === "destroyed" ||
						visual.textureGeneration !== generation
					) {
						return;
					}
					visual.primary.texture = primary;
					visual.composite.texture = composite;
					RendererRuntime.runSync(
						runVisualReadinessFx({
							generation,
							kind: "complete",
							visual,
						}),
					);
					RendererRuntime.runSync(frames.invalidateFx);
				})
				.catch((cause) => {
					if (
						visual.textureState === "destroyed" ||
						visual.textureGeneration !== generation
					) {
						return;
					}
					RendererRuntime.runSync(
						runVisualReadinessFx({
							generation,
							kind: "fail",
							visual,
						}),
					);
					visual.releaseTexturesFn();
					frames.reportCriticalFailureFn(cause);
				});
		}),
);

/** Creates one independently loadable, atomically publishable tile face revision. */
export const createActorVisualFx = Effect.fn("createActorVisualFx")(function* ({
	frames,
	item,
	palette,
	size,
	textures,
}: createActorVisualFx.Props) {
	const primaryLease = textures.acquireFn(item.sourceUrl);
	const compositeLease =
		item.compositeUrl === undefined ? undefined : textures.acquireFn(item.compositeUrl);
	let texturesReleased = false;
	const releaseTexturesFn = () => {
		if (texturesReleased) return;
		texturesReleased = true;
		primaryLease.releaseFn();
		compositeLease?.releaseFn();
	};
	const container = new Container({
		eventMode: "none",
		label: `TileActorVisual:${item.id}:${item.revision}`,
	});
	const primary = new Sprite(Texture.EMPTY);
	const composite = new Sprite(Texture.EMPTY);
	const quantityBackground = new Graphics();
	const quantity = new Text({
		style: {
			fill: palette.overlayForeground,
			fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
			fontSize: 14,
			fontWeight: "700",
		},
		text: String(item.quantity),
	});
	container.addChild(primary, composite, quantityBackground, quantity);
	const visual = {
		container,
		primary,
		composite,
		quantity,
		quantityBackground,
		readyListeners: new Set(),
		releaseTexturesFn,
		reportCriticalFailureFn: frames.reportCriticalFailureFn,
		item,
		size,
		textureGeneration: 0,
		textureState: "loading",
	} satisfies ActorVisual;
	yield* updateActorVisualFx({
		item,
		palette,
		size,
		visual,
	});
	yield* loadVisualTexturesFx({
		compositeTextureFx: compositeLease?.textureFx ?? Effect.succeed(Texture.EMPTY),
		frames,
		primaryTextureFx: primaryLease.textureFx,
		visual,
	});
	return visual;
});
