import { describe, expect, it } from "vitest";

import { readProjectFormDestinationForPathFn } from "~/project-authoring/fn/readProjectFormDestinationForPathFn";

describe("readProjectFormDestinationForPathFn", () => {
	it("routes an invalid named avatar to its fixed Images box", () => {
		expect(
			readProjectFormDestinationForPathFn([
				"avatars",
				"avatar-04",
			]),
		).toEqual({
			avatar: 3,
			sectionId: "images",
		});
		expect(
			readProjectFormDestinationForPathFn([
				"hero",
			]),
		).toEqual({
			sectionId: "images",
		});
	});
});
