import { describe, expect, it, vi } from "vitest";

vi.mock("~/item-authoring/ui/Form", () => ({
	Form: () => null,
}));

import { Route } from "~/@routes/editor/$projectId/editor/items/$itemUid/form";

// A merge link without output coordinates must not seed selectors with NaN.
describe("item form deep-link admission", () => {
	it("keeps merge-only links valid and admits output coordinates independently", () => {
		const validateSearch = Route.options.validateSearch;
		if (typeof validateSearch !== "function")
			throw new Error("Expected route search validator");
		expect(
			validateSearch({
				merge: 2,
			}),
		).toEqual({
			merge: 2,
		});
		expect(
			validateSearch({
				merge: 2,
				outputSet: -1,
				outputRoll: Number.NaN,
				input: 1.5,
				rule: "1",
				when: -1,
				outputDrop: -1,
			}),
		).toEqual({
			merge: 2,
		});
		expect(
			validateSearch({
				input: 2,
				rule: 1,
				when: 3,
				lineId: "line-two",
				outputSet: 1,
				outputRoll: 2,
				outputDrop: 1,
			}),
		).toEqual({
			input: 2,
			rule: 1,
			when: 3,
			lineId: "line-two",
			outputSet: 1,
			outputRoll: 2,
			outputDrop: 1,
		});
	});
});
