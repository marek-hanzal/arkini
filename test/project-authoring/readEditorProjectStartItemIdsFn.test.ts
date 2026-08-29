import { describe, expect, it } from "vitest";

import { readEditorProjectStartItemIdsFn } from "~/project-authoring/fn/readEditorProjectStartItemIdsFn";
import { startTestConfig } from "~test/game-start/startTestConfig";

describe("readEditorProjectStartItemIdsFn", () => {
	it("projects the canonical storage-scope eligibility for each initial surface", () => {
		expect(
			readEditorProjectStartItemIdsFn({
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
			readEditorProjectStartItemIdsFn({
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
			readEditorProjectStartItemIdsFn({
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
