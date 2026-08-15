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
		Effect.runPromise(simulateEditorItemFx(config, itemId, quantity));
	const estimateEditorItemIndex = (
		config: GameConfigSchema.Type,
		onProgress?: NonNullable<Parameters<typeof estimateEditorItemIndexFx>[1]>["onProgress"],
	) =>
		Effect.runSync(
			estimateEditorItemIndexFx(config, {
				onProgress,
			}),
		);
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

	it("keeps an available producer ahead of a faster unavailable production path", async () => {
		const base = createJobTestConfig();
		const forge = base.items.forge;
		if (forge.type !== "producer") throw new Error("Expected producer fixture.");
		const producer = (id: string, runtimeMs: number) => ({
			...forge,
			id,
			uid: id,
			title: id,
			lines: [
				{
					...forge.lines[0],
					id: `line:${id}:run`,
					input: [
						{
							type: "simple",
						},
					],
					output: {
						set: [
							{
								roll: [
									{
										drop: [
											{
												itemId: "result",
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
					runtimeMs,
				},
			],
		});
		const config = GameConfigSchema.parse({
			...base,
			start: {
				...base.start,
				board: [
					{
						itemId: "slow",
						space: 0,
						x: 0,
						y: 0,
					},
				],
			},
			items: {
				fast: producer("fast", 1),
				result: {
					...base.items.tool,
					id: "result",
					title: "Result",
					uid: "result",
				},
				slow: producer("slow", 1_000),
			},
		});

		const estimate = await estimateEditorItem(config, "result");
		expect(estimate.status).toBe("estimated");
		expect(estimate.runtimeMs).toBe(1_000);
		expect(estimate.operations).toEqual([
			expect.objectContaining({
				lineId: "line:slow:run",
			}),
		]);
	});

	it("requires authored enable-rule infrastructure and applies active runtime rules", async () => {
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
		const blockedEstimate = await estimateEditorItem(
			createSimulatorConfig({
				rules,
			}),
			"ingot",
		);
		expect(blockedEstimate.status).toBe("no-finite-path");
		expect(blockedEstimate.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "missing-source",
					itemId: "tool",
				}),
			]),
		);
		const estimate = await estimateEditorItem(
			createSimulatorConfig({
				rules,
				startWithTool: true,
			}),
			"ingot",
		);
		expect(estimate.status).toBe("estimated");
		expect(estimate.runtimeMs).toBe(500);
		expect(estimate.infrastructureItemIds).toContain("tool");
	});

	it("satisfies conditional drop rules before treating an output as producible", async () => {
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
			await estimateEditorItem(
				createSimulatorConfig({
					dropRules,
				}),
				"ingot",
			),
		).toMatchObject({
			status: "no-finite-path",
		});
		const estimate = await estimateEditorItem(
			createSimulatorConfig({
				dropRules,
				startWithTool: true,
			}),
			"ingot",
		);
		expect(estimate.status).toBe("estimated");
		expect(estimate.infrastructureItemIds).toContain("tool");
	});

	it("rejects a line when an authored universe-wide disable rule cannot be falsified", async () => {
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
		expect(
			(
				await estimateEditorItem(
					createSimulatorConfig({
						rules,
					}),
					"ingot",
				)
			).status,
		).toBe("estimated");
		expect(
			await estimateEditorItem(
				createSimulatorConfig({
					rules,
					startWithTool: true,
				}),
				"ingot",
			),
		).toMatchObject({
			planner: {
				reason: "search-exhausted",
				type: "inconclusive",
			},
			status: "inconclusive",
		});
	});

	it("exhausts finite deposits and follows authored deterministic renewal output", async () => {
		const finite = await estimateEditorItem(createSimulatorConfig(), "ingot", 3);
		expect(finite.status).toBe("inconclusive");
		const renewable = await estimateEditorItem(
			createSimulatorConfig({
				waterRenewal: true,
			}),
			"ingot",
			3,
		);
		expect(renewable.status).toBe("estimated");
		expect(renewable.runtimeMs).toBe(3_000);
		expect(renewable.operations).toContainEqual(
			expect.objectContaining({
				lineId: "line:forge:run",
				runs: 3,
			}),
		);
	});

	it("aggregates every charge paid by the same owner before starting", async () => {
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

		expect(await estimateEditorItem(config, "ingot")).toMatchObject({
			planner: {
				reason: "search-exhausted",
				type: "inconclusive",
			},
			status: "inconclusive",
		});
	});

	it("re-establishes live rules after the start spends their last deposit", async () => {
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
		expect((await estimateEditorItem(finite, "ingot")).status).toBe("estimated");

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
		expect((await estimateEditorItem(oneChargeRenewable, "ingot")).status).toBe("estimated");
	});

	it("ignores physical board capacity while preserving board-scope eligibility", async () => {
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

		expect((await estimateEditorItem(config, "ingot")).status).toBe("estimated");
	});

	it("treats spatial rules optimistically and includes additional starting spaces", async () => {
		const spatialRule = [
			{
				type: "enable",
				when: [
					{
						query: {
							distance: "near",
							scope: "board",
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
		const optimistic = createSimulatorConfig({
			rules: spatialRule,
			startWithTool: true,
		});
		const fullBoard = GameConfigSchema.parse({
			...optimistic,
			meta: {
				...optimistic.meta,
				board: {
					height: 1,
					width: 3,
				},
			},
			start: {
				...optimistic.start,
				board: [
					...optimistic.start.board,
					{
						itemId: "tool",
						space: 0,
						x: 2,
						y: 0,
					},
				],
				inventory: [],
			},
		});
		expect((await estimateEditorItem(fullBoard, "ingot")).status).toBe("estimated");

		const universeRule = [
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
		const otherSpace = createSimulatorConfig({
			rules: universeRule,
		});
		const withOtherSpaceTool = GameConfigSchema.parse({
			...otherSpace,
			start: {
				...otherSpace.start,
				board: [
					...otherSpace.start.board,
					{
						itemId: "tool",
						space: 1,
						x: 0,
						y: 0,
					},
				],
			},
		});
		expect((await estimateEditorItem(withOtherSpaceTool, "ingot")).status).toBe("estimated");
	});

	it("uses merge, charge-depletion, and temporary-expiry acquisition paths", async () => {
		const official = await readArkiniGameConfigSource();
		for (const itemId of [
			"item:double-tree",
			"item:micro-forest",
			"item:seed",
		])
			expect((await estimateEditorItem(official, itemId)).status).toBe("estimated");

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
		const estimate = await estimateEditorItem(temporary, "result");
		expect(estimate.status).toBe("estimated");
		expect(estimate.runtimeMs).toBe(600);
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
			itemId: "water",
			method: "structural-heuristic",
			runtimeMs: undefined,
			status: "no-finite-path",
		});
	});

	it("expands the official Bakery construction through its complete line dependencies", async () => {
		const config = await readArkiniGameConfigSource();
		const estimate = await estimateEditorItem(config, "producer:bakery-t1");

		expect(estimate.quantity).toBe(1);
		expect(estimate.status).toBe("estimated");
		expect(estimate.runtimeMs).toBeGreaterThan(24_000);
		expect(estimate.operations).toContainEqual(
			expect.objectContaining({
				lineId: "line:blueprint:bakery-t1:construct",
				runs: 1,
				runtimeMs: 24_000,
			}),
		);
		expect(
			estimate.cost.find(({ itemId }) => itemId === "item:flour")?.quantity,
		).toBeGreaterThanOrEqual(1);
		expect(estimate.totalCostQuantity).toBeGreaterThan(1);
		expect(estimate.infrastructureItemIds).toContain("item:blueprint-bakery-t1");
		expect(estimate.infrastructureItemIds).toContain("producer:windmill-t1");
		expect(estimate.infrastructure).toContainEqual(
			expect.objectContaining({
				itemId: "producer:windmill-t1",
				quantity: 1,
				readyAtMs: expect.any(Number),
			}),
		);
	});

	it("includes the official Chicken Coop construction in the egg estimate", async () => {
		const config = await readArkiniGameConfigSource();
		const estimate = await estimateEditorItem(config, "item:egg");

		expect(estimate.status).toBe("estimated");
		expect(estimate.infrastructure).toContainEqual(
			expect.objectContaining({
				itemId: "item:blueprint-chicken-coop-t1",
				quantity: 1,
				readyAtMs: expect.any(Number),
			}),
		);
		expect(estimate.infrastructure).toContainEqual(
			expect.objectContaining({
				itemId: "producer:chicken-coop-t1",
				quantity: 1,
				readyAtMs: expect.any(Number),
			}),
		);
		expect(estimate.operations).toContainEqual(
			expect.objectContaining({
				lineId: "line:blueprint:chicken-coop-t1:construct",
				runs: 1,
			}),
		);
		expect(estimate.operations).toContainEqual(
			expect.objectContaining({
				lineId: "line:chicken-coop-t1:egg",
			}),
		);
		expect(estimate.operations).not.toContainEqual(
			expect.objectContaining({
				lineId: "line:quest:water-carrier:complete",
			}),
		);
		for (const unrelatedItemId of [
			"item:blueprint-cattle-farm-t1",
			"item:blueprint-cookhouse-t1",
			"item:blueprint-pig-farm-t1",
			"item:blueprint-vegetable-garden-t1",
			"producer:cattle-farm-t1",
			"producer:cookhouse-t1",
			"producer:pig-farm-t1",
			"producer:vegetable-garden-t1",
		]) {
			expect(estimate.infrastructure).not.toContainEqual(
				expect.objectContaining({
					itemId: unrelatedItemId,
				}),
			);
		}
		expect(estimate.planner?.observedActionRuns).toBeLessThan(
			estimate.planner?.sessionDiagnostics.budget.snapshot.engineTransitions ??
				Number.POSITIVE_INFINITY,
		);
	}, 60_000);

	it("projects the official Lumberjack and Tree charge into the log estimate", async () => {
		const config = await readArkiniGameConfigSource();
		const estimate = await estimateEditorItem(config, "item:log");

		expect(estimate).toMatchObject({
			chargeCost: [
				{
					charges: 1,
					itemId: "item:tree",
				},
			],
			cost: [],
			requiredInfrastructure: [
				{
					itemId: "producer:lumberjack-t1",
					quantity: 1,
				},
			],
			runtimeMs: 7_000,
			status: "estimated",
			totalChargeCost: 1,
			totalCostQuantity: 0,
		});
		expect(estimate.operations).toContainEqual(
			expect.objectContaining({
				lineId: "line:lumberjack-t1:log",
				ownerItemId: "producer:lumberjack-t1",
				runs: 1,
				runtimeMs: 7_000,
			}),
		);
	});

	it("uses expected yield for chance output", async () => {
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

		const estimate = await estimateEditorItem(config, "ingot");
		expect(estimate).toMatchObject({
			runtimeMs: 2_000,
			status: "estimated",
		});
	});
});
