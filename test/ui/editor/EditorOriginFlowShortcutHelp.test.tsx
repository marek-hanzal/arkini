import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { EditorOriginFlowShortcutHelp } from "~/ui/item/editor/EditorOriginFlowShortcutHelp";

describe("EditorOriginFlowShortcutHelp", () => {
	it("documents graph-level visibility, direction and root navigation controls", () => {
		const html = renderToStaticMarkup(
			createElement(EditorOriginFlowShortcutHelp, {
				direction: "income",
				onClose: vi.fn(),
			}),
		);

		expect(html).toContain(">K</kbd>");
		expect(html).toContain(">L</kbd>");
		expect(html).toContain(">0</kbd>");
		expect(html).toContain(">S</kbd>");
		expect(html).toContain("Show one more hidden level of the selected graph.");
		expect(html).toContain("Hide the farthest visible level of the selected graph.");
		expect(html).toContain(
			"Restore the default two-level view and return to the selected item.",
		);
		expect(html).toContain(
			"Cycle terminal/root items of the selected graph to verify where the chain starts or ends.",
		);
		expect(html).toContain("Next item in the selected Income graph.");
	});

	it("describes traversal using the active Outcome direction", () => {
		const html = renderToStaticMarkup(
			createElement(EditorOriginFlowShortcutHelp, {
				direction: "outcome",
				onClose: vi.fn(),
			}),
		);

		expect(html).toContain("Next item in the selected Outcome graph.");
		expect(html).toContain("Previous item in the selected Outcome graph.");
	});
});
