import { describe, expect, it } from "vitest";
import { createEngineTestConfig } from "~/engine/test/createEngineTestConfig";
import { runInitialSave } from "~/engine/applyGameActionFx.testSupport";
import type { EffectiveLine } from "~/effects/EffectiveLine";
import { readEffectiveLineBonusSummary } from "~/effects/readEffectiveLineBonusEntries";
import { readRuntimeLineOutputViews } from "~/play/game-engine-bridge/readRuntimeLineOutputViews";

describe("readRuntimeLineOutputViews", () => {
	it("lists every potential output sorted by explicit output sort", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			items: {
				...baseConfig.items,
				"item:pollution": {
					assetIds: [
						"asset:test",
					],
					description: "Pollution",
					maxStackSize: 99,
					name: "Pollution",
					storage: "board",
					tags: [],
					tier: 0,
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const effectiveLine: EffectiveLine = {
			appliedEffects: [],
			blocked: false,
			blockReasons: [],
			durationMs: 1000,
			lootPlan: {
				baseOutput: [
					{
						chance: 0.25,
						dropEffects: [],
						enabled: true,
						itemId: "item:pollution",
						quantity: 1,
						sort: 20,
						type: "chance",
						visible: true,
					},
					{
						dropEffects: [],
						enabled: true,
						itemId: "item:twig",
						quantity: 2,
						sort: 10,
						type: "guaranteed",
						visible: true,
					},
				],
				visibleOutput: [
					{
						chance: 0.25,
						dropEffects: [],
						enabled: true,
						itemId: "item:pollution",
						quantity: 1,
						sort: 20,
						type: "chance",
						visible: true,
					},
					{
						dropEffects: [],
						enabled: true,
						itemId: "item:twig",
						quantity: 2,
						sort: 10,
						type: "guaranteed",
						visible: true,
					},
				],
				chanceItems: [
					{
						chance: 0.5,
						itemId: "item:plank",
						sourceDropId: "line:test:output:bonus",
					},
				],
			},
			requirements: [],
			visible: true,
		};

		expect(
			readRuntimeLineOutputViews({
				effectBonusSummary: readEffectiveLineBonusSummary({
					baseDurationMs: 1000,
					effectiveLine,
				}),
				lootPlan: effectiveLine.lootPlan,
				save,
			}),
		).toMatchObject([
			{
				itemId: "item:twig",
				kind: "guaranteed",
				quantity: 2,
				sort: 10,
			},
			{
				itemId: "item:pollution",
				kind: "chance",
				probability: 0.25,
				sort: 20,
			},
			{
				itemId: "item:plank",
				kind: "chance",
				probability: 0.5,
			},
		]);
	});
	it("exposes drop-owned effect state for visible disabled outputs", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const effectiveLine: EffectiveLine = {
			appliedEffects: [],
			blocked: false,
			blockReasons: [],
			durationMs: 1000,
			lootPlan: {
				baseOutput: [],
				visibleOutput: [
					{
						dropEffects: [
							{
								active: false,
								display: "always",
								effectId: "line:test:output:0:effect:0",
								effectName: "Unlock Twig Drop",
								impact: "availability",
								kind: "grant.require",
								label: "Unlock Twig Drop",
								phase: "start",
								ready: false,
								result: "disabled",
							},
						],
						enabled: false,
						itemId: "item:twig",
						quantity: 2,
						type: "guaranteed",
						visible: true,
					},
				],
				chanceItems: [],
			},
			requirements: [],
			visible: true,
		};

		expect(
			readRuntimeLineOutputViews({
				effectBonusSummary: readEffectiveLineBonusSummary({
					baseDurationMs: 1000,
					effectiveLine,
				}),
				lootPlan: effectiveLine.lootPlan,
				save,
			}),
		).toMatchObject([
			{
				enabled: false,
				effects: [
					{
						impact: "availability",
						label: "Unlock Twig Drop",
						ready: false,
						result: "disabled",
					},
				],
				itemId: "item:twig",
			},
		]);
	});
	it("exposes disabled guaranteed and chance outputs with zero runtime probability", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
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
				chanceItems: [],
			},
			requirements: [],
			visible: true,
		};

		expect(
			readRuntimeLineOutputViews({
				effectBonusSummary: readEffectiveLineBonusSummary({
					baseDurationMs: 1000,
					effectiveLine,
				}),
				lootPlan: effectiveLine.lootPlan,
				save,
			}),
		).toMatchObject([
			{
				enabled: false,
				itemId: "item:plank",
				kind: "chance",
				probability: 0,
			},
			{
				enabled: false,
				itemId: "item:twig",
				kind: "guaranteed",
				probability: 0,
			},
		]);
	});
	it("hides zero-probability effect carrier rows when runtime chance items replace them", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
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
			},
			requirements: [],
			visible: true,
		};

		expect(
			readRuntimeLineOutputViews({
				effectBonusSummary: readEffectiveLineBonusSummary({
					baseDurationMs: 1000,
					effectiveLine,
				}),
				lootPlan: effectiveLine.lootPlan,
				save,
			}),
		).toMatchObject([
			{
				itemId: "item:log",
				kind: "chance",
				probability: 1.15,
			},
		]);
	});

	it("exposes weighted entry runtime odds in line output views", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
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
								weight: 9,
							},
						],
						rolls: 1,
						type: "weighted",
						visible: true,
					},
				],
				chanceItems: [],
			},
			requirements: [],
			visible: true,
		};

		expect(
			readRuntimeLineOutputViews({
				effectBonusSummary: readEffectiveLineBonusSummary({
					baseDurationMs: 1000,
					effectiveLine,
				}),
				lootPlan: effectiveLine.lootPlan,
				save,
			}),
		).toMatchObject([
			{
				enabled: false,
				itemId: "item:plank",
				kind: "weighted",
				probability: 0,
			},
			{
				enabled: true,
				itemId: "item:twig",
				kind: "weighted",
				probability: 1,
			},
		]);
	});

	it("labels outputs by weighted roll set when multiple sets are visible", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const twigOutput = {
			dropEffects: [],
			enabled: true,
			itemId: "item:twig",
			quantity: 1,
			type: "guaranteed" as const,
			visible: true,
		};
		const plankOutput = {
			dropEffects: [],
			enabled: true,
			itemId: "item:plank",
			quantity: 1,
			type: "guaranteed" as const,
			visible: true,
		};
		const effectiveLine: EffectiveLine = {
			appliedEffects: [],
			blocked: false,
			blockReasons: [],
			durationMs: 1000,
			lootPlan: {
				baseOutput: [
					twigOutput,
					plankOutput,
				],
				visibleOutput: [
					twigOutput,
					plankOutput,
				],
				chanceItems: [],
				outputSets: [
					{
						baseOutput: [
							twigOutput,
						],
						chanceItems: [],
						visibleOutput: [
							twigOutput,
						],
						weight: 3,
					},
					{
						baseOutput: [
							plankOutput,
						],
						chanceItems: [],
						visibleOutput: [
							plankOutput,
						],
						weight: 1,
					},
				],
			},
			requirements: [],
			visible: true,
		};

		expect(
			readRuntimeLineOutputViews({
				effectBonusSummary: readEffectiveLineBonusSummary({
					baseDurationMs: 1000,
					effectiveLine,
				}),
				lootPlan: effectiveLine.lootPlan,
				save,
			}),
		).toMatchObject([
			{
				itemId: "item:plank",
				rollSetLabel: "Set 2 · 25%",
			},
			{
				itemId: "item:twig",
				rollSetLabel: "Set 1 · 75%",
			},
		]);
	});

	it("attaches active bonus lines only to matching output items", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
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
						dropEffects: [],
						enabled: true,
						itemId: "item:twig",
						quantity: 1,
						type: "guaranteed",
						visible: true,
					},
					{
						dropEffects: [],
						enabled: true,
						itemId: "item:plank",
						quantity: 1,
						type: "guaranteed",
						visible: true,
					},
				],
			},
			requirements: [],
			visible: true,
		};

		const outputs = readRuntimeLineOutputViews({
			effectBonusSummary: {
				byItemId: new Map([
					[
						"item:twig",
						[
							"Speed: 10% faster",
						],
					],
				]),
				lines: [
					"Speed: 10% faster",
				],
				universalLines: [],
			},
			lootPlan: effectiveLine.lootPlan,
			save,
		});

		expect(outputs.find((output) => output.itemId === "item:twig")?.bonusLines).toEqual([
			"Speed: 10% faster",
		]);
		expect(
			outputs.find((output) => output.itemId === "item:plank")?.bonusLines,
		).toBeUndefined();
	});
});
