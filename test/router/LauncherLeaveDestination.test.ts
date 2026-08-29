import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { resolveLauncherLeaveDestinationFx } from "~/@routes/-resolveLauncherLeaveDestinationFx";

describe("launcher leave destination", () => {
	it("maps launcher routes to the exact post-release destination", () => {
		expect(Effect.runSync(resolveLauncherLeaveDestinationFx("/about"))).toEqual({
			destination: "about",
		});
		expect(Effect.runSync(resolveLauncherLeaveDestinationFx("/arkpacks"))).toEqual({
			destination: "arkpacks",
		});
		expect(Effect.runSync(resolveLauncherLeaveDestinationFx("/settings"))).toEqual({
			destination: "settings",
		});
	});

	it("defaults unknown launcher paths to the main menu", () => {
		expect(Effect.runSync(resolveLauncherLeaveDestinationFx("/unknown"))).toEqual({
			destination: "main-menu",
		});
	});
});
