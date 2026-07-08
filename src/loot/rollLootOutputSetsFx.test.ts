import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { TestRandomService } from "~/engine/test/TestRandomService";
import { rollLootOutputSetsFx } from "~/loot/rollLootOutputSetsFx";
import { withRandomService } from "~/random/withRandomService";

describe("rollLootOutputSetsFx", () => {
	it("chooses the first output set whose weighted roll wins", () => {
		let chanceIndex = 0;
		const result = Effect.runSync(
			rollLootOutputSetsFx({
				name: "test output sets",
				outputSets: [
					{
						weight: 3,
						entries: [
							{
								itemId: "item:twig",
								type: "guaranteed",
							},
						],
					},
					{
						weight: 1,
						entries: [
							{
								itemId: "item:stone",
								type: "guaranteed",
							},
						],
					},
				],
			}).pipe(
				withRandomService({
					...TestRandomService,
					chance() {
						chanceIndex += 1;
						return chanceIndex === 2;
					},
				}),
			),
		);

		expect(result.items).toEqual([
			{
				itemId: "item:stone",
				quantity: 1,
			},
		]);
	});
});
