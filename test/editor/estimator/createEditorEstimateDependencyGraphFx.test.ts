import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createEditorEstimateDependencyGraphFx } from "~/editor/estimator/createEditorEstimateDependencyGraphFx";
import { estimateEditorItemFx } from "~/editor/estimator/estimateEditorItemFx";
import { readEditorEstimateOutputOccurrencesFx } from "~/editor/estimator/readEditorEstimateOutputOccurrencesFx";
import { OutputSchema } from "~/engine/output/schema/OutputSchema";
import { readArkiniGameConfigSource } from "~test/schema/support/readArkiniGameConfigSource";

describe("createEditorEstimateDependencyGraphFx", () => {
	it("projects official authored starts, lines, chance outputs, and merges", async () => {
		const config = await readArkiniGameConfigSource();
		const graph = Effect.runSync(createEditorEstimateDependencyGraphFx(config));

		expect(graph.factIds).toHaveLength(Object.keys(config.items).length);
		expect(graph.roots.length).toBeGreaterThan(0);
		expect(graph.routes.length).toBeGreaterThan(0);
		expect(graph.limitations).toEqual([
			"charge-renewal-approximated",
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
		const occurrences = Effect.runSync(readEditorEstimateOutputOccurrencesFx(output));
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

		const nonDivisible = Effect.runSync(createEditorEstimateDependencyGraphFx(config));
		expect(
			nonDivisible.routes.some(
				(route) =>
					route.metadata.kind === "line-charge-depletion" &&
					route.metadata.lineId === line.id &&
					route.metadata.chargedItemId === tree.id,
			),
		).toBe(false);

		tree.charges.amount = 4;
		const divisible = Effect.runSync(createEditorEstimateDependencyGraphFx(config));
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
							quantity: 0.5,
							usage: "consume",
						}),
					]),
				}),
			}),
		);
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

		const graph = Effect.runSync(createEditorEstimateDependencyGraphFx(config));
		expect(graph.limitations).toContain("conditional-runtime-adjustments-ignored");
	});

	it("estimates the complete official item index within the static-analysis budget", async () => {
		const config = await readArkiniGameConfigSource();
		const graph = Effect.runSync(createEditorEstimateDependencyGraphFx(config));
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

		expect(estimates.filter(({ obtainable }) => obtainable)).toHaveLength(244);
		expect(estimates.find(({ factId }) => factId === "producer:chicken-coop-t1")).toMatchObject(
			{
				obtainable: true,
			},
		);
		expect(performance.now() - started).toBeLessThan(10_000);
	}, 12_000);
});
