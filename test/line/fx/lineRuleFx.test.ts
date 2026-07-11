import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import type { RuleSchema } from "~/v1/line/schema/rule/RuleSchema";
import { lineRuleFx } from "~/v1/line/fx/lineRuleFx";
import {
	createOriginFx,
	existsWhen,
	lineTestConfig,
	placeLineTestItemFx,
} from "~test/line/fx/support/lineTestRuntime";

describe("lineRuleFx", () => {
	it("dispatches every line rule to a schema-backed result", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const origin = yield* createOriginFx();
				yield* placeLineTestItemFx({
					itemId: "permit",
					x: 0,
				});
				const rules = [
					{
						type: "show",
						when: [
							existsWhen("permit"),
						],
					},
					{
						type: "hide",
						when: [
							existsWhen("missing"),
						],
					},
					{
						type: "enable",
						when: [
							existsWhen("permit"),
							existsWhen("missing"),
						],
					},
					{
						type: "disable",
						when: [
							existsWhen("permit"),
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

				return yield* Effect.forEach(rules, (rule) => {
					return lineRuleFx({
						origin: origin.location.position,
						rule,
					});
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
				type: "show",
			},
			{
				active: false,
				type: "hide",
			},
			{
				active: false,
				type: "enable",
			},
			{
				active: true,
				type: "disable",
			},
			{
				active: true,
				multiplier: 1.5,
				type: "runtime:multiplier",
			},
		]);
	});
});
