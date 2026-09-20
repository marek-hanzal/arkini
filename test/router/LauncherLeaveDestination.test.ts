import { describe, expect, it } from "vitest";

import { resolveLauncherLeaveDestinationFn } from "~/@routes/-launcher/fn/resolveLauncherLeaveDestinationFn";

describe("launcher leave destination", () => {
	it("maps launcher routes to the exact post-release destination", () => {
		expect(resolveLauncherLeaveDestinationFn("/about")).toEqual({
			destination: "about",
		});
		expect(resolveLauncherLeaveDestinationFn("/serapacks")).toEqual({
			destination: "serapacks",
		});
		expect(resolveLauncherLeaveDestinationFn("/settings")).toEqual({
			destination: "settings",
		});
	});

	it("defaults unknown launcher paths to the main menu", () => {
		expect(resolveLauncherLeaveDestinationFn("/unknown")).toEqual({
			destination: "main-menu",
		});
	});
});
