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
				outcomeSet: -1,
				outcomeRoll: Number.NaN,
				input: 1.5,
				lineIndex: -1,
				rule: "1",
				when: -1,
				outcomeIndex: -1,
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
				lineIndex: 1,
				outcomeSet: 1,
				outcomeRoll: 2,
				outcomeIndex: 1,
			}),
		).toEqual({
			input: 2,
			rule: 1,
			when: 3,
			lineId: "line-two",
			lineIndex: 1,
			outcomeSet: 1,
			outcomeRoll: 2,
			outcomeIndex: 1,
		});
	});
});
