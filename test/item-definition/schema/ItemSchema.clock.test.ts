import { describe, expect, it } from "vitest";

import { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { createSimpleItem } from "~test/game-config-validation/support/gameValidationTestSource";

describe("ItemSchema Clock storage", () => {
	it.each([
		"any",
		"board",
		"inventory",
		"toolbar",
	] as const)("accepts %s storage", (scope) => {
		expect(
			ItemSchema.parse({
				...createSimpleItem("clock"),
				scope,
				maxStackSize: 1,
				clock: {
					durationMs: 100,
				},
			}).scope,
		).toBe(scope);
	});
});
