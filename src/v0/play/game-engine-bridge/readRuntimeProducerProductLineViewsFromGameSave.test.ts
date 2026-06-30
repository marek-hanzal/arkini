import { describe, expect, it } from "vitest";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import { findBoardItem, runInitialSave } from "~/v0/game/engine/applyGameActionFx.testSupport";
import { readRuntimeProducerProductLineViewsFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeProducerProductLineViewsFromGameSave";

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

const readTestLine = ({
	config,
	nowMs = 0,
	save,
}: {
	config: ReturnType<typeof createEngineTestConfig>;
	nowMs?: number;
	save: ReturnType<typeof runInitialSave>;
}) => {
	const producerItem = findBoardItem(save, {
		itemId: "item:producer",
		x: 0,
		y: 0,
	});
	if (!producerItem) throw new Error("Missing test producer.");

	const [line] = readRuntimeProducerProductLineViewsFromGameSave({
		config,
		maxQueueSize: 1,
		nowMs,
		producerId: "item:producer",
		producerItemId: "item:producer",
		productIds: [
			"product:test",
		],
		save,
		targetItemInstanceId: producerItem.id,
	});
	if (!line) throw new Error("Missing test product line view.");
	return line;
};

describe("readRuntimeProducerProductLineViewsFromGameSave", () => {
	it("keeps hidden missing start requirements blocking even when they are not rendered", () => {
		const config = createEngineTestConfig({
			effects: {
				"effect:test:missing": {
					grantIds: [
						"grant:test:missing",
					],
					name: "Missing Grant",
				},
			},
			products: {
				...createEngineTestConfig().products,
				"product:test": {
					...createEngineTestConfig().products["product:test"],
					effects: [
						{
							display: "never",
							kind: "grant.require",
							label: "Hidden Missing Grant",
							phase: "start",
							selector: allOfGrant("grant:test:missing"),
						},
					],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const line = readTestLine({
			config,
			save,
		});

		expect(line.effectRequirements).toBeUndefined();
		expect(line.effectRequirementsReady).toBe(false);
	});

	it("reports active line modifiers as bonuses instead of fake missing requirements", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:test:haste": {
					grantIds: [
						"grant:test:haste",
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
						"effect:test:haste",
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
							selector: allOfGrant("grant:test:haste"),
						},
						{
							chance: 0.25,
							display: "whenActive",
							kind: "grant.loot.extraOutputChance.add",
							label: "Extra Twig",
							outputItems: {
								items: anyOfItem("item:twig"),
							},
							quantity: 1,
							selector: allOfGrant("grant:test:haste"),
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

		const line = readTestLine({
			config,
			save,
		});

		expect(line.effectRequirements).toBeUndefined();
		expect(line.effectRequirementsReady).toBeUndefined();
		expect(line.effectBonusLines).toEqual([
			"Inventory Haste: 50% faster production.",
			"Extra Twig: 25% chance for +1× Twig.",
		]);
	});
});
