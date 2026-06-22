import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { buildGameConfigServiceFx } from "~/v0/game/config/buildGameConfigServiceFx";
import { createInitialGameSaveFx } from "~/v0/game/save/createInitialGameSaveFx";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";

const runConfigService = (props: buildGameConfigServiceFx.Props) =>
	Effect.runSync(buildGameConfigServiceFx(props));
const runInitialSave = (props: createInitialGameSaveFx.Props) =>
	Effect.runSync(createInitialGameSaveFx(props));

const completeUpgradeTier = ({
	save,
	upgradeId,
}: {
	save: GameSave;
	upgradeId: string;
}): GameSave => ({
	...save,
	upgrades: {
		...save.upgrades,
		[upgradeId]: {
			completedTiers: 1,
		},
	},
});

describe("buildGameConfigServiceFx", () => {
	it("keeps the base config unchanged while exposing completed upgrade effects in the effective config", () => {
		const config = createEngineTestConfig({
			upgrades: {
				"upgrade:test-speed": {
					code: "test-speed",
					description: "Test speed upgrade",
					name: "Test Speed",
					tiers: [
						{
							cost: [],
							durationMs: 0,
							effects: [
								{
									ms: -500,
									productId: "product:test",
									type: "product.duration.add",
								},
							],
						},
					],
				},
			},
		});
		const save = completeUpgradeTier({
			save: runInitialSave({
				config,
				nowMs: 0,
			}),
			upgradeId: "upgrade:test-speed",
		});

		const service = runConfigService({
			config,
			save,
		});
		const serviceAgain = runConfigService({
			config,
			save,
		});

		expect(service.baseConfig).toBe(config);
		expect(service.config).not.toBe(config);
		expect(config.products["product:test"].durationMs).toBe(1000);
		expect(service.baseConfig.products["product:test"].durationMs).toBe(1000);
		expect(service.config.products["product:test"].durationMs).toBe(500);
		expect(serviceAgain.config.products["product:test"].durationMs).toBe(500);
	});

	it("applies product input quantity upgrades to the effective inputRef selected by an earlier completed effect", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			inputs: {
				...baseConfig.inputs,
				"input:plank": {
					name: "Plank input",
					inputs: [
						{
							capacity: 3,
							consume: true,
							itemId: "item:plank",
							quantity: 1,
						},
					],
				},
			},
			upgrades: {
				"upgrade:plank-input": {
					code: "plank-input",
					description: "Switch product input to plank",
					name: "Plank Input",
					tiers: [
						{
							cost: [],
							durationMs: 0,
							effects: [
								{
									inputRefId: "input:plank",
									productId: "product:test",
									type: "product.inputRef.set",
								},
								{
									itemId: "item:plank",
									productId: "product:test",
									quantity: 1,
									type: "product.input.quantity.add",
								},
							],
						},
					],
				},
			},
		});
		const save = completeUpgradeTier({
			save: runInitialSave({
				config,
				nowMs: 0,
			}),
			upgradeId: "upgrade:plank-input",
		});

		const service = runConfigService({
			config,
			save,
		});

		expect(config.products["product:test"].inputRefId).toBeUndefined();
		expect(config.inputs["input:plank"].inputs[0]).toMatchObject({
			itemId: "item:plank",
			quantity: 1,
		});
		expect(service.config.products["product:test"].inputRefId).toBe("input:plank");
		expect(service.config.inputs["input:plank"].inputs[0]).toMatchObject({
			itemId: "item:plank",
			quantity: 2,
		});
		expect(service.config.inputs["input:shred"].inputs[0]).toMatchObject({
			itemId: "item:twig",
			quantity: 1,
		});
	});

	it("replaces producer and product requirement ids through completed upgrades", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			requirements: {
				...baseConfig.requirements,
				"requirement:near-twig-1": {
					distance: 1,
					itemIds: [
						"item:twig",
					],
					type: "proximity",
				},
				"requirement:near-twig-2": {
					distance: 2,
					itemIds: [
						"item:twig",
					],
					type: "proximity",
				},
			},
			producers: {
				...baseConfig.producers,
				"producer:test": {
					...baseConfig.producers["producer:test"],
					requirementIds: [
						"requirement:near-twig-1",
					],
				},
			},
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					requirementIds: [
						"requirement:near-twig-1",
					],
				},
			},
			upgrades: {
				"upgrade:requirements": {
					code: "requirements",
					description: "Replace requirements",
					name: "Requirements",
					tiers: [
						{
							cost: [],
							durationMs: 0,
							effects: [
								{
									producerId: "producer:test",
									requirementIds: [
										"requirement:near-twig-2",
									],
									type: "producer.requirementIds.set",
								},
								{
									productId: "product:test",
									requirementIds: [],
									type: "product.requirementIds.set",
								},
							],
						},
					],
				},
			},
		});
		const save = completeUpgradeTier({
			save: runInitialSave({
				config,
				nowMs: 0,
			}),
			upgradeId: "upgrade:requirements",
		});

		const service = runConfigService({
			config,
			save,
		});

		expect(config.producers["producer:test"].requirementIds).toEqual([
			"requirement:near-twig-1",
		]);
		expect(config.products["product:test"].requirementIds).toEqual([
			"requirement:near-twig-1",
		]);
		expect(service.config.producers["producer:test"].requirementIds).toEqual([
			"requirement:near-twig-2",
		]);
		expect(service.config.products["product:test"].requirementIds).toEqual([]);
	});

	it("keeps same-item product input upgrades scoped to the owning effective inputRef", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			inputs: {
				...baseConfig.inputs,
				"input:test-twig": {
					name: "Test twig input",
					inputs: [
						{
							capacity: 3,
							consume: true,
							itemId: "item:twig",
							quantity: 1,
						},
					],
				},
			},
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					inputRefId: "input:test-twig",
				},
			},
			upgrades: {
				"upgrade:test-twig-cost": {
					code: "test-twig-cost",
					description: "Raise test product twig input cost",
					name: "Test Twig Cost",
					tiers: [
						{
							cost: [],
							durationMs: 0,
							effects: [
								{
									itemId: "item:twig",
									productId: "product:test",
									quantity: 1,
									type: "product.input.quantity.add",
								},
							],
						},
					],
				},
			},
		});
		const save = completeUpgradeTier({
			save: runInitialSave({
				config,
				nowMs: 0,
			}),
			upgradeId: "upgrade:test-twig-cost",
		});

		const service = runConfigService({
			config,
			save,
		});

		expect(service.config.inputs["input:test-twig"].inputs[0]).toMatchObject({
			itemId: "item:twig",
			quantity: 2,
		});
		expect(service.config.inputs["input:shred"].inputs[0]).toMatchObject({
			itemId: "item:twig",
			quantity: 1,
		});
		expect(config.inputs["input:test-twig"].inputs[0]).toMatchObject({
			itemId: "item:twig",
			quantity: 1,
		});
	});
});
