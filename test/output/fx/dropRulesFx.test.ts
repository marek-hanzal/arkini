import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import type { RuleSchema } from "~/engine/output/schema/drop/rule/RuleSchema";
import { dropRulesFx } from "~/engine/output/fx/dropRulesFx";
import {
	createDropRuleOriginFx,
	dropRuleTestConfig,
	permitQuery,
	placePermitFx,
} from "~test/output/fx/support/dropRuleTestRuntime";

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
					origin: {
						scope: "board",
						space: 0,
						position: origin.location.position,
					},
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
					origin: {
						scope: "board",
						space: 0,
						position: origin.location.position,
					},
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
