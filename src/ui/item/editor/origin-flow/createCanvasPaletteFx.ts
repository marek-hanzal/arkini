import { Effect } from "effect";

import type { CanvasPalette } from "~/ui/item/editor/origin-flow/CanvasPalette";

const readPalette = (host: HTMLElement): CanvasPalette => {
	const probe = document.createElement("span");
	probe.style.display = "none";
	(host.parentElement ?? document.body).append(probe);
	try {
		const read = (property: string) => {
			probe.style.color = `var(${property})`;
			return getComputedStyle(probe).color;
		};
		return {
			accent: read("--ak-accent"),
			canvas: read("--ak-canvas"),
			danger: read("--ak-danger"),
			foreground: read("--ak-foreground"),
			info: read("--ak-info"),
			itemSurfaces: {
				blueprint: read("--ak-flow-item-blueprint-surface"),
				craft: read("--ak-flow-item-craft-surface"),
				deposit: read("--ak-flow-item-deposit-surface"),
				inventory: read("--ak-flow-item-inventory-surface"),
				missing: read("--ak-flow-item-missing-surface"),
				producer: read("--ak-flow-item-producer-surface"),
				simple: read("--ak-flow-item-simple-surface"),
				space: read("--ak-flow-item-simple-surface"),
				stash: read("--ak-flow-item-stash-surface"),
				temporary: read("--ak-flow-item-temporary-surface"),
			},
			line: read("--ak-line"),
			lineStrong: read("--ak-line-strong"),
			muted: read("--ak-muted"),
			sourceSurfaces: {
				charges: read("--ak-flow-source-charges-surface"),
				expiry: read("--ak-flow-source-expiry-surface"),
				line: read("--ak-flow-source-line-surface"),
				merge: read("--ak-flow-source-merge-surface"),
			},
			success: read("--ak-success"),
			warning: read("--ak-warning"),
		};
	} finally {
		probe.remove();
	}
};

/** Creates the reader that resolves Canvas colors from active editor theme tokens. */
export const createCanvasPaletteFx = Effect.fn("createCanvasPaletteFx")(() =>
	Effect.succeed({
		readPalette,
	} as const),
);
