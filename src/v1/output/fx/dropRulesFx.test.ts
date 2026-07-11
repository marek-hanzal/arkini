import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import type { RuleSchema } from "~/v1/output/schema/drop/rule/RuleSchema";
import { dropRulesFx } from "./dropRulesFx";
import {
	createDropRuleOriginFx,
	dropRuleTestConfig,
	permitQuery,
	placePermitFx,
} from "./test/dropRuleTestRuntime";

describe("dropRulesFx", () => {
	it("evaluates every rule in authoring order without interpreting emission", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const origin = yield* createDropRuleOriginFx();
				yield* placePermitFx();
				const rules = [
					{
						type: "enable",
						when: [
							{
								type: "exists",
								query: permitQuery,
							},
						],
					},
					{
						type: "disable",
						when: [
							{
								type: "count",
								query: permitQuery,
								count: 3,
							},
						],
					},
				] satisfies RuleSchema.Type[];

				return yield* dropRulesFx({
					origin,
					rules,
				});
			}).pipe(
				useGameFx({
					config: dropRuleTestConfig,
				}),
			),
		);

		expect(result).toEqual([
			{
				active: true,
				type: "enable",
			},
			{
				active: false,
				type: "disable",
			},
		]);
	});

	it("returns an empty result for an empty rule collection", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const origin = yield* createDropRuleOriginFx();

				return yield* dropRulesFx({
					origin,
					rules: [],
				});
			}).pipe(
				useGameFx({
					config: dropRuleTestConfig,
				}),
			),
		);

		expect(result).toEqual([]);
	});
});
