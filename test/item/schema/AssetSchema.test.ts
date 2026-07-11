import { describe, expect, it } from "vitest";

import { AssetSchema } from "~/v1/item/schema/AssetSchema";

describe("AssetSchema", () => {
	it("requires one or more ordered source assets", () => {
		expect(
			AssetSchema.safeParse({
				source: [
					"asset:tree",
				],
			}).success,
		).toBe(true);
		expect(
			AssetSchema.safeParse({
				source: [
					"asset:seed",
					"asset:sapling",
				],
			}).success,
		).toBe(true);
		expect(
			AssetSchema.safeParse({
				source: [],
			}).success,
		).toBe(false);
	});

	it("optionally composes a secondary asset with the selected source asset", () => {
		expect(
			AssetSchema.safeParse({
				source: [
					"asset:item:blueprint",
				],
				composite: "asset:producer:farm",
			}).success,
		).toBe(true);
	});
});
