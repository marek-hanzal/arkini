import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";

const readLinearChannel = (color: number, shift: number) => {
	const channel = ((color >> shift) & 0xff) / 255;
	return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
};

const readRelativeLuminance = (color: number) =>
	readLinearChannel(color, 16) * 0.2126 +
	readLinearChannel(color, 8) * 0.7152 +
	readLinearChannel(color, 0) * 0.0722;

/** Comparing resolved colors covers the system theme without trusting DOM attributes. */
export const readParticleLightSurfaceFn = (
	palette: Pick<PixiScenePalette, "foreground" | "surface">,
) => readRelativeLuminance(palette.surface) > readRelativeLuminance(palette.foreground);
