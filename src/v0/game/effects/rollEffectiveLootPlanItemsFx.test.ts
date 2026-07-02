import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import { rollEffectiveLootPlanItemsFx } from "~/v0/game/effects/rollEffectiveLootPlanItemsFx";
import { TestRandomService } from "~/v0/game/engine/test/TestRandomService";
import { withRandomService } from "~/v0/random/logic/withRandomService";

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
