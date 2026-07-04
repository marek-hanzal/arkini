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
});
