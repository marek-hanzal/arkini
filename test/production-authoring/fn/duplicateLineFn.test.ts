import { describe, expect, it } from "vitest";
import { createLineFn } from "~/production-authoring/fn/createLineFn";
import { duplicateLineFn } from "~/production-authoring/fn/duplicateLineFn";

describe("duplicateLineFn", () => {
	it("deeply copies with fresh identity, Default cleared and Clock retained", () => {
		const source = {
			...createLineFn([], "Copper Ore", "Mines copper ore.", "line:source"),
			trigger: "clock-interval" as const,
			default: true,
		};
		const duplicate = duplicateLineFn(source, "line:copy");
		expect(duplicate).toEqual({
			...source,
			uid: "line:copy",
			default: false,
		});
		expect(source.uid).toBe("line:source");
		expect(duplicate.input).not.toBe(source.input);
	});
});
