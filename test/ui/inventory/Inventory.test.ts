import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { Inventory } from "~/ui/inventory/Inventory";

vi.mock("~/ui/pixi/PixiInventorySurface", async () => {
	const { createElement: createReactElement } = await import("react");
	return {
		PixiInventorySurface: () =>
			createReactElement("div", {
				"data-ui": "PixiInventorySurface",
			}),
	};
});

describe("Inventory", () => {
	it("renders one full-screen Pixi scene with non-modal Board return chrome", () => {
		const html = renderToStaticMarkup(
			createElement(Inventory, {
				onClose: () => undefined,
			}),
		);

		expect(html).toContain('data-ui="Inventory"');
		expect(html).not.toContain('role="dialog"');
		expect(html).not.toContain('aria-modal="true"');
		expect(html).not.toContain("bg-canvas");
		expect(html).toContain('data-ui="InventoryViewport"');
		expect(html).toContain('aria-label="Close inventory"');
		expect([
			...html.matchAll(/data-ui="PixiInventorySurface"/g),
		]).toHaveLength(1);
	});
});
