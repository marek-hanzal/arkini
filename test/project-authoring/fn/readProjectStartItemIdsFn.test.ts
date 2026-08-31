import { describe, expect, it } from "vitest";

import { readProjectStartItemIdsFn } from "~/project-authoring/fn/readProjectStartItemIdsFn";
import { startTestConfig } from "~test/game-start/support/startTestConfig";

describe("readProjectStartItemIdsFn", () => {
	it("projects the canonical storage-scope eligibility for each initial surface", () => {
		expect(
			readProjectStartItemIdsFn({
				items: startTestConfig.items,
				scope: "board",
			}),
		).toEqual(
			new Set([
				"tree",
				"log",
				"backpack",
			]),
		);
		expect(
			readProjectStartItemIdsFn({
				items: startTestConfig.items,
				scope: "inventory",
			}),
		).toEqual(
			new Set([
				"log",
				"lens",
			]),
		);
		expect(
			readProjectStartItemIdsFn({
				items: startTestConfig.items,
				scope: "toolbar",
			}),
		).toEqual(
			new Set([
				"log",
				"backpack",
			]),
		);
	});
});
