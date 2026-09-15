import { describe, expect, it } from "vitest";

import { readProjectSectionForPathFn } from "~/project-authoring/fn/readProjectSectionForPathFn";

describe("readProjectSectionForPathFn", () => {
	it("routes project image validation failures to the Images form", () => {
		expect(
			readProjectSectionForPathFn([
				"hero",
			]),
		).toBe("images");
		expect(
			readProjectSectionForPathFn([
				"avatars",
				3,
			]),
		).toBe("images");
	});
});
