import { describe, expect, it } from "vitest";
import type { EffectiveLine } from "~/v0/game/effects/EffectiveLine";
import { readRuntimeLootDropViewsFromEffectiveLine } from "~/v0/play/game-engine-bridge/readRuntimeLootDropViewsFromEffectiveLine";

describe("readRuntimeLootDropViewsFromEffectiveLine", () => {
	it("shows disabled weighted entries as 0% instead of stealing enabled-entry odds", () => {
		const effectiveLine: EffectiveLine = {
			appliedEffects: [],
			blocked: false,
			blockReasons: [],
			durationMs: 1000,
			lootPlan: {
				baseOutput: [
					{
						dropEffects: [],
						enabled: true,
						entries: [
							{
								dropEffects: [],
								enabled: true,
								itemId: "item:twig",
								quantity: 1,
								visible: true,
								weight: 1,
							},
						],
						rolls: 1,
						type: "weighted",
						visible: true,
					},
				],
				chanceItems: [],
				visibleOutput: [
					{
						dropEffects: [],
						enabled: true,
						entries: [
							{
								dropEffects: [],
								enabled: true,
								itemId: "item:twig",
								quantity: 1,
								visible: true,
								weight: 1,
							},
							{
								dropEffects: [
									{
										active: false,
										display: "always",
										effectId: "line:test:output:0:entry:1:effect:0",
										effectName: "Locked Plank",
										impact: "availability",
										kind: "grant.require",
										label: "Locked Plank",
										phase: "start",
										ready: false,
										result: "disabled",
									},
								],
								enabled: false,
								itemId: "item:plank",
								quantity: 1,
								visible: true,
								weight: 1,
							},
						],
						rolls: 1,
						type: "weighted",
						visible: true,
					},
				],
			},
			requirements: [],
			visible: true,
		};

		expect(
			readRuntimeLootDropViewsFromEffectiveLine({
				effectiveLine,
			}),
		).toMatchObject([
			{
				chanceLabel: "100%/roll",
				enabled: true,
				itemId: "item:twig",
			},
			{
				chanceLabel: "0%/roll",
				enabled: false,
				itemId: "item:plank",
			},
		]);
	});
	it("shows disabled guaranteed and chance drops as 0% in loot views", () => {
		const disabledEffect = {
			active: false,
			display: "always" as const,
			effectId: "line:test:output:effect:0",
			effectName: "Missing Permit",
			impact: "availability" as const,
			kind: "grant.require",
			label: "Missing Permit",
			phase: "start" as const,
			ready: false,
			result: "disabled",
		} as const;
		const effectiveLine: EffectiveLine = {
			appliedEffects: [],
			blocked: false,
			blockReasons: [],
			durationMs: 1000,
			lootPlan: {
				baseOutput: [],
				chanceItems: [],
				visibleOutput: [
					{
						dropEffects: [
							disabledEffect,
						],
						enabled: false,
						itemId: "item:twig",
						quantity: 1,
						type: "guaranteed",
						visible: true,
					},
					{
						chance: 0.35,
						dropEffects: [
							disabledEffect,
						],
						enabled: false,
						itemId: "item:plank",
						quantity: 1,
						type: "chance",
						visible: true,
					},
				],
			},
			requirements: [],
			visible: true,
		};

		expect(
			readRuntimeLootDropViewsFromEffectiveLine({
				effectiveLine,
			}),
		).toMatchObject([
			{
				chanceLabel: "0%",
				enabled: false,
				itemId: "item:twig",
			},
			{
				chanceLabel: "0%",
				enabled: false,
				itemId: "item:plank",
			},
		]);
	});
	it("hides zero-probability effect carrier drops when runtime chance items replace them", () => {
		const chanceEffect = {
			active: true,
			display: "always" as const,
			effectId: "line:test:output:0:effect:0",
			effectName: "Nearby wood sources",
			impact: "chance" as const,
			kind: "nearby.loot.outputChance.add",
			label: "Nearby wood sources",
			ready: true,
			result: "+115% total",
		} as const;
		const effectiveLine: EffectiveLine = {
			appliedEffects: [],
			blocked: false,
			blockReasons: [],
			durationMs: 1000,
			lootPlan: {
				baseOutput: [],
				chanceItems: [
					{
						chance: 1.15,
						dropEffects: [
							chanceEffect,
						],
						itemId: "item:log",
						quantity: 1,
						sourceDropId: "line:test:output:0",
					},
				],
				visibleOutput: [
					{
						chance: 0,
						dropEffects: [
							chanceEffect,
						],
						enabled: true,
						itemId: "item:log",
						quantity: 1,
						type: "chance",
						visible: true,
					},
				],
			},
			requirements: [],
			visible: true,
		};

		expect(
			readRuntimeLootDropViewsFromEffectiveLine({
				effectiveLine,
			}),
		).toMatchObject([
			{
				chanceLabel: "115%",
				itemId: "item:log",
			},
		]);
	});
});
