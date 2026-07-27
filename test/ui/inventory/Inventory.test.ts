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
		expect(html).toContain('aria-label="Back to board"');
		expect(html).toContain('data-ui="InventoryBackButton"');
		expect(html).toContain("icon-[lucide--arrow-left]");
		expect(html).toContain("left-[var(--ak-viewport-padding)]");
		expect(html).not.toContain("right-[var(--ak-viewport-padding)]");
		expect(html).not.toContain("border-line");
		expect([
			...html.matchAll(/data-ui="PixiInventorySurface"/g),
		]).toHaveLength(1);
	});
});
