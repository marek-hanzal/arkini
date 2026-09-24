import { Effect, Result } from "effect";
import { expect, it } from "vitest";
import { inventoryTestConfigFn, inventoryStateFn } from "~test/space/support/inventoryTestConfig";
import { fromStateFx } from "~/game-persistence/fx/fromStateFx";
import { GameConfigFx } from "~/game-config/context/GameConfigFx";

it.each([
	"duplicate-owner",
	"authored-address",
	"missing-template",
] as const)("rejects corrupted saved Inventory bindings: %s", (reason) => {
	const config = inventoryTestConfigFn();
	const state = inventoryStateFn();
	state.items[0]!.inventory = 1;
	state.templateUidBySpace = {
		1: "room",
	};
	switch (reason) {
		case "duplicate-owner":
			state.items[1]!.inventory = 1;
			break;
		case "authored-address":
			config.items.token!.merge = [
				{
					action: "space",
					space: 1,
					effect: "keep",
				},
			];
			break;
		case "missing-template":
			state.templateUidBySpace = {
				1: "absent",
			};
			break;
	}
	const result = Effect.runSync(
		fromStateFx({
			state,
		}).pipe(Effect.provideService(GameConfigFx, config), Effect.result),
	);
	expect(Result.isFailure(result)).toBe(true);
	if (Result.isFailure(result)) {
		expect(result.failure).toMatchObject({
			_tag: "RuntimeInvalidError",
			result: {
				issues: expect.arrayContaining([
					{
						type: "space:inventory",
						itemId: reason === "duplicate-owner" ? "second" : "first",
						space: 1,
						reason,
					},
				]),
			},
		});
	}
});
