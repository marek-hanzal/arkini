import { describe, expect, it } from "vitest";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import { runInitialSave } from "~/v0/game/engine/applyGameActionFx.testSupport";
import { readEffectiveProducerProductLine } from "~/v0/game/effects/readEffectiveProducerProductLine";

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
	productId = "product:test",
	save,
}: {
	config: ReturnType<typeof createEngineTestConfig>;
	productId?: string;
	save: ReturnType<typeof runInitialSave>;
}) => {
	const product = config.products[productId];
	if (!product) throw new Error(`Missing product ${productId}`);
	return readEffectiveProducerProductLine({
		baseDurationMs: product.durationMs,
		config,
		producerItemInstanceId: "item-instance:1",
		product,
		productId,
		save,
	});
};

describe("readEffectiveProducerProductLine", () => {
	it("keeps visible start requirements visible while reporting missing grants", () => {
		const config = createEngineTestConfig({
			effects: {
				"effect:test:townhall": {
					polarity: "neutral",
					grants: [
						{
							id: "grant:test:townhall",
							name: "Townhall",
						},
					],
					name: "Town Hall Grant",
				},
			},
			products: {
				...createEngineTestConfig().products,
				"product:test": {
					...createEngineTestConfig().products["product:test"],
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
		expect(line.startRequirementsReady).toBe(false);
		expect(line.requirements).toEqual([
			{
				display: "always",
				kind: "grant.require",
				label: "Town Hall Grant",
				phase: "start",
				ready: false,
			},
		]);
	});

	it("hides hidden product lines until their visibility grant is present", () => {
		const baseConfig = createEngineTestConfig();
		const grantId = "grant:test:path";
		const effectId = "effect:test:path";
		const config = createEngineTestConfig({
			effects: {
				[effectId]: {
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
			},
			items: {
				...baseConfig.items,
				"item:axe": {
					...baseConfig.items["item:axe"],
					passiveEffectIds: [
						effectId,
					],
				},
			},
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					effects: [
						{
							display: "never",
							kind: "grant.require",
							phase: "visibility",
							selector: allOfGrant(grantId),
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
			effects: {
				[effectId]: {
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
			},
			items: {
				...baseConfig.items,
				"item:axe": {
					...baseConfig.items["item:axe"],
					passiveEffectIds: [
						effectId,
					],
				},
			},
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					output: [
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
			effects: {
				"effect:test:unlock": {
					polarity: "buff",
					grants: [
						{
							id: "grant:test:unlock",
							name: "Unlock grant",
						},
					],
					name: "Unlock Grant",
				},
			},
			products: {
				...createEngineTestConfig().products,
				"product:test": {
					...createEngineTestConfig().products["product:test"],
					output: [
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

	it("evaluates nearby requirements and exact distance bands from the product line", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				...baseConfig.game,
				board: {
					height: 2,
					width: 3,
				},
			},
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					effects: [
						{
							display: "always",
							items: anyOfItem("item:twig"),
							kind: "nearby.require",
							label: "Nearby Twig",
							phase: "start",
							radius: 1,
						},
						{
							bands: [
								{
									maxDistance: 1,
									minDistance: 0,
									multiplier: 2,
								},
								{
									minDistance: 2,
									multiplier: 3,
								},
							],
							display: "whenActive",
							items: anyOfItem("item:axe"),
							kind: "nearby.duration.multiply",
							label: "Nearby Axe Slowdown",
							radius: 2,
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
		expect(line.requirements.map((requirement) => requirement.label)).toEqual([
			"Nearby Twig",
		]);
		expect(
			line.appliedEffects.filter((effect) => effect.kind === "nearby.duration.multiply"),
		).toHaveLength(1);
	});

	it("applies global grant-owned duration and loot rules defined by the line", () => {
		const baseConfig = createEngineTestConfig();
		const grantId = "grant:test:haste";
		const effectId = "effect:test:haste";
		const config = createEngineTestConfig({
			effects: {
				[effectId]: {
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
			},
			items: {
				...baseConfig.items,
				"item:axe": {
					...baseConfig.items["item:axe"],
					passiveEffectIds: [
						effectId,
					],
				},
			},
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					effects: [
						{
							display: "whenActive",
							kind: "grant.duration.multiply",
							label: "Inventory Haste",
							multiplier: 0.5,
							selector: allOfGrant(grantId),
						},
					],
					output: [
						{
							itemId: "item:twig",
							quantity: 2,
							type: "guaranteed",
							effects: [
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
			effects: {
				[effectId]: {
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
			},
			items: {
				...baseConfig.items,
				"item:axe": {
					...baseConfig.items["item:axe"],
					passiveEffectIds: [
						effectId,
					],
				},
			},
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					output: [
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
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					effects: [
						{
							bands: [
								{
									maxDistance: 3,
									minDistance: 0,
									multiplier: 0.5,
								},
							],
							display: "whenActive",
							items: anyOfItem("item:axe"),
							kind: "nearby.duration.multiply",
							label: "Nearby Axe Haste",
							maxSources: 2,
							radius: 3,
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
	});

	it("does not keep bonus chance from a disabled duplicate output drop", () => {
		const baseConfig = createEngineTestConfig();
		const bonusGrantId = "grant:test:bonus";
		const bonusEffectId = "effect:test:bonus";
		const missingGrantId = "grant:test:missing";
		const config = createEngineTestConfig({
			effects: {
				[bonusEffectId]: {
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
				"effect:test:missing": {
					polarity: "neutral",
					grants: [
						{
							id: missingGrantId,
							name: "Missing grant",
						},
					],
					name: "Missing Grant",
				},
			},
			items: {
				...baseConfig.items,
				"item:axe": {
					...baseConfig.items["item:axe"],
					passiveEffectIds: [
						bonusEffectId,
					],
				},
			},
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					output: [
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
			effects: {
				[effectId]: {
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
			},
			items: {
				...baseConfig.items,
				"item:axe": {
					...baseConfig.items["item:axe"],
					passiveEffectIds: [
						effectId,
					],
				},
			},
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					output: [
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
				enabled: false,
				itemId: "item:twig",
			},
		]);
	});
});
