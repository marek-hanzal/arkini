import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { EditorOriginFlowShortcutHelp } from "~/ui/item/editor/EditorOriginFlowShortcutHelp";

describe("EditorOriginFlowShortcutHelp", () => {
	it("documents graph-level visibility, direction and root navigation controls", () => {
		const html = renderToStaticMarkup(
			createElement(EditorOriginFlowShortcutHelp, {
				direction: "output",
				onClose: vi.fn(),
			}),
		);

		expect(html).toContain(">K</kbd>");
		expect(html).toContain(">L</kbd>");
		expect(html).toContain(">0</kbd>");
		expect(html).toContain(">S</kbd>");
		expect(html).toMatch(
			/>K<\/kbd><span>Hide the farthest visible level of the selected graph\.<\/span>/,
		);
		expect(html).toMatch(
			/>L<\/kbd><span>Show one more hidden level of the selected graph\.<\/span>/,
		);
		expect(html).toContain(
			"Restore the default one-level view and return to the selected item.",
		);
		expect(html).toContain(
			"Cycle terminal/root items of the selected graph to verify where the chain starts or ends.",
		);
		expect(html).toContain("Next item in the selected Output graph.");
	});

	it("describes traversal using the active Input direction", () => {
		const html = renderToStaticMarkup(
			createElement(EditorOriginFlowShortcutHelp, {
				direction: "input",
				onClose: vi.fn(),
			}),
		);

		expect(html).toContain("Next item in the selected Input graph.");
		expect(html).toContain("Previous item in the selected Input graph.");
	});
});
