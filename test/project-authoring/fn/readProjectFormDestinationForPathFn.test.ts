import { describe, expect, it } from "vitest";

import { readProjectFormDestinationForPathFn } from "~/project-authoring/fn/readProjectFormDestinationForPathFn";

describe("readProjectFormDestinationForPathFn", () => {
	it("preserves the invalid avatar index for the routed Artwork editor", () => {
		expect(
			readProjectFormDestinationForPathFn([
				"avatars",
				3,
			]),
		).toEqual({
			avatar: 3,
			sectionId: "artwork",
		});
		expect(
			readProjectFormDestinationForPathFn([
				"hero",
			]),
		).toEqual({
			sectionId: "artwork",
		});
	});
});
