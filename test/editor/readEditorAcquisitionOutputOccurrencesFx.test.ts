import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createEditorAcquisitionGraphFx } from "~/editor/createEditorAcquisitionGraphFx";
import { estimateEditorItemFx } from "~/editor/estimator/estimateEditorItemFx";
import { readEditorAcquisitionOutputOccurrencesFx } from "~/editor/readEditorAcquisitionOutputOccurrencesFx";
import { compileGameSourcesFx } from "~/engine/compiler/fx/compileGameSourcesFx";
import { OutputSchema } from "~/engine/output/schema/OutputSchema";
import {
	createLine,
	createOutput,
	createProducerItem,
	createRootSource,
	createSimpleItem,
} from "~test/validation/support/gameValidationTestSource";

describe("createEditorAcquisitionGraphFx", () => {
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
});
