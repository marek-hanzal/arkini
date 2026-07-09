import { describe, expect, it } from "vitest";
import {
	readEffectBenefitLines,
	readEffectiveLineBonusEntries,
	readEffectiveLineBonusLines,
} from "~/effects/readEffectiveLineBonusEntries";

const defaultGameConfig = {
	items: {
		"item:test:minor-haste": {
			effects: [{
				id: "effect:shrine-minor-haste",
				grants: [{ id: "grant:test:minor-haste", name: "Minor Haste active" }],
				name: "Minor Haste",
			}],
			name: "Minor Haste Source",
		},
		"item:test:bountiful-offering": {
			effects: [{
				id: "effect:shrine-bountiful-offering",
				grants: [{ id: "grant:test:bountiful-offering", name: "Bountiful Offering active" }],
				name: "Bountiful Offering",
			}],
			name: "Bountiful Offering Source",
		},
	},
} as const;

describe("readEffectiveLineBonusEntries", () => {
	it("describes shrine speed boosts in player-readable copy", () => {
		expect(
			readEffectBenefitLines({
				config: defaultGameConfig,
				effectId: "effect:shrine-minor-haste",
			}),
		).toEqual([
			"Minor Haste active",
		]);
	});

	it("describes shrine quantity grants in player-readable copy", () => {
		expect(
			readEffectBenefitLines({
				config: defaultGameConfig,
				effectId: "effect:shrine-bountiful-offering",
			}),
		).toEqual([
			"Bountiful Offering active",
		]);
	});

	it("describes active line bonuses from effective runtime state", () => {
		expect(
			readEffectiveLineBonusLines({
				baseDurationMs: 1000,
				effectiveLine: {
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
			"Speed: 25% faster",
			"Drop: 35% chance for +1×",
		]);
	});

	it("uses effect multiplier, not cheat-clamped runtime duration, for duration bonus copy", () => {
		expect(
			readEffectiveLineBonusLines({
				baseDurationMs: 60000,
				effectiveLine: {
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
			"Speed: 25% faster",
		]);
	});

	it("aggregates stacked active line bonuses into resulting numbers", () => {
		expect(
			readEffectiveLineBonusLines({
				baseDurationMs: 1000,
				effectiveLine: {
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
			"Speed: 44% faster",
			"Drop: 58% chance for at least +1×, max +2×",
		]);
	});

	it("describes uncapped chance bonuses as guaranteed plus remainder rolls", () => {
		expect(
			readEffectiveLineBonusLines({
				baseDurationMs: 1000,
				effectiveLine: {
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
			"Drop: +1× guaranteed, 15% chance for +1×",
		]);
	});

	it("respects hidden display rules when summarizing chance bonuses", () => {
		expect(
			readEffectiveLineBonusLines({
				baseDurationMs: 1000,
				effectiveLine: {
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

	it("keeps active bonus summaries attached to their affected output item", () => {
		expect(
			readEffectiveLineBonusEntries({
				baseDurationMs: 1000,
				effectiveLine: {
					appliedEffects: [
						{
							durationMultiplier: 0.75,
							effectId: "effect:shrine-minor-haste",
							effectName: "Minor Haste",
							kind: "grant.duration.multiply",
							sourceId: "effect-source:1",
							sourceItemInstanceId: "item-instance:shrine",
							targetItemId: "item:log",
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
		).toEqual([
			{
				itemId: "item:log",
				label: "Speed: 25% faster",
			},
			{
				itemId: "item:log",
				label: "Drop: 35% chance for +1×",
			},
		]);
	});
});
