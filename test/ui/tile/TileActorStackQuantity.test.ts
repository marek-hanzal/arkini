// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import type { useTileActors } from "~/bridge/tile/useTileActors";
import { TileActorContent } from "~/ui/tile/TileActorContent";

const roots: Array<ReturnType<typeof createRoot>> = [];

const item = (quantity: number): useTileActors.Item => ({
	id: "runtime:stack",
	revision: "revision:stack",
	itemId: "item:stack",
	title: "Stack",
	quantity,
	sourceUrl: "arkini://stack",
	location: {
		scope: "board",
		space: 0,
		position: {
			x: 0,
			y: 0,
		},
	},
	running: false,
	primaryAction: {
		kind: "none",
	},
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

describe("Tile actor stack quantities", () => {
	it("renders the current canonical quantity immediately", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);

		await act(async () => {
			root.render(
				createElement(TileActorContent, {
					item: item(3),
					surfaceId: "board:0",
					phase: "stable",
					feedback: null,
					forbiddenDrop: false,
				}),
			);
		});

		expect(
			container.querySelector<HTMLElement>('[data-ui="TileActorVisual"]')?.dataset
				.tileQuantity,
		).toBe("3");
		expect(container.querySelector('[data-ui="TileActorQuantity"]')?.textContent).toBe("3");
	});
});
