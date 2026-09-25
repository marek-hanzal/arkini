import { Effect } from "effect";
import { Container, Filter, Graphics, Sprite, Text, Texture, UniformGroup } from "pixi.js";

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

const unitsFadeVertex = `
in vec2 aPosition;
out vec2 vTextureCoord;
out vec2 vFaceCoord;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

void main() {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  gl_Position = vec4(position, 0.0, 1.0);
  vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw);
  vFaceCoord = aPosition;
}
`;

const unitsFadeFragment = `
in vec2 vTextureCoord;
in vec2 vFaceCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform float uColorFraction;

void main() {
  vec4 color = texture(uTexture, vTextureCoord);
  float depleted = 1.0 - clamp(uColorFraction, 0.0, 1.0);
  float boundary = depleted <= 0.0 ? -0.08 : depleted >= 1.0 ? 1.08 : depleted;
  float grayAmount = 1.0 - smoothstep(boundary - 0.08, boundary + 0.08, vFaceCoord.y);
  float gray = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
  finalColor = vec4(mix(color.rgb, vec3(gray), grayAmount), color.a);
}
`;

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
	const artworkLayer = new Container({
		eventMode: "none",
		label: `TileActorArtwork:${item.id}:${item.revision}`,
	});
	const primary = new Sprite(Texture.EMPTY);
	const composite = new Sprite(Texture.EMPTY);
	const unitsFadeUniforms = new UniformGroup({
		uColorFraction: {
			value: 1,
			type: "f32",
		},
	});
	const unitsFadeFilter = Filter.from({
		gl: {
			vertex: unitsFadeVertex,
			fragment: unitsFadeFragment,
		},
		resources: {
			unitsFadeUniforms,
		},
		resolution: "inherit",
	});
	unitsFadeFilter.enabled = false;
	artworkLayer.filters = [
		unitsFadeFilter,
	];
	const badgeBackground = new Graphics();
	const badge = new Text({
		style: {
			fill: palette.overlayForeground,
			fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
			fontSize: 14,
			fontWeight: "700",
		},
		text: "",
	});
	artworkLayer.addChild(primary, composite);
	container.addChild(artworkLayer, badgeBackground, badge);
	const visual = {
		container,
		primary,
		composite,
		unitsFadeFilter,
		unitsFadeUniforms,
		badge,
		badgeBackground,
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
