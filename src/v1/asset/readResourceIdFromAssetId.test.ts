import { describe, expect, it } from "vitest";

import { readResourceIdFromAssetId } from "./readResourceIdFromAssetId";

describe("readResourceIdFromAssetId", () => {
	it("maps namespaced asset IDs to packed PNG resource IDs", () => {
		expect(readResourceIdFromAssetId("asset:item:tree")).toBe("item-tree");
		expect(readResourceIdFromAssetId("asset:producer:lumberjack-t1")).toBe(
			"producer-lumberjack-t1",
		);
	});
});
