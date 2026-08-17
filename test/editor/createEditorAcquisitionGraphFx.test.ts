import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createEditorAcquisitionGraphFx } from "~/editor/createEditorAcquisitionGraphFx";
import { estimateEditorItemFx } from "~/editor/estimator/estimateEditorItemFx";
import { compileGameSourcesFx } from "~/engine/compiler/fx/compileGameSourcesFx";
import { resolveLineRunFx } from "~/engine/line/fx/run/resolveLineRunFx";
import { readEditorAcquisitionOutputOccurrencesFx } from "~/editor/readEditorAcquisitionOutputOccurrencesFx";
import { OutputSchema } from "~/engine/output/schema/OutputSchema";
import { readArkiniGameConfigSource } from "~test/schema/support/readArkiniGameConfigSource";
import { createMergeTestConfig } from "~test/merge/support/createMergeTestConfig";
import {
	createLine,
	createOutput,
	createProducerItem,
	createRootSource,
	createSimpleItem,
} from "~test/validation/support/gameValidationTestSource";

describe("createEditorAcquisitionGraphFx", () => {
	it("projects official authored starts, lines, chance outputs, and merges", async () => {
		const config = await readArkiniGameConfigSource();
		const graph = Effect.runSync(createEditorAcquisitionGraphFx(config));

		expect(graph.factIds).toHaveLength(Object.keys(config.items).length);
		expect(graph.roots.length).toBeGreaterThan(0);
		expect(graph.routes.length).toBeGreaterThan(0);
		expect(graph.limitations).toEqual([
			"negative-availability-constraints-ignored",
			"spatial-requirements-approximated",
		]);
		expect(graph.routes).toContainEqual(
			expect.objectContaining({
				metadata: expect.objectContaining({
					kind: "line-output",
					lineId: "line:lumberjack-t1:log",
					ownerItemId: "producer:lumberjack-t1",
				}),
				output: expect.objectContaining({
					factId: "item:log",
				}),
			}),
		);
		expect(graph.routes).toContainEqual(
			expect.objectContaining({
				metadata: expect.objectContaining({
					kind: "merge-output",
					sourceItemId: "item:axe",
					targetItemId: "item:tree",
				}),
				output: expect.objectContaining({
					factId: "item:log",
				}),
			}),
		);

		const roadRepairChance = graph.routes.find(
			(route) =>
				route.metadata.kind === "line-output" &&
				route.metadata.lineId === "line:lumberjack-t1:log" &&
				route.output.factId === "item:quest:road-repair",
		);
		expect(roadRepairChance?.output.quantityDistribution).toEqual([
			{
				probability: 0.9,
				quantity: 0,
			},
			{
				probability: 0.1,
				quantity: 1,
			},
		]);

		const log = Effect.runSync(
			estimateEditorItemFx({
				factId: "item:log",
				graph,
				quantity: 1,
			}),
		);
		expect(log).toMatchObject({
			factId: "item:log",
			obtainable: true,
		});
		const eggs = Effect.runSync(
			estimateEditorItemFx({
				factId: "item:egg",
				graph,
				quantity: 3,
			}),
		);
		expect(eggs).toMatchObject({
			obtainable: true,
		});
		if (!eggs.obtainable) throw new Error("Expected Chicken Coop route.");
		expect(eggs.route.actionRuns).toBeCloseTo(1.7);
		expect(eggs.route.outputRuns).toBeCloseTo(1.7);
	});

	it("accounts for whole charged-item batches above one payer's capacity", async () => {
		const config = await readArkiniGameConfigSource();
		const graph = Effect.runSync(createEditorAcquisitionGraphFx(config));
		const logRoute = graph.routes.find(
			(route) =>
				route.metadata.kind === "line-output" &&
				route.metadata.lineId === "line:lumberjack-t1:log" &&
				route.output.factId === "item:log",
		);
		expect(logRoute?.chargeUses).toContainEqual(
			expect.objectContaining({
				payerFactId: "item:tree",
				usableActionRuns: 18,
			}),
		);

		const estimate = Effect.runSync(
			estimateEditorItemFx({
				factId: "item:log",
				graph,
				quantity: 19,
			}),
		);
		expect(estimate).toMatchObject({
			oneTimeRequirements: expect.arrayContaining([
				{
					factId: "item:tree",
					quantity: 2,
				},
			]),
			obtainable: true,
		});
	});

	it("surfaces Mage Lodge's mutually exclusive absence requirements as a limitation", async () => {
		const config = await readArkiniGameConfigSource();
		const graph = Effect.runSync(createEditorAcquisitionGraphFx(config));
		const route = graph.routes.find(
			(candidate) =>
				candidate.metadata.kind === "line-output" &&
				candidate.metadata.lineId === "line:blueprint:mage-lodge:construct" &&
				candidate.output.factId === "producer:mage-lodge",
		);

		expect(graph.limitations).toContain("negative-availability-constraints-ignored");
		expect(route).toBeDefined();
		expect(route?.requirements.allOf).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					factId: "producer:house-of-engineers",
				}),
			]),
		);
		expect(route?.requirements.allOf).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					factId: "producer:cathedral",
				}),
			]),
		);
	});

	it("keeps exact and upper-bound universe conditions from becoming complete lower bounds", async () => {
		const config = structuredClone(await readArkiniGameConfigSource());
		const lumberjack = config.items["producer:lumberjack-t1"];
		if (lumberjack?.type !== "producer") throw new Error("Lumberjack fixture is missing.");
		const line = lumberjack.lines?.find(({ id }) => id === "line:lumberjack-t1:log");
		if (line === undefined) throw new Error("Lumberjack line fixture is missing.");
		line.rules = [
			{
				type: "enable",
				when: [
					{
						count: 2,
						query: {
							scope: "universe",
							selector: {
								itemId: "item:coin",
								type: "item",
							},
						},
						type: "count",
					},
					{
						max: 4,
						min: 1,
						query: {
							scope: "universe",
							selector: {
								itemId: "item:water",
								type: "item",
							},
						},
						type: "range",
					},
				],
			},
		];

		const graph = Effect.runSync(createEditorAcquisitionGraphFx(config));
		const route = graph.routes.find(
			(candidate) =>
				candidate.metadata.kind === "line-output" &&
				candidate.metadata.lineId === line.id &&
				candidate.output.factId === "item:log",
		);
		expect(route?.requirements.unsupported).toEqual([
			{
				factId: "item:coin",
				reason: "exact-count",
				source: "line-condition",
			},
			{
				factId: "item:water",
				reason: "upper-bound",
				source: "line-condition",
			},
		]);
		expect(
			Effect.runSync(
				estimateEditorItemFx({
					factId: "item:log",
					graph,
				}),
			),
		).toMatchObject({
			diagnostics: expect.arrayContaining([
				expect.objectContaining({
					kind: "availability-condition-unsupported",
					reason: "exact-count",
				}),
			]),
			status: "partial",
		});

		line.rules = [
			{
				type: "enable",
				when: [
					{
						query: {
							scope: "universe",
							selector: {
								itemId: "item:water",
								type: "item",
							},
						},
						type: "exists",
					},
				],
			},
		];
		const lowerBoundGraph = Effect.runSync(createEditorAcquisitionGraphFx(config));
		const lowerBoundRoute = lowerBoundGraph.routes.find(
			(candidate) =>
				candidate.metadata.kind === "line-output" &&
				candidate.metadata.lineId === line.id &&
				candidate.output.factId === "item:log",
		);
		expect(lowerBoundRoute?.requirements.unsupported).toEqual([]);
		expect(lowerBoundRoute?.requirements.allOf).toContainEqual(
			expect.objectContaining({
				factId: "item:water",
				quantity: 1,
			}),
		);
	});

	it("marks unsupported charged renewal without claiming complete totals", async () => {
		const config = await readArkiniGameConfigSource();
		const graph = Effect.runSync(createEditorAcquisitionGraphFx(config));
		const logRoute = graph.routes.find(
			(route) =>
				route.metadata.kind === "line-output" &&
				route.metadata.lineId === "line:lumberjack-t1:log" &&
				route.output.factId === "item:log",
		);
		expect(logRoute?.chargeUses).toContainEqual(
			expect.objectContaining({
				payerFactId: "item:tree",
				usableActionRuns: 18,
			}),
		);

		const estimate = Effect.runSync(
			estimateEditorItemFx({
				factId: "item:log",
				graph,
				quantity: 100,
			}),
		);
		expect(estimate).toMatchObject({
			diagnostics: expect.arrayContaining([
				expect.objectContaining({
					kind: "charge-renewal-unsupported",
				}),
			]),
			obtainable: false,
			status: "partial",
		});
		expect("durationMs" in estimate).toBe(false);
		expect("consumables" in estimate).toBe(false);
	});

	it("uses initial no-output charge capacity before rebuilding a depleted Well", async () => {
		const config = await readArkiniGameConfigSource();
		const graph = Effect.runSync(createEditorAcquisitionGraphFx(config));
		const estimate = Effect.runSync(
			estimateEditorItemFx({
				factId: "item:water",
				graph,
				quantity: 61,
			}),
		);

		expect(estimate).toMatchObject({
			obtainable: true,
			oneTimeRequirements: expect.arrayContaining([
				{
					factId: "producer:well-t1",
					quantity: 2,
				},
			]),
			status: "complete",
		});
		if (!estimate.obtainable) throw new Error("Expected acyclic Well replacement.");
		expect(estimate.durationMs).toBeGreaterThan(155_000);
	});

	it("keeps weighted selection and authored range probability mass", () => {
		const output = OutputSchema.parse({
			set: [
				{
					roll: [
						{
							drop: [
								{
									drop: [
										{
											itemId: "a",
											quantity: {
												max: 2,
												min: 1,
											},
											rules: [],
										},
									],
									weight: 1,
								},
								{
									drop: [
										{
											itemId: "b",
											quantity: {
												max: 1,
												min: 1,
											},
											rules: [],
										},
									],
									weight: 1,
								},
							],
							quantity: {
								max: 1,
								min: 1,
							},
							type: "weight",
						},
					],
					weight: 1,
				},
			],
		});
		const occurrences = Effect.runSync(
			readEditorAcquisitionOutputOccurrencesFx(output),
		).occurrences;
		const a = occurrences.find(({ factId }) => factId === "a");

		expect(a?.quantityDistribution).toEqual([
			{
				probability: 0.5,
				quantity: 0,
			},
			{
				probability: 0.25,
				quantity: 1,
			},
			{
				probability: 0.25,
				quantity: 2,
			},
		]);
	});

	it("preserves correlated co-outputs and convolves repeated same-fact drops", () => {
		const output = OutputSchema.parse({
			set: [
				{
					roll: [
						{
							drop: [
								{
									itemId: "a",
									quantity: {
										max: 1,
										min: 1,
									},
									rules: [],
								},
							],
							type: "guaranteed",
						},
						{
							chance: 0.5,
							drop: [
								{
									itemId: "a",
									quantity: {
										max: 1,
										min: 1,
									},
									rules: [],
								},
								{
									itemId: "b",
									quantity: {
										max: 1,
										min: 1,
									},
									rules: [],
								},
							],
							type: "chance",
						},
					],
					weight: 1,
				},
			],
		});
		const model = Effect.runSync(readEditorAcquisitionOutputOccurrencesFx(output));
		const a = model.occurrences.filter(({ factId }) => factId === "a");

		expect(a[0]?.occurrenceQuantityDistribution).toEqual([
			{
				probability: 1,
				quantity: 1,
			},
		]);
		expect(a[1]?.occurrenceQuantityDistribution).toEqual([
			{
				probability: 0.5,
				quantity: 0,
			},
			{
				probability: 0.5,
				quantity: 1,
			},
		]);
		expect(model.outputDistribution).toHaveLength(2);
		const nonEmptyOutcome = model.outputDistribution.find(
			({ quantities }) => quantities.length === 2,
		);
		expect(nonEmptyOutcome).toMatchObject({
			probability: 0.5,
			quantities: expect.arrayContaining([
				expect.objectContaining({
					quantity: 2,
				}),
				expect.objectContaining({
					quantity: 1,
				}),
			]),
		});
		expect(a[0]?.quantityDistribution).toEqual([
			{
				probability: 0.5,
				quantity: 1,
			},
			{
				probability: 0.5,
				quantity: 2,
			},
		]);
		expect(a[1]?.quantityDistribution).toEqual(a[0]?.quantityDistribution);
	});

	it("bounds authored output state compilation before cartesian expansion", () => {
		const chanceRoll = (index: number) => ({
			chance: 0.5,
			drop: [
				{
					itemId: `item:${index}`,
					quantity: {
						max: 1,
						min: 1,
					},
					rules: [],
				},
			],
			type: "chance" as const,
		});
		const model = Effect.runSync(
			readEditorAcquisitionOutputOccurrencesFx(
				OutputSchema.parse({
					set: [
						{
							roll: Array.from(
								{
									length: 14,
								},
								(_, index) => chanceRoll(index),
							),
							weight: 1,
						},
					],
				}),
			),
		);

		expect(model).toMatchObject({
			compilation: "state-space-unsupported",
			occurrences: {
				length: 14,
			},
			outputDistribution: [],
		});

		const hugeRange = Effect.runSync(
			readEditorAcquisitionOutputOccurrencesFx(
				OutputSchema.parse({
					set: [
						{
							roll: [
								{
									drop: [
										{
											itemId: "huge",
											quantity: {
												max: 4_294_967_296,
												min: 1,
											},
											rules: [],
										},
									],
									type: "guaranteed",
								},
							],
							weight: 1,
						},
					],
				}),
			),
		);
		expect(hugeRange.compilation).toBe("state-space-unsupported");
	});

	it("uses the aggregated same-fact marginal for nested demand", async () => {
		const makerLine = createLine({
			id: "line:maker:a",
			output: createOutput([
				{
					itemId: "a",
				},
				{
					itemId: "a",
				},
			]),
		});
		makerLine.runtimeMs = 10;
		const consumerLine = createLine({
			id: "line:consumer:target",
			input: [
				{
					capacity: 2,
					mode: "consume",
					quantity: {
						max: 2,
						min: 2,
					},
					selector: {
						itemId: "a",
						type: "item",
					},
					type: "materials",
				},
			],
			output: createOutput([
				{
					itemId: "target",
				},
			]),
		});
		const result = await Effect.runPromise(
			compileGameSourcesFx([
				createRootSource({
					items: {
						a: createSimpleItem("a"),
						consumer: createProducerItem({
							id: "consumer",
							lines: [
								consumerLine,
							],
						}),
						maker: createProducerItem({
							id: "maker",
							lines: [
								makerLine,
							],
						}),
						target: createSimpleItem("target"),
					},
					start: {
						board: [
							{
								itemId: "maker",
								space: 0,
								x: 0,
								y: 0,
							},
							{
								itemId: "consumer",
								space: 0,
								x: 1,
								y: 0,
							},
						],
						currentSpace: 0,
						inventory: [],
						toolbar: [],
					},
				}),
			]),
		);
		expect(result.diagnostics).toEqual([]);
		if (result.config === undefined) throw new Error("Expected valid nested marginal config.");
		const graph = Effect.runSync(createEditorAcquisitionGraphFx(result.config));
		const aRoutes = graph.routes.filter(({ output }) => output.factId === "a");
		expect(aRoutes).toHaveLength(2);
		expect(aRoutes[0]?.output.quantityDistribution).toEqual([
			{
				probability: 1,
				quantity: 2,
			},
		]);
		const estimate = Effect.runSync(
			estimateEditorItemFx({
				factId: "target",
				graph,
			}),
		);
		expect(estimate).toMatchObject({
			durationMs: 10,
			obtainable: true,
			status: "complete",
		});
		if (!estimate.obtainable) throw new Error("Expected nested marginal estimate.");
		expect(estimate.routeSteps.find(({ factId }) => factId === "a")).toMatchObject({
			actionRuns: 1,
			outputRuns: 1,
		});
	});

	it("keeps capped authored occurrences in Flow data and returns a partial Estimate", async () => {
		const roll = Array.from(
			{
				length: 14,
			},
			(_, index) => ({
				chance: 0.5,
				drop: [
					{
						itemId: `chance:${index}`,
						quantity: {
							max: 1,
							min: 1,
						},
						rules: [],
					},
				],
				type: "chance" as const,
			}),
		);
		const output = OutputSchema.parse({
			set: [
				{
					roll,
					weight: 1,
				},
			],
		});
		const items = Object.fromEntries(
			Array.from(
				{
					length: 14,
				},
				(_, index) => [
					`chance:${index}`,
					createSimpleItem(`chance:${index}`),
				],
			),
		);
		const result = await Effect.runPromise(
			compileGameSourcesFx([
				createRootSource({
					items: {
						...items,
						maker: createProducerItem({
							id: "maker",
							output,
						}),
					},
					start: {
						board: [
							{
								itemId: "maker",
								space: 0,
								x: 0,
								y: 0,
							},
						],
						currentSpace: 0,
						inventory: [],
						toolbar: [],
					},
				}),
			]),
		);
		expect(result.diagnostics).toEqual([]);
		if (result.config === undefined) throw new Error("Expected valid capped-output config.");
		const graph = Effect.runSync(createEditorAcquisitionGraphFx(result.config));
		expect(graph.routes.filter(({ metadata }) => metadata.kind === "line-output")).toHaveLength(
			14,
		);
		expect(graph.routes[0]?.operation?.outputCompilation).toBe("state-space-unsupported");
		expect(
			Effect.runSync(
				estimateEditorItemFx({
					factId: "chance:0",
					graph,
				}),
			),
		).toMatchObject({
			diagnostics: expect.arrayContaining([
				expect.objectContaining({
					kind: "joint-output-accounting-unsupported",
				}),
			]),
			status: "partial",
		});
	});

	it("only projects charge depletion after an exact number of authored spends", async () => {
		const config = structuredClone(await readArkiniGameConfigSource());
		const tree = config.items["item:tree"];
		const lumberjack = config.items["producer:lumberjack-t1"];
		if (tree?.charges === undefined || lumberjack?.type !== "producer")
			throw new Error("Official charge fixture is missing.");
		const line = lumberjack.lines?.find(({ id }) => id === "line:lumberjack-t1:log");
		const deposit = line?.input.find(({ type }) => type === "deposit");
		if (line === undefined || deposit?.charges === undefined)
			throw new Error("Official charged line fixture is missing.");
		tree.charges.amount = 3;
		deposit.charges.cost = 2;

		const nonDivisible = Effect.runSync(createEditorAcquisitionGraphFx(config));
		expect(
			nonDivisible.routes.some(
				(route) =>
					route.metadata.kind === "line-charge-depletion" &&
					route.metadata.lineId === line.id &&
					route.metadata.chargedItemId === tree.id,
			),
		).toBe(false);
		const threeRuns = Effect.runSync(
			estimateEditorItemFx({
				factId: "item:log",
				graph: nonDivisible,
				quantity: 3,
			}),
		);
		expect(threeRuns).toMatchObject({
			obtainable: true,
			oneTimeRequirements: expect.arrayContaining([
				{
					factId: tree.id,
					quantity: 3,
				},
			]),
		});

		tree.charges.amount = 4;
		const divisible = Effect.runSync(createEditorAcquisitionGraphFx(config));
		expect(divisible.routes).toContainEqual(
			expect.objectContaining({
				metadata: expect.objectContaining({
					chargedItemId: tree.id,
					kind: "line-charge-depletion",
					lineId: line.id,
				}),
				runMultiplier: 2,
				requirements: expect.objectContaining({
					allOf: expect.arrayContaining([
						expect.objectContaining({
							factId: tree.id,
							quantity: 1,
							usage: "consume",
						}),
					]),
				}),
			}),
		);
	});

	it("marks both roles of a self-merge as distinct live identities", () => {
		const config = createMergeTestConfig({
			rule: {
				action: "use",
				effect: "keep",
				output: createOutput([
					{
						itemId: "result",
					},
				]),
				target: {
					itemId: "source",
					type: "item",
				},
			},
			sourceMaxCount: 2,
		});
		const graph = Effect.runSync(createEditorAcquisitionGraphFx(config));
		const selfMerge = graph.routes.find(
			(route) =>
				route.metadata.kind === "merge-output" &&
				route.metadata.sourceItemId === "source" &&
				route.metadata.targetItemId === "source",
		);

		expect(selfMerge?.requirements.allOf).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					factId: "source",
					identity: "distinct",
					source: "merge-source",
				}),
				expect.objectContaining({
					factId: "source",
					identity: "distinct",
					source: "merge-target",
				}),
			]),
		);
	});

	it("keeps a validator-valid route whose same canonical payer uses two identities", async () => {
		const chargedDeposit = (itemId: string) => ({
			charges: {
				cost: 1,
				from: "target" as const,
			},
			query: {
				distance: "close" as const,
				scope: "board" as const,
				selector: {
					itemId,
					type: "item" as const,
				},
			},
			type: "deposit" as const,
		});
		const producer = createProducerItem({
			id: "producer",
			lines: [
				createLine({
					id: "line:producer:target",
					input: [
						chargedDeposit("payer"),
						chargedDeposit("payer"),
					],
					output: createOutput([
						{
							itemId: "target",
						},
					]),
				}),
			],
		});
		const payer = {
			...createSimpleItem("payer"),
			charges: {
				amount: 1,
			},
			maxCount: 2,
			scope: "board" as const,
		};
		const result = await Effect.runPromise(
			compileGameSourcesFx([
				createRootSource({
					items: {
						payer,
						producer,
						target: createSimpleItem("target"),
					},
				}),
			]),
		);
		expect(result.diagnostics).toEqual([]);
		if (result.config === undefined) throw new Error("Expected validator-valid config.");

		const graph = Effect.runSync(createEditorAcquisitionGraphFx(result.config));
		const route = graph.routes.find(({ output }) => output.factId === "target");
		expect(route).toMatchObject({
			chargeUses: [
				{
					accounting: "multi-payer-unsupported",
					payerFactId: "payer",
					usableActionRuns: 0,
				},
			],
			operation: {
				inputs: [
					{
						factId: "payer",
					},
					{
						factId: "payer",
					},
				],
			},
		});

		const owner = {
			id: "runtime:producer",
			item: result.config.items.producer,
			location: {
				position: {
					x: 1,
					y: 0,
				},
				scope: "board" as const,
				space: 0,
			},
			quantity: 1,
			revision: "revision:producer",
		};
		const runtimePayer = (id: string, x: number) => ({
			id,
			item: result.config!.items.payer,
			location: {
				position: {
					x,
					y: 0,
				},
				scope: "board" as const,
				space: 0,
			},
			quantity: 1,
			revision: `revision:${id}`,
		});
		const run = Effect.runSync(
			resolveLineRunFx({
				lineId: "line:producer:target",
				ownerItemId: owner.id,
				runtime: {
					cheats: {
						enabled: false,
						everEnabled: false,
						instantGameplay: false,
					},
					currentSpace: 0,
					items: [
						owner,
						runtimePayer("runtime:payer:a", 0),
						runtimePayer("runtime:payer:b", 2),
					],
					jobs: [],
				},
			}),
		);
		expect(run).toMatchObject({
			input: [
				{
					plan: {
						charges: {
							itemId: "runtime:payer:a",
						},
					},
				},
				{
					plan: {
						charges: {
							itemId: "runtime:payer:b",
						},
					},
				},
			],
			ready: true,
		});
	});

	it("surfaces authored runtime rules that static duration does not evaluate", async () => {
		const config = structuredClone(await readArkiniGameConfigSource());
		const lumberjack = config.items["producer:lumberjack-t1"];
		if (lumberjack?.type !== "producer" || lumberjack.lines === undefined)
			throw new Error("Official line fixture is missing.");
		lumberjack.lines[0]?.rules.push({
			multiplier: 2,
			type: "runtime:multiplier",
			when: [
				{
					query: {
						distance: "close",
						scope: "board",
						selector: {
							itemId: "item:tree",
							type: "item",
						},
					},
					type: "exists",
				},
			],
		});

		const graph = Effect.runSync(createEditorAcquisitionGraphFx(config));
		expect(graph.limitations).toContain("conditional-runtime-adjustments-ignored");
	});

	it("estimates the complete official item index within the static-analysis budget", async () => {
		const config = await readArkiniGameConfigSource();
		const graph = Effect.runSync(createEditorAcquisitionGraphFx(config));
		const started = performance.now();
		const estimates = Object.keys(config.items)
			.sort((left, right) => left.localeCompare(right))
			.map((factId) =>
				Effect.runSync(
					estimateEditorItemFx({
						factId,
						graph,
					}),
				),
			);
		expect(estimates.filter(({ status }) => status === "complete")).toHaveLength(102);
		expect(estimates.filter(({ status }) => status === "partial")).toHaveLength(142);
		expect(estimates.filter(({ status }) => status === "unreachable")).toHaveLength(3);
		expect(estimates.find(({ factId }) => factId === "producer:chicken-coop-t1")).toMatchObject(
			{
				obtainable: true,
				status: "complete",
			},
		);
		expect(estimates.find(({ factId }) => factId === "item:axe")).toMatchObject({
			diagnostics: expect.arrayContaining([
				expect.objectContaining({
					kind: "charge-renewal-unsupported",
				}),
			]),
			status: "partial",
		});
		expect(performance.now() - started).toBeLessThan(10_000);
	}, 12_000);
});
