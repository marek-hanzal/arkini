import { describe, expect, it } from "vitest";

import { createDraftFn } from "~/item-authoring/fn/createDraftFn";

describe("createDraftFn", () => {
	it("starts new items with the simple interface", () => {
		expect(
			createDraftFn({
				resourceUid: "resource:new-item",
				uid: "item:new-item",
			}).ui,
		).toBe("simple");
	});
});
