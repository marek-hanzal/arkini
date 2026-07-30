import { describe, expect, it } from "vitest";

import { AssetSchema } from "~/engine/item/schema/AssetSchema";

describe("AssetSchema", () => {
	it("requires exactly one or two ordered default layers", () => {
		expect(
			AssetSchema.safeParse({
				default: [
					"asset:tree",
				],
			}).success,
		).toBe(true);
		expect(
			AssetSchema.safeParse({
				default: [
					"asset:seed",
					"asset:sapling",
				],
			}).success,
		).toBe(true);
		expect(
			AssetSchema.safeParse({
				default: [],
			}).success,
		).toBe(false);
		expect(
			AssetSchema.safeParse({
				default: [
					"asset:first",
					"asset:second",
					"asset:third",
				],
			}).success,
		).toBe(false);
	});

	it("accepts optional ordered progress sources", () => {
		expect(
			AssetSchema.safeParse({
				default: [
					"asset:item:blueprint",
				],
				sources: [
					"asset:producer:farm",
				],
			}).success,
		).toBe(true);
		expect(
			AssetSchema.safeParse({
				default: [
					"asset:item:blueprint",
				],
				sources: [],
			}).success,
		).toBe(false);
	});

	it("rejects the removed composite field", () => {
		expect(
			AssetSchema.safeParse({
				default: [
					"asset:item:blueprint",
				],
				composite: "asset:producer:farm",
			}).success,
		).toBe(false);
	});
});
