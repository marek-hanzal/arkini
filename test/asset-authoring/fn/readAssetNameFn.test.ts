import { describe, expect, it } from "vitest";

import { readAssetNameFn } from "~/asset-authoring/fn/readAssetNameFn";

describe("readAssetNameFn", () => {
	it("turns asset ID words into an item-ready title", () => {
		expect(readAssetNameFn("foo-bar_baz")).toBe("Foo Bar Baz");
	});
});
