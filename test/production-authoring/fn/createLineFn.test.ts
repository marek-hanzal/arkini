import { describe, expect, it } from "vitest";
import { createLineFn } from "~/production-authoring/fn/createLineFn";

describe("createLineFn", () => {
	it("keeps identical authored titles independent through supplied identities", () => {
		const first = createLineFn([], "Same title", "Description", "line:first");
		const second = createLineFn(
			[
				first,
			],
			"Same title",
			"Description",
			"line:second",
		);
		expect(first.uid).toBe("line:first");
		expect(second.uid).toBe("line:second");
		expect(second.title).toBe(first.title);
	});
});
