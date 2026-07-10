import { describe, expect, it } from "vitest";

import { CheatSpeedItemSchema } from "./CheatSpeedItemSchema";

const item = {
	id: "item:cheat-speed",
	type: "cheat:speed",
	title: "Onion Watch",
	description: "Toggles the speed cheat.",
	asset: {
		source: [
			"asset:item:cheat-speed:on",
			"asset:item:cheat-speed:off",
		],
	},
	tags: [
		"special:cheat-speed",
	],
	categoryId: "utility",
	scope: "any",
	maxStackSize: 10,
};

describe("CheatSpeedItemSchema", () => {
	it("accepts exactly the ordered on and off asset states", () => {
		expect(CheatSpeedItemSchema.parse(item).asset.source).toEqual([
			"asset:item:cheat-speed:on",
			"asset:item:cheat-speed:off",
		]);
	});

	it("rejects any asset count other than two", () => {
		for (const source of [
			[
				"asset:item:cheat-speed:on",
			],
			[
				"asset:item:cheat-speed:on",
				"asset:item:cheat-speed:off",
				"asset:item:cheat-speed:extra",
			],
		]) {
			expect(
				CheatSpeedItemSchema.safeParse({
					...item,
					asset: {
						source,
					},
				}).success,
			).toBe(false);
		}
	});
});
