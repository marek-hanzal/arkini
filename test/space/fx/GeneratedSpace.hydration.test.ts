import { Effect, Result } from "effect";
import { expect, it } from "vitest";
import {
	generatedSpaceTestConfigFn,
	generatedSpaceStateFn,
} from "~test/space/support/generatedSpaceTestConfig";
import { fromStateFx } from "~/game-persistence/fx/fromStateFx";
import { GameConfigFx } from "~/game-config/context/GameConfigFx";

it.each([
	"duplicate-owner",
	"authored-address",
	"missing-template",
] as const)("rejects corrupted saved generated bindings: %s", (reason) => {
	const config = generatedSpaceTestConfigFn();
	const state = generatedSpaceStateFn();
	state.items[0]!.generatedSpace = 1;
	state.templateUidBySpace = {
		1: "room",
	};
	switch (reason) {
		case "duplicate-owner":
			state.items[1]!.generatedSpace = 1;
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
						type: "space:generated",
						itemId: reason === "duplicate-owner" ? "second" : "first",
						space: 1,
						reason,
					},
				]),
			},
		});
	}
});
