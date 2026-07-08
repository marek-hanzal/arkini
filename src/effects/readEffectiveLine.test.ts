import { describe, expect, it } from "vitest";
import { createEngineTestConfig } from "~/engine/test/createEngineTestConfig";
import { runInitialSave } from "~/engine/applyGameActionFx.testSupport";
import { readEffectiveLine } from "~/effects/readEffectiveLine";

const allOfGrant = (grantId: string) => ({
	allOf: [
		{
			ids: [
				grantId,
			],
		},
	],
});

const anyOfItem = (itemId: string) => ({
	anyOf: [
		{
			ids: [
				itemId,
			],
		},
	],
});

const readLine = ({
	config,
	lineId = "line:test",
	save,
}: {
	config: ReturnType<typeof createEngineTestConfig>;
	lineId?: string;
	save: ReturnType<typeof runInitialSave>;
}) => {
	const line = config.lineCatalog[lineId];
	if (!line) throw new Error(`Missing line ${lineId}`);
	return readEffectiveLine({
		baseDurationMs: line.durationMs,
		config,
		itemInstanceId: "item-instance:1",
		line,
		lineId,
		save,
	});
};

describe("readEffectiveLine", () => {
	it("keeps visible start requirements visible while reporting missing grants", () => {
		const config = createEngineTestConfig({
			itemEffects: {
				"item:empty-stash": [
					{
						id: "effect:test:townhall",
						polarity: "neutral",
						grants: [
							{
								id: "grant:test:townhall",
								name: "Townhall",
							},
						],
						name: "Town Hall Grant",
					},
				],
			},
			lineOverrides: {
				"line:test": {
					...createEngineTestConfig().lineCatalog["line:test"],
					output: [
						{
							entries: [
								{
									itemId: "item:twig",
									quantity: 2,
									type: "guaranteed",
									effects: [
										{
											display: "always",
											kind: "grant.require",
											label: "Town Hall Grant",
											phase: "start",
											selector: allOfGrant("grant:test:townhall"),
										},
									],
								},
							],
						},
					],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const line = readLine({
			config,
			save,
		});

		expect(line.visible).toBe(true);
		expect(line.startRequirementsReady).toBe(true);
		expect(line.requirements).toEqual([]);
		expect(line.lootPlan.baseOutput).toEqual([]);
		expect(line.lootPlan.visibleOutput).toMatchObject([
			{
				dropEffects: [
					{
						label: "Town Hall Grant",
						ready: false,
						result: "disabled",
					},
				],
				enabled: false,
				itemId: "item:twig",
			},
		]);
	});

	it("hides hidden lines until their visibility grant is present", () => {
		const baseConfig = createEngineTestConfig();
		const grantId = "grant:test:path";
		const effectId = "effect:test:path";
		const config = createEngineTestConfig({
			itemEffects: {
				"item:axe": [
					{
						id: effectId,
						polarity: "buff",
						grants: [
							{
								id: grantId,
								name: "Test grant",
							},
						],
						name: "Path Grant",
						sourceScope: "board",
					},
				],
			},
			lineOverrides: {
				"line:test": {
					...baseConfig.lineCatalog["line:test"],
					output: [
						{
							entries: [
								{
									itemId: "item:twig",
									quantity: 2,
									type: "guaranteed",
									effects: [
										{
											display: "never",
											kind: "grant.require",
											phase: "visibility",
											selector: allOfGrant(grantId),
										},
									],
								},
							],
						},
					],
					visibility: "hidden",
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		expect(
			readLine({
				config,
				save,
			}).visible,
		).toBe(false);

		const saveWithGrant = {
			...save,
			board: {
				...save.board,
				items: {
					...save.board.items,
					"item-instance:path": {
						createdAtMs: 0,
						id: "item-instance:path",
						itemId: "item:axe",
						x: 1,
						y: 0,
					},
				},
			},
		};

		expect(
			readLine({
				config,
				save: saveWithGrant,
			}).visible,
		).toBe(true);
	});

	it("evaluates drop-owned visibility effects without hiding sibling drops", () => {
		const baseConfig = createEngineTestConfig();
		const grantId = "grant:test:path";
		const effectId = "effect:test:path";
		const config = createEngineTestConfig({
			itemEffects: {
				"item:axe": [
					{
						id: effectId,
						polarity: "buff",
						grants: [
							{
								id: grantId,
								name: "Path grant",
							},
						],
						name: "Path Grant",
						sourceScope: "board",
					},
				],
			},
			lineOverrides: {
				"line:test": {
					...baseConfig.lineCatalog["line:test"],
					output: [
						{
							entries: [
								{
									itemId: "item:twig",
									quantity: 2,
									type: "guaranteed",
									effects: [
										{
											display: "always",
											kind: "grant.require",
											label: "Choose Twig Path",
											phase: "visibility",
											selector: allOfGrant(grantId),
										},
									],
								},
								{
									itemId: "item:plank",
									quantity: 1,
									type: "guaranteed",
								},
							],
						},
					],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const lineWithoutGrant = readLine({
			config,
			save,
		});
		expect(lineWithoutGrant.visible).toBe(true);
		expect(
			lineWithoutGrant.lootPlan.visibleOutput.map((entry) =>
				entry.type === "weighted" ? "weighted" : entry.itemId,
			),
		).toEqual([
			"item:plank",
		]);
		expect(
			lineWithoutGrant.lootPlan.baseOutput.map((entry) =>
				entry.type === "weighted" ? "weighted" : entry.itemId,
			),
		).toEqual([
			"item:plank",
		]);

		const lineWithGrant = readLine({
			config,
			save: {
				...save,
				board: {
					...save.board,
					items: {
						...save.board.items,
						"item-instance:path": {
							createdAtMs: 0,
							id: "item-instance:path",
							itemId: "item:axe",
							x: 1,
							y: 0,
						},
					},
				},
			},
		});
		expect(
			lineWithGrant.lootPlan.visibleOutput.map((entry) =>
				entry.type === "weighted" ? "weighted" : entry.itemId,
			),
		).toEqual([
			"item:twig",
			"item:plank",
		]);
	});

	it("keeps disabled drop-owned start requirements visible but out of rollable output", () => {
		const config = createEngineTestConfig({
			itemEffects: {
				"item:empty-stash": [
					{
						id: "effect:test:unlock",
						polarity: "buff",
						grants: [
							{
								id: "grant:test:unlock",
								name: "Unlock grant",
							},
						],
						name: "Unlock Grant",
					},
				],
			},
			lineOverrides: {
				"line:test": {
					...createEngineTestConfig().lineCatalog["line:test"],
					output: [
						{
							entries: [
								{
									itemId: "item:twig",
									quantity: 2,
									type: "guaranteed",
									effects: [
										{
											display: "always",
											kind: "grant.require",
											label: "Unlock Twig Drop",
											phase: "start",
											selector: allOfGrant("grant:test:unlock"),
										},
									],
								},
							],
						},
					],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const line = readLine({
			config,
			save,
		});

		expect(line.visible).toBe(true);
		expect(line.lootPlan.baseOutput).toEqual([]);
		expect(line.lootPlan.visibleOutput).toMatchObject([
			{
				enabled: false,
				itemId: "item:twig",
				dropEffects: [
					{
						impact: "availability",
						label: "Unlock Twig Drop",
						ready: false,
						result: "disabled",
					},
				],
			},
		]);
	});

	it("evaluates nearby requirements and simplified nearby distance buckets from the line", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				...baseConfig.game,
				board: {
					height: 2,
					width: 3,
				},
			},
			lineOverrides: {
				"line:test": {
					...baseConfig.lineCatalog["line:test"],
					output: [
						{
							entries: [
								{
									itemId: "item:twig",
									quantity: 2,
									type: "guaranteed",
									effects: [
										{
											display: "always",
											items: anyOfItem("item:twig"),
											kind: "nearby.require",
											label: "Nearby Twig",
											phase: "start",
											distance: "neighbour",
										},
										{
											bands: [
												{
													distance: "neighbour",
													multiplier: 2,
												},
												{
													distance: "near",
													multiplier: 3,
												},
												],
											display: "whenActive",
											items: anyOfItem("item:axe"),
											kind: "nearby.duration.multiply",
											label: "Nearby Axe Slowdown",
										},
									],
								},
							],
						},
					],
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:producer",
						x: 0,
						y: 0,
					},
					{
						itemId: "item:twig",
						x: 1,
						y: 0,
					},
					{
						itemId: "item:axe",
						x: 2,
						y: 0,
					},
				],
				inventory: [],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const line = readLine({
			config,
			save,
		});

		expect(line.startRequirementsReady).toBe(true);
		expect(line.durationMs).toBe(3000);
		expect(line.requirements).toEqual([]);
		expect(line.lootPlan.visibleOutput[0]?.dropEffects?.map((effect) => effect.label)).toEqual([
			"Nearby Twig",
		]);
		const durationEffects = line.appliedEffects.filter(
			(effect) => effect.kind === "nearby.duration.multiply",
		);

		expect(durationEffects).toHaveLength(1);
		expect(durationEffects[0]?.effectName).toBe("Nearby Axe enables production");
	});

	it("applies global grant-owned duration and loot rules defined by the line", () => {
		const baseConfig = createEngineTestConfig();
		const grantId = "grant:test:haste";
		const effectId = "effect:test:haste";
		const config = createEngineTestConfig({
			itemEffects: {
				"item:axe": [
					{
						id: effectId,
						polarity: "buff",
						grants: [
							{
								id: grantId,
								name: "Test grant",
							},
						],
						name: "Haste Grant",
						sourceScope: "inventory",
					},
				],
			},
			lineOverrides: {
				"line:test": {
					...baseConfig.lineCatalog["line:test"],
					output: [
						{
							entries: [
								{
									itemId: "item:twig",
									quantity: 2,
									type: "guaranteed",
									effects: [
										{
											display: "whenActive",
											kind: "grant.duration.multiply",
											label: "Inventory Haste",
											multiplier: 0.5,
											selector: allOfGrant(grantId),
										},
										{
											chance: 0.25,
											display: "whenActive",
											kind: "grant.loot.extraOutputChance.add",
											label: "Extra Twig",
											quantity: 1,
											selector: allOfGrant(grantId),
										},
									],
								},
							],
						},
					],
				},
			},
			startingState: {
				...baseConfig.startingState,
				inventory: [
					{
						itemId: "item:axe",
						quantity: 1,
					},
				],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const line = readLine({
			config,
			save,
		});

		expect(line.durationMs).toBe(500);
		expect(line.lootPlan.chanceItems).toMatchObject([
			{
				chance: 0.25,
				effectName: "Extra Twig",
				itemId: "item:twig",
				quantity: 1,
			},
		]);
		expect(line.requirements).toEqual([]);
	});

	it("keeps bonus chance display rules on generated chance drops", () => {
		const baseConfig = createEngineTestConfig();
		const grantId = "grant:test:bonus";
		const effectId = "effect:test:bonus";
		const config = createEngineTestConfig({
			itemEffects: {
				"item:axe": [
					{
						id: effectId,
						grants: [
							{
								id: grantId,
								name: "Bonus grant",
							},
						],
						name: "Bonus Grant",
						polarity: "buff",
						sourceScope: "inventory",
					},
				],
			},
			lineOverrides: {
				"line:test": {
					...baseConfig.lineCatalog["line:test"],
					output: [
						{
							entries: [
								{
									effects: [
										{
											chance: 0.25,
											display: "never",
											kind: "grant.loot.extraOutputChance.add",
											label: "Hidden Bonus Label",
											quantity: 1,
											selector: allOfGrant(grantId),
										},
									],
									itemId: "item:twig",
									quantity: 1,
									type: "guaranteed",
								},
							],
						},
					],
				},
			},
			startingState: {
				...baseConfig.startingState,
				inventory: [
					{
						itemId: "item:axe",
						quantity: 1,
					},
				],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const line = readLine({
			config,
			save,
		});

		expect(line.lootPlan.chanceItems).toMatchObject([
			{
				chance: 0.25,
				itemId: "item:twig",
			},
		]);
		expect(line.lootPlan.chanceItems[0]?.dropEffects).toBeUndefined();
	});

	it("counts every active nearby duration source without pretending bonuses are requirements", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				...baseConfig.game,
				board: {
					height: 2,
					width: 4,
				},
			},
			lineOverrides: {
				"line:test": {
					...baseConfig.lineCatalog["line:test"],
					output: [
						{
							entries: [
								{
									itemId: "item:twig",
									quantity: 2,
									type: "guaranteed",
									effects: [
										{
											bands: [
												{
													distance: "neighbour",
													multiplier: 0.5,
												},
												{
													distance: "near",
													multiplier: 0.5,
												},
												{
													distance: "any",
													multiplier: 0.5,
												},
												],
											display: "whenActive",
											items: anyOfItem("item:axe"),
											kind: "nearby.duration.multiply",
											label: "Nearby Axe Haste",
											maxSources: 2,
										},
									],
								},
							],
						},
					],
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:producer",
						x: 0,
						y: 0,
					},
					{
						itemId: "item:axe",
						x: 1,
						y: 0,
					},
					{
						itemId: "item:axe",
						x: 1,
						y: 1,
					},
					{
						itemId: "item:axe",
						x: 3,
						y: 1,
					},
				],
				inventory: [],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const line = readLine({
			config,
			save,
		});
		const durationEffects = line.appliedEffects.filter(
			(effect) => effect.kind === "nearby.duration.multiply",
		);

		expect(line.durationMs).toBe(250);
		expect(line.requirements).toEqual([]);
		expect(durationEffects).toHaveLength(2);
		expect(new Set(durationEffects.map((effect) => effect.sourceItemInstanceId)).size).toBe(2);
		expect(durationEffects.map((effect) => effect.sourceId)).toEqual([
			"item:axe",
			"item:axe",
		]);
		expect(durationEffects.map((effect) => effect.effectName)).toEqual([
			"Nearby Axe enables production",
			"Nearby Axe enables production",
		]);
	});

	it("does not keep bonus chance from a disabled duplicate output drop", () => {
		const baseConfig = createEngineTestConfig();
		const bonusGrantId = "grant:test:bonus";
		const bonusEffectId = "effect:test:bonus";
		const missingGrantId = "grant:test:missing";
		const config = createEngineTestConfig({
			itemEffects: {
				"item:axe": [
					{
						id: bonusEffectId,
						polarity: "buff",
						grants: [
							{
								id: bonusGrantId,
								name: "Bonus grant",
							},
						],
						name: "Bonus Grant",
						sourceScope: "inventory",
					},
				],
				"item:empty-stash": [
					{
						id: "effect:test:missing",
						polarity: "neutral",
						grants: [
							{
								id: missingGrantId,
								name: "Missing grant",
							},
						],
						name: "Missing Grant",
					},
				],
			},
			lineOverrides: {
				"line:test": {
					...baseConfig.lineCatalog["line:test"],
					output: [
						{
							entries: [
								{
									itemId: "item:twig",
									quantity: 1,
									type: "guaranteed",
									effects: [
										{
											chance: 0.5,
											display: "whenActive",
											kind: "grant.loot.extraOutputChance.add",
											label: "Disabled source bonus",
											quantity: 1,
											selector: allOfGrant(bonusGrantId),
										},
										{
											display: "always",
											kind: "grant.require",
											label: "Missing unlock",
											phase: "start",
											selector: allOfGrant(missingGrantId),
										},
									],
								},
								{
									itemId: "item:twig",
									quantity: 1,
									type: "guaranteed",
								},
							],
						},
					],
				},
			},
			startingState: {
				...baseConfig.startingState,
				inventory: [
					{
						itemId: "item:axe",
						quantity: 1,
					},
				],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const line = readLine({
			config,
			save,
		});

		expect(line.lootPlan.visibleOutput).toHaveLength(2);
		expect(line.lootPlan.baseOutput).toHaveLength(1);
		expect(line.lootPlan.chanceItems).toEqual([]);
	});

	it("does not let ready drop requirements re-enable an earlier disabled drop", () => {
		const baseConfig = createEngineTestConfig();
		const grantId = "grant:test:disable";
		const effectId = "effect:test:disable";
		const config = createEngineTestConfig({
			itemEffects: {
				"item:axe": [
					{
						id: effectId,
						polarity: "debuff",
						grants: [
							{
								id: grantId,
								name: "Disable grant",
							},
						],
						name: "Disable Grant",
						sourceScope: "inventory",
					},
				],
			},
			lineOverrides: {
				"line:test": {
					...baseConfig.lineCatalog["line:test"],
					output: [
						{
							entries: [
								{
									itemId: "item:twig",
									quantity: 1,
									type: "guaranteed",
									effects: [
										{
											display: "always",
											kind: "grant.drop.disable",
											label: "Disable Twig",
											selector: allOfGrant(grantId),
										},
										{
											display: "always",
											kind: "grant.require",
											label: "Ready Requirement",
											phase: "start",
											selector: allOfGrant(grantId),
										},
									],
								},
							],
						},
					],
				},
			},
			startingState: {
				...baseConfig.startingState,
				inventory: [
					{
						itemId: "item:axe",
						quantity: 1,
					},
				],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const line = readLine({
			config,
			save,
		});

		expect(line.lootPlan.baseOutput).toEqual([]);
		expect(line.lootPlan.visibleOutput).toMatchObject([
			{
				dropEffects: [
					{
						label: "Disable Twig",
						result: "disabled",
					},
					{
						label: "Ready Requirement",
						result: "requirement met",
					},
				],
				enabled: false,
				itemId: "item:twig",
			},
		]);
	});

	it("adds nearby loot source chances into one uncapped chance item", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				...baseConfig.game,
				board: {
					height: 2,
					width: 4,
				},
			},
			lineOverrides: {
				"line:test": {
					...baseConfig.lineCatalog["line:test"],
					output: [
						{
							entries: [
								{
									chance: 0,
									quantity: 1,
									effects: [
										{
											display: "always",
											kind: "nearby.loot.outputChance.add",
											label: "Nearby wood sources",
											quantity: 1,
											distance: "near",
											sources: [
												{
													chance: 0.5,
													items: anyOfItem("item:twig"),
													label: "Single tree",
												},
												{
													chance: 0.65,
													items: anyOfItem("item:plank"),
													label: "Double tree",
												},
											],
										},
									],
									itemId: "item:twig",
									type: "chance",
								},
							],
						},
					],
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:producer",
						x: 0,
						y: 0,
					},
					{
						itemId: "item:twig",
						x: 1,
						y: 0,
					},
					{
						itemId: "item:plank",
						x: 2,
						y: 0,
					},
				],
				inventory: [],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const line = readLine({
			config,
			save,
		});

		expect(line.lootPlan.chanceItems).toMatchObject([
			{
				chance: 1.15,
				itemId: "item:twig",
				dropEffects: [
					{
						label: "Single tree",
						result: "+50% (1× 50%)",
					},
					{
						label: "Double tree",
						result: "+65% (1× 65%)",
					},
				],
			},
		]);
		expect(line.lootPlan.visibleOutput).toMatchObject([
			{
				dropEffects: [
					{
						label: "Nearby wood sources",
						result: "+115% total",
					},
				],
				itemId: "item:twig",
			},
		]);
	});
});
