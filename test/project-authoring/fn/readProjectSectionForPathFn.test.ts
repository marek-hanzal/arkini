import { describe, expect, it } from "vitest";

import { readProjectSectionForPathFn } from "~/project-authoring/fn/readProjectSectionForPathFn";

describe("readProjectSectionForPathFn", () => {
	it("routes project artwork validation failures to the Artwork form", () => {
		expect(
			readProjectSectionForPathFn([
				"hero",
			]),
		).toBe("artwork");
		expect(
			readProjectSectionForPathFn([
				"avatars",
				3,
			]),
		).toBe("artwork");
	});
});
