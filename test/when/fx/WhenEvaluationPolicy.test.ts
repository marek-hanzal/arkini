import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { lineRuleDisableFx } from "~/engine/line/fx/lineRuleDisableFx";
import { lineRuleEnableFx } from "~/engine/line/fx/lineRuleEnableFx";
import { lineRuleHideFx } from "~/engine/line/fx/lineRuleHideFx";
import { lineRuleRuntimeAdjustFx } from "~/engine/line/fx/lineRuleRuntimeAdjustFx";
import { lineRuleRuntimeMultiplierFx } from "~/engine/line/fx/lineRuleRuntimeMultiplierFx";
import { lineRuleShowFx } from "~/engine/line/fx/lineRuleShowFx";
import { dropRuleDisableFx } from "~/engine/output/fx/dropRuleDisableFx";
import { dropRuleEnableFx } from "~/engine/output/fx/dropRuleEnableFx";
import {
	WhenEvaluationFx,
	type WhenEvaluationIntent,
} from "~/engine/when/context/WhenEvaluationFx";
import { dropRuleTestConfig } from "~test/output/fx/support/dropRuleTestRuntime";

describe("WhenEvaluationFx", () => {
	it("passes positive and veto rule polarity explicitly to the policy", () => {
		const intents: WhenEvaluationIntent[] = [];
		const origin = {
			scope: "board" as const,
			space: 0,
			position: {
				x: 0,
				y: 0,
			},
		};
		const when = {
			query: {
				scope: "any" as const,
				selector: {
					itemId: "permit",
					type: "item" as const,
				},
			},
			type: "exists" as const,
		};

		Effect.runSync(
			Effect.gen(function* () {
				yield* lineRuleEnableFx({
					origin,
					rule: {
						type: "enable",
						when: [
							when,
						],
					},
				});
				yield* lineRuleDisableFx({
					origin,
					rule: {
						type: "disable",
						when: [
							when,
						],
					},
				});
				yield* lineRuleShowFx({
					origin,
					rule: {
						type: "show",
						when: [
							when,
						],
					},
				});
				yield* lineRuleHideFx({
					origin,
					rule: {
						type: "hide",
						when: [
							when,
						],
					},
				});
				yield* lineRuleRuntimeAdjustFx({
					origin,
					rule: {
						adjustMs: -100,
						type: "runtime:adjust",
						when: [
							when,
						],
					},
				});
				yield* lineRuleRuntimeAdjustFx({
					origin,
					rule: {
						adjustMs: 100,
						type: "runtime:adjust",
						when: [
							when,
						],
					},
				});
				yield* lineRuleRuntimeMultiplierFx({
					origin,
					rule: {
						multiplier: 0.5,
						type: "runtime:multiplier",
						when: [
							when,
						],
					},
				});
				yield* lineRuleRuntimeMultiplierFx({
					origin,
					rule: {
						multiplier: 2,
						type: "runtime:multiplier",
						when: [
							when,
						],
					},
				});
				yield* dropRuleEnableFx({
					origin,
					rule: {
						type: "enable",
						when: [
							when,
						],
					},
				});
				yield* dropRuleDisableFx({
					origin,
					rule: {
						type: "disable",
						when: [
							when,
						],
					},
				});
			}).pipe(
				Effect.provideService(WhenEvaluationFx, {
					evaluate: ({ intent }) =>
						Effect.sync(() => {
							if (intent !== undefined) intents.push(intent);
							return true;
						}),
				}),
				useGameFx({
					config: dropRuleTestConfig,
				}),
			),
		);

		expect(intents).toEqual([
			"satisfy",
			"falsify",
			"satisfy",
			"falsify",
			"satisfy",
			"falsify",
			"satisfy",
			"falsify",
			"satisfy",
			"falsify",
		]);
	});
});
