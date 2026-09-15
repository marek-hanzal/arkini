import { describe, expect, it } from "vitest";

import { readPlacementRouteFn } from "~/item-placement/fn/readPlacementRouteFn";

describe("readPlacementRouteFn", () => {
	it("keeps exact scopes exact and orders any-scope fallback from the physical origin", () => {
		expect(
			readPlacementRouteFn({
				itemScope: "toolbar",
				originScope: "board",
				toolbarEnabled: false,
			}).map((step) => step.scope),
		).toEqual([
			"toolbar",
		]);
		expect(
			readPlacementRouteFn({
				itemScope: "any",
				originScope: "inventory",
				toolbarEnabled: true,
			}).map((step) => step.scope),
		).toEqual([
			"inventory",
			"toolbar",
			"board",
		]);
		expect(
			readPlacementRouteFn({
				itemScope: "any",
				originScope: "board",
				toolbarEnabled: false,
			}).map((step) => step.scope),
		).toEqual([
			"board",
			"inventory",
		]);
	});
});
