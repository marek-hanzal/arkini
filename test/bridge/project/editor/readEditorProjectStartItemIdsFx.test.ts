import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readEditorProjectStartItemIdsFx } from "~/bridge/project/editor/readEditorProjectStartItemIdsFx";
import { startTestConfig } from "~test/start/fx/support/startTestConfig";

describe("readEditorProjectStartItemIdsFx", () => {
	it("projects the canonical storage-scope eligibility for each initial surface", () => {
		expect(
			Effect.runSync(
				readEditorProjectStartItemIdsFx({
					items: startTestConfig.items,
					scope: "board",
				}),
			),
		).toEqual(
			new Set([
				"tree",
				"log",
				"backpack",
			]),
		);
		expect(
			Effect.runSync(
				readEditorProjectStartItemIdsFx({
					items: startTestConfig.items,
					scope: "inventory",
				}),
			),
		).toEqual(
			new Set([
				"log",
				"lens",
			]),
		);
		expect(
			Effect.runSync(
				readEditorProjectStartItemIdsFx({
					items: startTestConfig.items,
					scope: "toolbar",
				}),
			),
		).toEqual(
			new Set([
				"log",
				"backpack",
			]),
		);
	});
});
