import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { EditorOriginFlowShortcutHelp } from "~/ui/item/editor/EditorOriginFlowShortcutHelp";

describe("EditorOriginFlowShortcutHelp", () => {
	it("documents graph-level visibility controls", () => {
		const html = renderToStaticMarkup(
			createElement(EditorOriginFlowShortcutHelp, {
				onClose: vi.fn(),
			}),
		);

		expect(html).toContain(">+</kbd>");
		expect(html).toContain(">-</kbd>");
		expect(html).toContain(">0</kbd>");
		expect(html).toContain("Show one more hidden level of the selected Income graph.");
		expect(html).toContain("Hide the farthest visible level of the selected Income graph.");
		expect(html).toContain(
			"Restore the default selected Income view and return to the selected item.",
		);
	});
});
