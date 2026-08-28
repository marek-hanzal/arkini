import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { mainPagePanelViewTransitionNameFx } from "~/ui/navigation/mainPagePanelViewTransitionNameFx";

describe("navigation semantic effects", () => {
	it("maps settings to its semantic panel", () => {
		expect(Effect.runSync(mainPagePanelViewTransitionNameFx("settings"))).toBe(
			"arkini-panel-settings",
		);
	});

	it("assigns the editor welcome screen its own panel identity", () => {
		expect(Effect.runSync(mainPagePanelViewTransitionNameFx("editor-welcome"))).toBe(
			"arkini-panel-editor-welcome",
		);
	});
});
