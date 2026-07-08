import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createEngineTestConfig } from "~/engine/test/createEngineTestConfig";
import { rollEffectiveLootPlanItemsFx } from "~/effects/rollEffectiveLootPlanItemsFx";
import { TestRandomService } from "~/engine/test/TestRandomService";
import { withRandomService } from "~/random/withRandomService";

const runRoll = (props: rollEffectiveLootPlanItemsFx.Props) =>
	Effect.runSync(rollEffectiveLootPlanItemsFx(props).pipe(withRandomService(TestRandomService)));

describe("rollEffectiveLootPlanItemsFx", () => {
	it("converts uncapped chance into guaranteed rolls plus one remainder roll", () => {
		const result = runRoll({
			config: createEngineTestConfig(),
			lootPlan: {
				baseOutput: [],
				visibleOutput: [],
				chanceItems: [
					{
						chance: 2.5,
						itemId: "item:twig",
						sourceDropId: "line:test:output:0",
					},
				],
			},
		});

		expect(result.items).toEqual([
			{
				itemId: "item:twig",
				quantity: 1,
			},
			{
				itemId: "item:twig",
				quantity: 1,
			},
			{
				itemId: "item:twig",
				quantity: 1,
			},
		]);
	});
	it("chooses exactly one weighted output set before rolling its entries", () => {
		let chanceIndex = 0;
		const result = Effect.runSync(
			rollEffectiveLootPlanItemsFx({
				lootPlan: {
					baseOutput: [],
					visibleOutput: [],
					chanceItems: [],
					outputSets: [
						{
							weight: 3,
							baseOutput: [
								{
									dropEffects: [],
									enabled: true,
									itemId: "item:twig",
									quantity: 1,
									type: "guaranteed",
									visible: true,
								},
							],
							chanceItems: [],
							visibleOutput: [],
						},
						{
							weight: 1,
							baseOutput: [
								{
									dropEffects: [],
									enabled: true,
									itemId: "item:stone",
									quantity: 1,
									type: "guaranteed",
									visible: true,
								},
							],
							chanceItems: [],
							visibleOutput: [],
						},
					],
				},
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
