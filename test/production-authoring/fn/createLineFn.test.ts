import { describe, expect, it } from "vitest";

import { createLineFn } from "~/production-authoring/fn/createLineFn";

describe("createLineFn", () => {
	it("derives a fresh line ID from its default title", () => {
		const line = createLineFn([], "New production line", "Description");

		expect(line.id).toBe("new-production-line");
		expect(line.title).toBe("New production line");
	});

	it("adds a numeric suffix when the title-derived ID is already used", () => {
		const first = createLineFn([], "New production line", "Description");
		const second = createLineFn(
			[
				first,
			],
			"New production line",
			"Description",
		);
		const third = createLineFn(
			[
				first,
				second,
			],
			"New production line",
			"Description",
		);

		expect(second.id).toBe("new-production-line-2");
		expect(third.id).toBe("new-production-line-3");
	});
});
