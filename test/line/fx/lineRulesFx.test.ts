import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import type { RuleSchema } from "~/engine/line/schema/rule/RuleSchema";
import { lineRulesFx } from "~/engine/line/fx/lineRulesFx";
import {
	createOriginFx,
	existsWhen,
	lineTestConfig,
	placeLineTestItemFx,
} from "~test/line/fx/support/lineTestRuntime";

describe("lineRulesFx", () => {
	it("evaluates every rule in authoring order without interpreting the results", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const origin = yield* createOriginFx();
				yield* placeLineTestItemFx({
					itemId: "permit",
					x: 0,
				});
				const rules = [
					{
						type: "enable",
						when: [
							existsWhen("permit"),
						],
					},
					{
						type: "disable",
						when: [
							existsWhen("missing"),
						],
					},
					{
						type: "runtime:multiplier",
						when: [
							existsWhen("permit"),
						],
						multiplier: 1.5,
					},
				] satisfies RuleSchema.Type[];

				return yield* lineRulesFx({
					origin: {
						scope: "board",
						space: 0,
						position: origin.location.position,
					},
					rules,
				});
			}).pipe(
				useGameFx({
					config: lineTestConfig,
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
			{
				active: true,
				multiplier: 1.5,
				type: "runtime:multiplier",
			},
		]);
	});

	it("returns an empty result for an empty rule collection", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const origin = yield* createOriginFx();

				return yield* lineRulesFx({
					origin: {
						scope: "board",
						space: 0,
						position: origin.location.position,
					},
					rules: [],
				});
			}).pipe(
				useGameFx({
					config: lineTestConfig,
				}),
			),
		);

		expect(result).toEqual([]);
	});
});
