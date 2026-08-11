import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { estimateEditorItemIndexFx } from "~/editor/estimateEditorItemIndexFx";
import { simulateEditorItemFx } from "~/editor/simulator/simulateEditorItemFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { createJobTestConfig } from "~test/job/support/jobTestConfig";
import { createTemporaryLifetimeTestConfig } from "~test/item/temporary/support/createTemporaryLifetimeTestConfig";
import { readArkiniGameConfigSource } from "~test/schema/support/readArkiniGameConfigSource";

describe("estimateEditorItem", () => {
	const estimateEditorItem = (config: GameConfigSchema.Type, itemId: string, quantity = 1) =>
		Effect.runSync(simulateEditorItemFx(config, itemId, quantity));
	const estimateEditorItemIndex = (
		config: GameConfigSchema.Type,
		onProgress?: Parameters<typeof estimateEditorItemIndexFx>[1],
	) => Effect.runSync(estimateEditorItemIndexFx(config, onProgress));
	const createSimulatorConfig = ({
		dropRules = [],
		rules = [],
		startWithTool = false,
		waterRenewal = false,
	}: {
		readonly dropRules?: ReadonlyArray<Record<string, unknown>>;
		readonly rules?: ReadonlyArray<Record<string, unknown>>;
		readonly startWithTool?: boolean;
		readonly waterRenewal?: boolean;
	} = {}) => {
		const base = createJobTestConfig();
		const forge = base.items.forge;
		if (forge.type !== "producer") throw new Error("Expected producer fixture.");
		return GameConfigSchema.parse({
			...base,
			start: {
				...base.start,
				board: [
					{
						itemId: "forge",
						space: 0,
						x: 0,
						y: 0,
					},
					{
						itemId: "water",
						space: 0,
						x: 1,
						y: 0,
					},
				],
				inventory: startWithTool
					? [
							{
								itemId: "tool",
								quantity: 1,
							},
						]
					: [],
			},
			items: {
				...base.items,
				forge: {
					...forge,
					lines: [
						{
							...forge.lines[0],
							input: [
								{
									charges: {
										cost: 1,
										from: "target",
									},
									query: {
										distance: "close",
										scope: "board",
										selector: {
											itemId: "water",
											type: "item",
										},
									},
									type: "deposit",
								},
							],
							output: {
								set: [
									{
										roll: [
											{
												drop: [
													{
														itemId: "ingot",
														quantity: {
															max: 1,
															min: 1,
														},
														rules: dropRules,
													},
												],
												type: "guaranteed",
											},
										],
									},
								],
							},
							rules,
						},
					],
				},
				ingot: {
					...base.items.tool,
					id: "ingot",
					title: "Ingot",
					uid: "ingot",
				},
				water: {
					...base.items.water,
					charges: {
						amount: 2,
						...(waterRenewal
							? {
									output: {
										set: [
											{
												roll: [
													{
														drop: [
															{
																itemId: "water",
																quantity: {
																	max: 1,
																	min: 1,
																},
																rules: [],
															},
														],
														type: "guaranteed",
													},
												],
											},
										],
									},
								}
							: {}),
					},
					type: "deposit",
				},
			},
		});
	};

	it("requires authored enable-rule infrastructure and applies active runtime rules", () => {
		const rules = [
			{
				type: "enable",
				when: [
					{
						query: {
							scope: "universe",
							selector: {
								itemId: "tool",
								type: "item",
							},
						},
						type: "exists",
					},
				],
			},
			{
				multiplier: 0.5,
				type: "runtime:multiplier",
				when: [
					{
						query: {
							scope: "universe",
							selector: {
								itemId: "tool",
								type: "item",
							},
						},
						type: "exists",
					},
				],
			},
		];
		expect(
			estimateEditorItem(
				createSimulatorConfig({
					rules,
				}),
				"ingot",
			).scenarios,
		).toMatchObject([
			{
				status: "no-finite-path",
			},
			{
				status: "no-finite-path",
			},
			{
				status: "no-finite-path",
			},
		]);
		const estimate = estimateEditorItem(
			createSimulatorConfig({
				rules,
				startWithTool: true,
			}),
			"ingot",
		);
		for (const scenario of estimate.scenarios) {
			expect(scenario.status).toBe("estimated");
			expect(scenario.runtimeMs).toBe(500);
			expect(scenario.infrastructureItemIds).toContain("tool");
		}
	});

	it("satisfies conditional drop rules before treating an output as producible", () => {
		const dropRules = [
			{
				type: "enable",
				when: [
					{
						query: {
							scope: "universe",
							selector: {
								itemId: "tool",
								type: "item",
							},
						},
						type: "exists",
					},
				],
			},
		];
		expect(
			estimateEditorItem(
				createSimulatorConfig({
					dropRules,
				}),
				"ingot",
			).scenarios,
		).toMatchObject([
			{
				status: "no-finite-path",
			},
			{
				status: "no-finite-path",
			},
			{
				status: "no-finite-path",
			},
		]);
		const estimate = estimateEditorItem(
			createSimulatorConfig({
				dropRules,
				startWithTool: true,
			}),
			"ingot",
		);
		for (const scenario of estimate.scenarios) {
			expect(scenario.status).toBe("estimated");
			expect(scenario.infrastructureItemIds).toContain("tool");
		}
	});

	it("rejects a line when an authored universe-wide disable rule cannot be falsified", () => {
		const rules = [
			{
				type: "disable",
				when: [
					{
						query: {
							scope: "universe",
							selector: {
								itemId: "tool",
								type: "item",
							},
						},
						type: "exists",
					},
				],
			},
		];
		for (const scenario of estimateEditorItem(
			createSimulatorConfig({
				rules,
			}),
			"ingot",
		).scenarios)
			expect(scenario.status).toBe("estimated");
		expect(
			estimateEditorItem(
				createSimulatorConfig({
					rules,
					startWithTool: true,
				}),
				"ingot",
			).scenarios,
		).toMatchObject([
			{
				status: "no-finite-path",
			},
			{
				status: "no-finite-path",
			},
			{
				status: "no-finite-path",
			},
		]);
	});

	it("exhausts finite deposits and follows authored deterministic renewal output", () => {
		const finite = estimateEditorItem(createSimulatorConfig(), "ingot", 3);
		expect(finite.scenarios).toMatchObject([
			{
				status: "no-finite-path",
			},
			{
				status: "no-finite-path",
			},
			{
				status: "no-finite-path",
			},
		]);
		const renewable = estimateEditorItem(
			createSimulatorConfig({
				waterRenewal: true,
			}),
			"ingot",
			3,
		);
		for (const scenario of renewable.scenarios) {
			expect(scenario.status).toBe("estimated");
			expect(scenario.runtimeMs).toBe(3_000);
			expect(scenario.operations).toContainEqual(
				expect.objectContaining({
					lineId: "line:forge:run",
					runs: 3,
				}),
			);
		}
	});

	it("aggregates every charge paid by the same owner before starting", () => {
		const base = createSimulatorConfig();
		const forge = base.items.forge;
		if (forge.type !== "producer") throw new Error("Expected producer fixture.");
		const config = GameConfigSchema.parse({
			...base,
			items: {
				...base.items,
				forge: {
					...forge,
					charges: {
						amount: 10,
					},
					lines: forge.lines.map((line) => ({
						...line,
						input: [
							{
								charges: {
									cost: 6,
									from: "self",
								},
								type: "simple",
							},
							{
								charges: {
									cost: 6,
									from: "self",
								},
								type: "simple",
							},
						],
					})),
				},
			},
		});

		for (const scenario of estimateEditorItem(config, "ingot").scenarios)
			expect(scenario.status).toBe("no-finite-path");
	});

	it("re-establishes live rules after the start spends their last deposit", () => {
		const enableWhileWaterExists = [
			{
				type: "enable",
				when: [
					{
						query: {
							distance: "close",
							scope: "board",
							selector: {
								itemId: "water",
								type: "item",
							},
						},
						type: "exists",
					},
				],
			},
		];
		const withoutRenewal = createSimulatorConfig({
			rules: enableWhileWaterExists,
		});
		const finiteWater = withoutRenewal.items.water;
		const finite = GameConfigSchema.parse({
			...withoutRenewal,
			items: {
				...withoutRenewal.items,
				water: {
					...finiteWater,
					charges: {
						amount: 1,
					},
				},
			},
		});
		for (const scenario of estimateEditorItem(finite, "ingot").scenarios)
			expect(scenario.status).toBe("no-finite-path");

		const renewable = createSimulatorConfig({
			rules: enableWhileWaterExists,
			waterRenewal: true,
		});
		const renewableWater = renewable.items.water;
		const oneChargeRenewable = GameConfigSchema.parse({
			...renewable,
			items: {
				...renewable.items,
				water: {
					...renewableWater,
					charges: {
						...renewableWater.charges,
						amount: 1,
					},
				},
			},
		});
		for (const scenario of estimateEditorItem(oneChargeRenewable, "ingot").scenarios)
			expect(scenario.status).toBe("estimated");
	});

	it("rejects outputs that cannot fit their authored storage scope", () => {
		const base = createSimulatorConfig();
		const forge = base.items.forge;
		const ingot = base.items.ingot;
		if (forge.type !== "producer") throw new Error("Expected producer fixture.");
		const config = GameConfigSchema.parse({
			...base,
			meta: {
				...base.meta,
				board: {
					height: 1,
					width: 1,
				},
			},
			start: {
				...base.start,
				board: [
					{
						itemId: "forge",
						space: 0,
						x: 0,
						y: 0,
					},
				],
			},
			items: {
				...base.items,
				forge: {
					...forge,
					lines: forge.lines.map((line) => ({
						...line,
						input: [
							{
								type: "simple",
							},
						],
					})),
				},
				ingot: {
					...ingot,
					scope: "board",
				},
			},
		});

		for (const scenario of estimateEditorItem(config, "ingot").scenarios)
			expect(scenario.status).toBe("no-finite-path");
	});

	it("uses merge, charge-depletion, and temporary-expiry acquisition paths", async () => {
		const official = await readArkiniGameConfigSource();
		for (const itemId of [
			"item:double-tree",
			"item:micro-forest",
			"item:seed",
		])
			for (const scenario of estimateEditorItem(official, itemId).scenarios)
				expect(scenario.status).toBe("estimated");

		const temporaryBase = createTemporaryLifetimeTestConfig();
		const temporary = GameConfigSchema.parse({
			...temporaryBase,
			start: {
				...temporaryBase.start,
				board: [
					{
						itemId: "temporaryOutput",
						space: 0,
						x: 0,
						y: 0,
					},
				],
			},
		});
		for (const scenario of estimateEditorItem(temporary, "result").scenarios) {
			expect(scenario.status).toBe("estimated");
			expect(scenario.runtimeMs).toBe(600);
		}
	});

	it("indexes every item and reports incremental progress", () => {
		const config = createJobTestConfig();
		const progress: Array<{
			readonly completed: number;
			readonly itemId: string;
			readonly total: number;
		}> = [];

		const entries = estimateEditorItemIndex(config, (update) => {
			progress.push(update);
		});

		expect(entries.map(({ itemId }) => itemId)).toEqual(
			Object.keys(config.items).sort((left, right) => left.localeCompare(right)),
		);
		expect(progress).toHaveLength(entries.length);
		expect(progress.at(-1)).toEqual({
			completed: entries.length,
			itemId: entries.at(-1)?.itemId,
			total: entries.length,
		});
		expect(entries.find(({ itemId }) => itemId === "water")).toEqual({
			bestRuntimeMs: undefined,
			expectedRuntimeMs: undefined,
			guaranteedRuntimeMs: undefined,
			itemId: "water",
		});
	});

	it("expands the official Bakery construction through its complete line dependencies", async () => {
		const config = await readArkiniGameConfigSource();
		const estimate = estimateEditorItem(config, "producer:bakery-t1");

		expect(estimate.quantity).toBe(1);
		for (const scenario of estimate.scenarios) {
			expect(scenario.status).toBe("estimated");
			expect(scenario.runtimeMs).toBeGreaterThan(24_000);
			expect(scenario.operations).toContainEqual(
				expect.objectContaining({
					lineId: "line:blueprint:bakery-t1:construct",
					runs: 1,
					runtimeMs: 24_000,
				}),
			);
			expect(
				scenario.cost.find(({ itemId }) => itemId === "item:flour")?.quantity,
			).toBeGreaterThanOrEqual(1);
			expect(scenario.totalCostQuantity).toBeGreaterThan(1);
			expect(scenario.infrastructureItemIds).toContain("item:blueprint-bakery-t1");
			expect(scenario.infrastructureItemIds).toContain("producer:windmill-t1");
		}
	});

	it("separates optimistic, expected, and non-finite guaranteed chance output", () => {
		const base = createJobTestConfig();
		const forge = base.items.forge;
		if (forge.type !== "producer") throw new Error("Expected producer fixture.");
		const config = GameConfigSchema.parse({
			...base,
			start: {
				...base.start,
				board: [
					{
						itemId: "forge",
						space: 0,
						x: 0,
						y: 0,
					},
				],
				inventory: [
					{
						itemId: "water",
						quantity: 6,
					},
					{
						itemId: "tool",
						quantity: 1,
					},
				],
			},
			items: {
				...base.items,
				forge: {
					...forge,
					lines: forge.lines.map((line) => ({
						...line,
						output: {
							set: [
								{
									roll: [
										{
											type: "chance",
											chance: 0.5,
											drop: [
												{
													itemId: "ingot",
													quantity: {
														min: 1,
														max: 1,
													},
													rules: [],
												},
											],
										},
									],
								},
							],
						},
					})),
				},
				ingot: {
					...base.items.tool,
					uid: "ingot",
					id: "ingot",
					title: "Ingot",
				},
			},
		});

		const estimate = estimateEditorItem(config, "ingot");
		expect(estimate.scenarios).toMatchObject([
			{
				scenario: "best",
				status: "estimated",
				runtimeMs: 1_000,
			},
			{
				scenario: "expected",
				status: "estimated",
				runtimeMs: 2_000,
			},
			{
				scenario: "guaranteed",
				status: "no-finite-path",
			},
		]);
	});
});
