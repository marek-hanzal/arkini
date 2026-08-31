import { Effect } from "effect";
import { Container, Graphics, Sprite, Text, TextStyle, Texture } from "pixi.js";

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
	readonly frames: DemandFrameLoop;
	readonly textures: TextureStore;
	readonly visual: ActorVisual;
}

/** Loads one complete visual revision before publishing any texture slot. */
const loadVisualTexturesFx = Effect.fn("loadVisualTexturesFx")(
	({ frames, textures, visual }: LoadVisualTexturesProps) =>
		Effect.sync(() => {
			const generation = RendererRuntime.runSync(
				runVisualReadinessFx({
					kind: "begin",
					visual,
				}),
			);
			const sourceUrl = visual.item.sourceUrl;
			const compositeUrl = visual.item.compositeUrl;
			void Promise.all([
				RendererRuntime.runPromise(textures.loadFx(sourceUrl)),
				compositeUrl === undefined
					? Promise.resolve(Texture.EMPTY)
					: RendererRuntime.runPromise(textures.loadFx(compositeUrl)),
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
	const container = new Container({
		eventMode: "none",
		label: `TileActorVisual:${item.id}:${item.revision}`,
	});
	const primary = new Sprite(Texture.EMPTY);
	const composite = new Sprite(Texture.EMPTY);
	const titleBackground = new Graphics();
	const titleStyle = new TextStyle({
		fill: palette.overlayForeground,
		fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
		fontSize: 14,
		fontWeight: "500",
	});
	const title = new Text({
		style: titleStyle,
		text: item.title,
	});
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
	container.addChild(primary, composite, titleBackground, title, quantityBackground, quantity);
	const visual = {
		container,
		primary,
		composite,
		title,
		titleBackground,
		quantity,
		quantityBackground,
		titleStyle,
		readyListeners: new Set(),
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
		frames,
		textures,
		visual,
	});
	return visual;
});
