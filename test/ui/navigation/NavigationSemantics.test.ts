import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { mainPagePanelViewTransitionNameFx } from "~/ui/navigation/mainPagePanelViewTransitionNameFx";
import { resolveLauncherLeaveDestinationFx } from "~/ui/navigation/resolveLauncherLeaveDestinationFx";

describe("navigation semantic effects", () => {
	it.each([
		[
			"/about",
			"about",
			"arkini-panel-about",
		],
		[
			"/arkpacks",
			"arkpacks",
			"arkini-panel-arkpacks",
		],
		[
			"/settings",
			"settings",
			"arkini-panel-settings",
		],
		[
			"/main-menu",
			"main-menu",
			"arkini-panel-main-menu",
		],
	] as const)("maps %s to its exact launcher destination and panel", (pathname, page, panel) => {
		expect(Effect.runSync(resolveLauncherLeaveDestinationFx(pathname))).toEqual({
			destination: page,
		});
		expect(Effect.runSync(mainPagePanelViewTransitionNameFx(page))).toBe(panel);
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
