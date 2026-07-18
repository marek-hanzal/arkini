import { describe, expect, it } from "vitest";
import { resolveGameRouteLoadingPresentation } from "~/ui/loading/resolveGameRouteLoadingPresentation";

describe("resolveGameRouteLoadingPresentation", () => {
	it("loads every game route through the shared action loader", () => {
		expect(
			resolveGameRouteLoadingPresentation({
				desiredPackageId: "package:test",
				ownsGame: false,
				pathname: "/game/package:test",
			}),
		).toEqual({
			key: "game-route:package:test",
			label: "Loading game…",
		});
	});

	it("shows the loader only when Main Menu must release a real game", () => {
		expect(
			resolveGameRouteLoadingPresentation({
				desiredPackageId: null,
				ownsGame: true,
				pathname: "/main-menu",
			}),
		).toEqual({
			key: "game-route:main-menu",
			label: "Returning to main menu…",
		});
		expect(
			resolveGameRouteLoadingPresentation({
				desiredPackageId: null,
				ownsGame: false,
				pathname: "/main-menu",
			}),
		).toBe(false);
	});

	it("keeps GameMenu to Settings deliberately fast", () => {
		expect(
			resolveGameRouteLoadingPresentation({
				desiredPackageId: null,
				ownsGame: true,
				pathname: "/settings",
			}),
		).toBe(false);
	});
});
