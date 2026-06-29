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
			"25% faster production for Grain, Log, Stone, Plank, Vegetables, Water.",
		]);
	});

	it("describes shrine quantity boosts in player-readable copy", () => {
		expect(
			readRuntimeEffectBenefitLines({
				config: defaultGameConfig,
				effectId: "effect:shrine-bountiful-offering",
			}),
		).toEqual([
			"Adds 35% chance for +1× extra output when producing Grain, Log, Stone, Vegetables, Water.",
			"Adds 30% chance for +1× extra output when producing Egg, Milk, Piglet, Plank, Stone Block, Wool.",
			"Adds 25% chance for +1× extra output when producing Beer, Beer Barrel, Bread, Bricks, Cheese, Clay · +6 more.",
			"Adds 20% chance for +1× extra output when producing Feast, Glass, Nails, Paper, Roof Tiles, Sand · +1 more.",
			"Adds 15% chance for +1× extra output when producing Common Cloth, Common Clothing, Leather, Luxury Cloth, Luxury Clothing, Pigment · +1 more.",
			"Adds 12% chance for +1× extra output when producing Charcoal, Construction Bundle.",
			"Adds 10% chance for +1× extra output when producing Coal Cart, Gold Ingot, Gold Ore Cart, Iron Ingot, Iron Ore Cart.",
			"Adds 5% chance for +1× extra output when producing Marble, Marble Block, Stained Glass.",
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
							kind: "duration.multiply",
							sourceId: "effect-source:1",
							sourceItemInstanceId: "item-instance:shrine",
						},
					],
					blocked: false,
					blockReasons: [],
					durationMs: 750,
					lootPlan: {
						appendOutputs: [],
						baseDropChance: 1,
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
							kind: "duration.multiply",
							sourceId: "effect-source:1",
							sourceItemInstanceId: "item-instance:shrine-a",
						},
						{
							effectId: "effect:shrine-minor-haste",
							effectName: "Minor Haste",
							kind: "duration.multiply",
							sourceId: "effect-source:2",
							sourceItemInstanceId: "item-instance:shrine-b",
						},
					],
					blocked: false,
					blockReasons: [],
					durationMs: 563,
					lootPlan: {
						appendOutputs: [],
						baseDropChance: 1,
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
					visible: true,
				},
			}),
		).toEqual([
			"Minor Haste ×2: 44% faster production.",
			"Bountiful Offering ×2: 58% chance for at least +1× Log (2 rolls, max +2×).",
		]);
	});
});
