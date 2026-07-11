import { describe, expect, it } from "vitest";

import { TagSchema } from "~/v1/tag/schema/TagSchema";

describe("TagSchema", () => {
	it("accepts non-empty semantic labels", () => {
		expect(TagSchema.parse(" forest ")).toBe("forest");
		expect(TagSchema.safeParse("").success).toBe(false);
	});
});
