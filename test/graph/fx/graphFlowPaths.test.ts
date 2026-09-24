import { Effect } from "effect";
import { expect, it } from "vitest";
import { compileGraphFactsFn } from "~/graph/fn/compileGraphFactsFn";
import { compileGraphOperationIndexFn } from "~/graph/fn/compileGraphOperationIndexFn";
import { queryGraphFlowFx } from "~/graph/fx/queryGraphFlowFx";
import { GraphFlowQuerySchema } from "~/graph/schema/GraphFlowQuerySchema";
import {
	configFn,
	itemFn,
	lineFn,
	outputFn,
	queryFn,
} from "../fn/compileGraphFactsFn.test/fixtures";

const readFn = (items: Record<string, unknown>, from: string, to: string, options = {}) =>
	Effect.runPromise(
		queryGraphFlowFx(
			compileGraphOperationIndexFn(compileGraphFactsFn(configFn(items))),
			GraphFlowQuerySchema.parse({
				from: `item:${from}`,
				to: `item:${to}`,
				...options,
			}),
		),
	);

it("reports authored paths even when a later operation names an earlier consumed participant", async () => {
	const result = await readFn(
		{
			A: itemFn("A", {
				merge: [
					{
						action: "consume",
						effect: "replace",
						target: {
							type: "item",
							itemUid: "B",
						},
						result: "C",
					},
				],
			}),
			B: itemFn("B"),
			C: itemFn("C", {
				lines: [
					lineFn("reuse", {
						input: [
							{
								type: "materials",
								mode: "consume",
								query: queryFn("A"),
								quantity: {
									min: 1,
									max: 1,
								},
							},
						],
						outcome: outputFn("D"),
					}),
				],
			}),
			D: itemFn("D"),
		},
		"A",
		"D",
	);
	expect(result.flows.map((flow) => flow.nodes)).toContainEqual([
		"item:A",
		"item:C",
		"item:D",
	]);
	expect(result.flows.map((flow) => flow.steps.length)).toEqual([
		1,
		2,
	]);
});

it("returns shortest paths first, preserves parallel operations and never revisits a path node", async () => {
	const items = {
		A: itemFn("A", {
			lines: [
				lineFn("ab", {
					outcome: outputFn("B"),
				}),
				lineFn("ad", {
					outcome: outputFn("D"),
				}),
				lineFn("ad2", {
					outcome: outputFn("D"),
				}),
			],
		}),
		B: itemFn("B", {
			lines: [
				lineFn("ba", {
					outcome: outputFn("A"),
				}),
				lineFn("bd", {
					outcome: outputFn("D"),
				}),
			],
		}),
		D: itemFn("D"),
		absent: itemFn("absent"),
	};
	const all = await readFn(items, "A", "D");
	expect(all.flows.map((flow) => flow.steps.map((step) => step.operationId))).toEqual([
		[
			'["line","ad"]',
		],
		[
			'["line","ad2"]',
		],
		[
			'["line","ab"]',
			'["line","bd"]',
		],
	]);
	expect(all.truncated).toBe(false);
	const absent = await readFn(items, "A", "absent");
	expect(absent.status).toBe("no");
	expect(absent.expansions).toBeLessThan(10);
	const same = await readFn(items, "A", "A");
	expect(same).toMatchObject({
		flows: [
			{
				nodes: [
					"item:A",
				],
				steps: [],
			},
		],
		expansions: 0,
		truncated: false,
	});
});

it("marks a result limit only when further candidates remain", async () => {
	const items = {
		A: itemFn("A", {
			lines: [
				lineFn("ab", {
					outcome: outputFn("B"),
				}),
			],
		}),
		B: itemFn("B", {
			lines: [
				lineFn("ba", {
					outcome: outputFn("A"),
				}),
				lineFn("bc", {
					outcome: outputFn("C"),
				}),
			],
		}),
		C: itemFn("C"),
	};
	expect(
		await readFn(items, "A", "C", {
			limit: 1,
		}),
	).toMatchObject({
		status: "yes",
		truncated: false,
		reasons: [],
	});
	const parallel = {
		...items,
		A: itemFn("A", {
			lines: [
				lineFn("ab", {
					outcome: outputFn("B"),
				}),
				lineFn("ab2", {
					outcome: outputFn("B"),
				}),
			],
		}),
	};
	const partial = await readFn(parallel, "A", "C", {
		limit: 1,
	});
	expect(partial).toMatchObject({
		status: "yes",
		truncated: true,
		reasons: [
			"limit",
		],
	});
	expect(partial.flows).toHaveLength(1);
});
