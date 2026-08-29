import { describe, expect, it } from "vitest";

import { mainPagePanelViewTransitionNameFn } from "~/ui/main-page/fn/mainPagePanelViewTransitionNameFn";

describe("navigation semantics", () => {
	it("maps settings to its semantic panel", () => {
		expect(mainPagePanelViewTransitionNameFn("settings")).toBe("arkini-panel-settings");
	});

	it("assigns the editor welcome screen its own panel identity", () => {
		expect(mainPagePanelViewTransitionNameFn("editor-welcome")).toBe(
			"arkini-panel-editor-welcome",
		);
	});
});
