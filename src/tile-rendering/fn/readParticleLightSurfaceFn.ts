import type { PixiScenePalette } from "~/tile-rendering/type/PixiScenePalette";

const readLinearChannelFn = (color: number, shift: number) => {
	const channel = ((color >> shift) & 0xff) / 255;
	return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
};

const readRelativeLuminanceFn = (color: number) =>
	readLinearChannelFn(color, 16) * 0.2126 +
	readLinearChannelFn(color, 8) * 0.7152 +
	readLinearChannelFn(color, 0) * 0.0722;

/** Comparing resolved colors covers the system theme without trusting DOM attributes. */
export const readParticleLightSurfaceFn = (
	palette: Pick<PixiScenePalette, "foreground" | "surface">,
) => readRelativeLuminanceFn(palette.surface) > readRelativeLuminanceFn(palette.foreground);
