import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { mainPagePanelViewTransitionNameFx } from "~/ui/navigation/mainPagePanelViewTransitionNameFx";
import { resolveLauncherLeaveDestinationFx } from "~/ui/navigation/resolveLauncherLeaveDestinationFx";

describe("navigation semantic effects", () => {
	it("maps a launcher route to its semantic destination and panel", () => {
		expect(Effect.runSync(resolveLauncherLeaveDestinationFx("/settings"))).toEqual({
			destination: "settings",
		});
		expect(Effect.runSync(mainPagePanelViewTransitionNameFx("settings"))).toBe(
			"arkini-panel-settings",
		);
	});

	it("assigns the editor welcome screen its own panel identity", () => {
		expect(Effect.runSync(mainPagePanelViewTransitionNameFx("editor-welcome"))).toBe(
			"arkini-panel-editor-welcome",
		);
	});

	it("defaults unknown launcher paths to the main menu leave destination", () => {
		expect(Effect.runSync(resolveLauncherLeaveDestinationFx("/unknown"))).toEqual({
			destination: "main-menu",
		});
	});
});
