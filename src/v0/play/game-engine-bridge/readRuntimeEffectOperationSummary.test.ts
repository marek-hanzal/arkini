import { describe, expect, it } from "vitest";
import { defaultGameConfig } from "~/v0/game/compiled/defaultGameConfig";
import {
	readRuntimeEffectBenefitLines,
	readRuntimeProductLineActiveEffectBonusLines,
} from "~/v0/play/game-engine-bridge/readRuntimeEffectOperationSummary";

describe("readRuntimeEffectBenefitLines", () => {
	it("describes shrine speed boosts in player-readable copy", () => {
		expect(
			readRuntimeEffectBenefitLines({
				config: defaultGameConfig,
				effectId: "effect:shrine-minor-haste",
			}),
		).toEqual([
			"Grants grant:active:shrine-minor-haste.",
		]);
	});

	it("describes shrine quantity grants in player-readable copy", () => {
		expect(
			readRuntimeEffectBenefitLines({
				config: defaultGameConfig,
				effectId: "effect:shrine-bountiful-offering",
			}),
		).toEqual([
			"Grants grant:active:shrine-bountiful-offering.",
		]);
	});

	it("describes active product-line bonuses from effective runtime state", () => {
		expect(
			readRuntimeProductLineActiveEffectBonusLines({
				baseDurationMs: 1000,
				config: defaultGameConfig,
				effectiveProductLine: {
					appliedEffects: [
						{
							effectId: "effect:shrine-minor-haste",
							effectName: "Minor Haste",
							kind: "grant.duration.multiply",
							sourceId: "effect-source:1",
							sourceItemInstanceId: "item-instance:shrine",
						},
					],
					blocked: false,
					blockReasons: [],
					durationMs: 750,
					lootPlan: {
						baseOutput: [],
						chanceItems: [
							{
								chance: 0.35,
								effectId: "effect:shrine-bountiful-offering",
								effectName: "Bountiful Offering",
								itemId: "item:log",
								quantity: 1,
							},
						],
					},
					requirements: [],
					visible: true,
				},
			}),
		).toEqual([
			"Minor Haste: 25% faster production.",
			"Bountiful Offering: 35% chance for +1× Log.",
		]);
	});

	it("aggregates stacked active product-line bonuses into resulting numbers", () => {
		expect(
			readRuntimeProductLineActiveEffectBonusLines({
				baseDurationMs: 1000,
				config: defaultGameConfig,
				effectiveProductLine: {
					appliedEffects: [
						{
							effectId: "effect:shrine-minor-haste",
							effectName: "Minor Haste",
							kind: "grant.duration.multiply",
							sourceId: "effect-source:1",
							sourceItemInstanceId: "item-instance:shrine-a",
						},
						{
							effectId: "effect:shrine-minor-haste",
							effectName: "Minor Haste",
							kind: "grant.duration.multiply",
							sourceId: "effect-source:2",
							sourceItemInstanceId: "item-instance:shrine-b",
						},
					],
					blocked: false,
					blockReasons: [],
					durationMs: 563,
					lootPlan: {
						baseOutput: [],
						chanceItems: [
							{
								chance: 0.35,
								effectId: "effect:shrine-bountiful-offering",
								effectName: "Bountiful Offering",
								itemId: "item:log",
								quantity: 1,
							},
							{
								chance: 0.35,
								effectId: "effect:shrine-bountiful-offering",
								effectName: "Bountiful Offering",
								itemId: "item:log",
								quantity: 1,
							},
						],
					},
					requirements: [],
					visible: true,
				},
			}),
		).toEqual([
			"Minor Haste ×2: 44% faster production.",
			"Bountiful Offering ×2: 58% chance for at least +1× Log (2 rolls, max +2×).",
		]);
	});
});
