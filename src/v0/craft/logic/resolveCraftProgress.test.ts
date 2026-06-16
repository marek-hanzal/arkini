import { describe, expect, it } from "vitest";
import type { ItemCraftRecipe } from "~/v0/manifest/craft";
import { resolveCraftProgress } from "./resolveCraftProgress";

const recipe = {
	id: "craft:seed-water-sprout",
	resultItemId: "item:sprout",
	durationMs: 1_000,
	inputs: [
		{
			itemId: "item:twig",
			quantity: 2,
		},
		{
			itemId: "item:water",
			quantity: 1,
		},
	],
} satisfies ItemCraftRecipe;

describe("resolveCraftProgress", () => {
	it("caps over-delivered inputs so craft completion cannot exceed one whole craft", () => {
		const progress = resolveCraftProgress({
			recipe,
			storedInputs: new Map([
				[
					"item:twig",
					10,
				],
				[
					"item:water",
					1,
				],
			]),
		});

		expect(progress).toMatchObject({
			current: 3,
			inputProgress: 1,
			inputsComplete: true,
			required: 3,
		});
	});

	it("keeps craft incomplete until every required item type is delivered", () => {
		const progress = resolveCraftProgress({
			recipe,
			storedInputs: new Map([
				[
					"item:twig",
					2,
				],
			]),
		});

		expect(progress).toMatchObject({
			current: 2,
			inputProgress: 2 / 3,
			inputsComplete: false,
			required: 3,
		});
		expect(progress.delivered).toEqual({
			"item:twig": 2,
			"item:water": 0,
		});
	});
});
