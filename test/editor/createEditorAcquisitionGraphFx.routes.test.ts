import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createEditorAcquisitionGraphFx } from "~/editor/createEditorAcquisitionGraphFx";
import { estimateEditorItemFx } from "~/editor/estimator/estimateEditorItemFx";
import { readArkiniGameConfigSource } from "~test/schema/support/readArkiniGameConfigSource";

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
		expect(eggs.route.actionRuns).toBeGreaterThan(0);
		expect(eggs.route.outputRuns).toBeGreaterThan(0);
	});

	it("ignores charged-item capacity while retaining structural prerequisites", async () => {
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
			obtainable: true,
		});
		if (!estimate.obtainable) throw new Error("Expected optimistic Log route.");
		expect(estimate.route.requirements).toContainEqual(
			expect.objectContaining({
				factId: "item:tree",
				quantity: 1,
				usage: "one-time",
			}),
		);
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
		expect(route?.requirements.allOf).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					factId: "producer:library-t4",
					quantity: 1,
					source: "line-condition",
				}),
			]),
		);
	});

	it("keeps optimistic enable lower bounds while surfacing exact and upper semantics", async () => {
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
		expect(route?.requirements.allOf).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					factId: "item:coin",
					quantity: 2,
					source: "line-condition",
				}),
				expect.objectContaining({
					factId: "item:water",
					quantity: 1,
					source: "line-condition",
				}),
			]),
		);
		expect(
			Effect.runSync(
				estimateEditorItemFx({
					factId: "item:log",
					graph,
				}),
			),
		).toMatchObject({
			status: "unreachable",
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

	it("ignores charged renewal when estimating repeated output", async () => {
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
			obtainable: true,
			status: "complete",
		});
		expect("durationMs" in estimate).toBe(true);
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
			status: "complete",
		});
		if (!estimate.obtainable) throw new Error("Expected acyclic Well replacement.");
		expect(
			estimate.routeSteps.find(({ factId }) => factId === "producer:well-t1")?.quantity,
		).toBe(1);
	});
});
