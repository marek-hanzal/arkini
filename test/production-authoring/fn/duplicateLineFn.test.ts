import { describe, expect, it } from "vitest";

import { createLineFn } from "~/production-authoring/fn/createLineFn";
import { duplicateLineFn } from "~/production-authoring/fn/duplicateLineFn";

describe("duplicateLineFn", () => {
	it("deeply copies a line with a fresh identity and no exclusive selections", () => {
		const source = {
			...createLineFn([], "Copper Ore", "Mines copper ore."),
			clock: true,
			default: true,
		};
		const duplicate = duplicateLineFn(
			[
				source,
				{
					...createLineFn([], "Other", "Other line."),
					id: "copper-ore-2",
				},
			],
			source,
		);

		expect(duplicate).toEqual({
			...source,
			id: "copper-ore-3",
			clock: false,
			default: false,
		});
		expect(duplicate).not.toBe(source);
		expect(duplicate.input).not.toBe(source.input);
	});

	it("keeps an incomplete blank identity blank for deliberate authoring", () => {
		const source = createLineFn([], "", "");

		expect(
			duplicateLineFn(
				[
					source,
				],
				source,
			).id,
		).toBe("");
	});
});
