import { Effect } from "effect";

import type { PixiScenePalette } from "~/tile-rendering/type/PixiScenePalette";

const readResolvedCssColorFn = (
	probe: HTMLElement,
	context: CanvasRenderingContext2D,
	property: string,
) => {
	probe.style.color = `var(${property})`;
	const value = getComputedStyle(probe).color;
	context.clearRect(0, 0, 1, 1);
	context.fillStyle = value;
	context.fillRect(0, 0, 1, 1);
	const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
	return ((red ?? 0) << 16) | ((green ?? 0) << 8) | (blue ?? 0);
};

/** Resolves the active React shell theme once for native Pixi drawing. */
export const readScenePaletteFx = Effect.fn("readScenePaletteFx")((host: HTMLElement) =>
	Effect.sync((): PixiScenePalette => {
		const probe = document.createElement("span");
		probe.style.display = "none";
		const canvas = document.createElement("canvas");
		canvas.width = 1;
		canvas.height = 1;
		const context = canvas.getContext("2d", {
			willReadFrequently: true,
		});
		if (context === null) throw new Error("Pixi CSS color resolver has no Canvas 2D context.");
		host.append(probe);
		try {
			const readFn = (property: string) => readResolvedCssColorFn(probe, context, property);
			return {
				accent: readFn("--ak-accent"),
				danger: readFn("--ak-danger"),
				foreground: readFn("--ak-foreground"),
				gridA: readFn("--ak-tile-grid-slot-surface-a"),
				gridB: readFn("--ak-tile-grid-slot-surface-b"),
				line: readFn("--ak-line"),
				overlay: readFn("--ak-overlay"),
				overlayForeground: readFn("--ak-overlay-foreground"),
				success: readFn("--ak-success"),
				surface: readFn("--ak-surface"),
				toolbarA: readFn("--ak-toolbar-grid-slot-surface-a"),
				toolbarB: readFn("--ak-toolbar-grid-slot-surface-b"),
			};
		} finally {
			probe.remove();
		}
	}),
);
