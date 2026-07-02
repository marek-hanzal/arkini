import { describe, expect, it } from "vitest";
import { defaultGameConfig } from "~/v0/game/compiled/defaultGameConfig";
import {
	readRuntimeEffectBenefitLines,
	readRuntimeProducerLineActiveEffectBonusLines,
} from "~/v0/play/game-engine-bridge/readRuntimeEffectOperationSummary";

describe("readRuntimeEffectBenefitLines", () => {
	it("describes shrine speed boosts in player-readable copy", () => {
		expect(
			readRuntimeEffectBenefitLines({
				config: defaultGameConfig,
				effectId: "effect:shrine-minor-haste",
			}),
		).toEqual([
			"Minor Haste active",
		]);
	});

	it("describes shrine quantity grants in player-readable copy", () => {
		expect(
			readRuntimeEffectBenefitLines({
				config: defaultGameConfig,
				effectId: "effect:shrine-bountiful-offering",
			}),
		).toEqual([
			"Bountiful Offering active",
		]);
	});

	it("describes active product-line bonuses from effective runtime state", () => {
		expect(
			readRuntimeProducerLineActiveEffectBonusLines({
				baseDurationMs: 1000,
				config: defaultGameConfig,
				effectiveProducerLine: {
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
						visibleOutput: [],
						chanceItems: [
							{
								chance: 0.35,
								dropEffects: [
									{
										active: true,
										display: "whenActive",
										effectId: "effect:shrine-bountiful-offering",
										effectName: "Bountiful Offering",
										impact: "chance",
										kind: "grant.loot.extraOutputChance.add",
										label: "Bountiful Offering",
										ready: true,
										result: "+35% extra roll",
									},
								],
								sourceDropId: "line:test:output:0",
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

	it("uses effect multiplier, not cheat-clamped runtime duration, for duration bonus copy", () => {
		expect(
			readRuntimeProducerLineActiveEffectBonusLines({
				baseDurationMs: 60000,
				config: defaultGameConfig,
				effectiveProducerLine: {
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
					durationMs: 1000,
					effectDurationMultiplier: 0.75,
					lootPlan: {
						baseOutput: [],
						visibleOutput: [],
						chanceItems: [],
					},
					requirements: [],
					visible: true,
				},
			}),
		).toEqual([
			"Minor Haste: 25% faster production.",
		]);
	});

	it("aggregates stacked active product-line bonuses into resulting numbers", () => {
		expect(
			readRuntimeProducerLineActiveEffectBonusLines({
				baseDurationMs: 1000,
				config: defaultGameConfig,
				effectiveProducerLine: {
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
						visibleOutput: [],
						chanceItems: [
							{
								chance: 0.35,
								dropEffects: [
									{
										active: true,
										display: "whenActive",
										effectId: "effect:shrine-bountiful-offering",
										effectName: "Bountiful Offering",
										impact: "chance",
										kind: "grant.loot.extraOutputChance.add",
										label: "Bountiful Offering",
										ready: true,
										result: "+35% extra roll",
									},
								],
								sourceDropId: "line:test:output:0",
								effectId: "effect:shrine-bountiful-offering",
								effectName: "Bountiful Offering",
								itemId: "item:log",
								quantity: 1,
							},
							{
								chance: 0.35,
								dropEffects: [
									{
										active: true,
										display: "whenActive",
										effectId: "effect:shrine-bountiful-offering",
										effectName: "Bountiful Offering",
										impact: "chance",
										kind: "grant.loot.extraOutputChance.add",
										label: "Bountiful Offering",
										ready: true,
										result: "+35% extra roll",
									},
								],
								sourceDropId: "line:test:output:0",
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

	it("describes uncapped chance bonuses as guaranteed plus remainder rolls", () => {
		expect(
			readRuntimeProducerLineActiveEffectBonusLines({
				baseDurationMs: 1000,
				config: defaultGameConfig,
				effectiveProducerLine: {
					appliedEffects: [],
					blocked: false,
					blockReasons: [],
					durationMs: 1000,
					lootPlan: {
						baseOutput: [],
						visibleOutput: [],
						chanceItems: [
							{
								chance: 1.15,
								dropEffects: [
									{
										active: true,
										display: "always",
										effectId: "line:test:output:0:effect:0",
										effectName: "Nearby wood sources",
										impact: "chance",
										kind: "nearby.loot.outputChance.add",
										label: "Single tree",
										ready: true,
										result: "+50%",
									},
								],
								effectId: "line:test:output:0:effect:0",
								effectName: "Nearby wood sources",
								itemId: "item:log",
								quantity: 1,
								sourceDropId: "line:test:output:0",
							},
						],
					},
					requirements: [],
					visible: true,
				},
			}),
		).toEqual([
			"Nearby wood sources: +1× Log guaranteed, 15% chance for +1× Log.",
		]);
	});

	it("respects hidden display rules when summarizing chance bonuses", () => {
		expect(
			readRuntimeProducerLineActiveEffectBonusLines({
				baseDurationMs: 1000,
				config: defaultGameConfig,
				effectiveProducerLine: {
					appliedEffects: [],
					blocked: false,
					blockReasons: [],
					durationMs: 1000,
					lootPlan: {
						baseOutput: [],
						visibleOutput: [],
						chanceItems: [
							{
								chance: 0.35,
								effectId: "effect:shrine-bountiful-offering",
								effectName: "Bountiful Offering",
								itemId: "item:log",
								quantity: 1,
								sourceDropId: "line:test:output:0",
							},
						],
					},
					requirements: [],
					visible: true,
				},
			}),
		).toEqual([]);
	});
});
