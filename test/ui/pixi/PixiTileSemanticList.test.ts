// @vitest-environment jsdom

import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import { renderPixiTileSemanticListFx } from "~/ui/pixi/semantic/renderPixiTileSemanticListFx";

describe("Pixi tile semantic list", () => {
	it("enumerates visual tile identity and state without keyboard interaction", () => {
		const host = document.createElement("div");
		Effect.runSync(
			renderPixiTileSemanticListFx({
				host,
				items: [
					{
						id: "runtime:producer",
						itemId: "producer",
						location: {
							scope: "board",
							space: 0,
							position: {
								x: 2,
								y: 3,
							},
						},
						primaryAction: {
							kind: "open-lines",
						},
						quantity: 2,
						revision: "revision:producer",
						running: true,
						sourceUrl: "resource:producer",
						title: "Producer",
					} satisfies TileActorItem,
				],
			}),
		);

		expect(host.textContent).toContain("Producer");
		expect(host.textContent).toContain("quantity 2");
		expect(host.textContent).toContain("Board 1, column 3, row 4");
		expect(host.textContent).toContain("production running");
		expect(host.textContent).toContain("opens production lines");
		expect(host.querySelector("button")).toBeNull();
		expect(host.querySelector("[tabindex]")).toBeNull();
	});
});
