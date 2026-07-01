import { describe, expect, it } from "vitest";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import { runInitialSave } from "~/v0/game/engine/applyGameActionFx.testSupport";
import type { EffectiveProducerProductLine } from "~/v0/game/effects/EffectiveProducerProductLine";
import { readRuntimeProductLineOutputViews } from "~/v0/play/game-engine-bridge/readRuntimeProductLineOutputViews";

describe("readRuntimeProductLineOutputViews", () => {
	it("lists every potential output sorted by explicit output sort", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			items: {
				...baseConfig.items,
				"item:pollution": {
					assetId: "asset:test",
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
		const effectiveProductLine: EffectiveProducerProductLine = {
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
						sourceDropId: "product:test:output:bonus",
					},
				],
			},
			requirements: [],
			visible: true,
		};

		expect(
			readRuntimeProductLineOutputViews({
				effectiveProductLine,
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
		const effectiveProductLine: EffectiveProducerProductLine = {
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
								effectId: "product:test:output:0:effect:0",
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
			readRuntimeProductLineOutputViews({
				effectiveProductLine,
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
			effectId: "product:test:output:effect:0",
			effectName: "Missing Permit",
			impact: "availability" as const,
			kind: "grant.require",
			label: "Missing Permit",
			phase: "start" as const,
			ready: false,
			result: "disabled",
		} as const;
		const effectiveProductLine: EffectiveProducerProductLine = {
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
			readRuntimeProductLineOutputViews({
				effectiveProductLine,
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
});
