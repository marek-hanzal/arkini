import { describe, expect, it } from "vitest";

import { readResourceNameFn } from "~/game-config-resource/fn/readResourceNameFn";

describe("readResourceNameFn", () => {
	it("turns artwork ID words into an item-ready title", () => {
		expect(readResourceNameFn("foo-bar_baz")).toBe("Foo Bar Baz");
	});
});
