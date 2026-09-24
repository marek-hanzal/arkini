import { medicinalItemsFn } from "./graphFlowContinuity.test/fixtures";
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
const mergeFn = (target: string, result: string, extra = {}) => ({
	action: "consume",
	effect: "replace",
	target: {
		type: "item",
		itemUid: target,
	},
	result,
	...extra,
});
const materialFn = (itemUid: string, mode = "consume") => ({
	type: "materials",
	mode,
	query: queryFn(itemUid),
	quantity: {
		min: 1,
		max: 1,
	},
});

it("retires both merge participants even when following its container side output, and permits explicit compatible recreation", async () => {
	for (const restore of [
		"none",
		"same-roll",
		"other-set",
		"other-chance",
	] as const) {
		const result = await readFn(medicinalItemsFn(restore), "sick", "goal");
		const recycled = result.flows.filter(
			(flow) => flow.nodes.join(",") === "item:sick,item:dirty,item:jar,item:goal",
		);
		expect(recycled.length > 0, restore).toBe(restore === "same-roll");
		if (restore === "same-roll") {
			expect(recycled[0].nodes).toEqual([
				"item:sick",
				"item:dirty",
				"item:jar",
				"item:goal",
			]);
			expect(recycled[0].steps[0].evidence.participantEffects).toEqual([
				{
					node: "item:medicine",
					effect: "consumed",
				},
				{
					node: "item:sick",
					effect: "replaced",
				},
			]);
			expect(recycled[0].externalPrerequisiteNodes).toEqual([
				"item:medicine",
			]);
		}
	}
});

it("does not borrow a consumed, removed or spent prerequisite again, while preserving reusable participants", async () => {
	for (const action of [
		"consume",
		"spend",
		"use",
	] as const) {
		for (const effect of [
			"keep",
			"remove",
			"spend",
		] as const) {
			const result = await readFn(
				{
					A: itemFn("A", {
						merge: [
							{
								action,
								effect,
								target: {
									type: "item",
									itemUid: "B",
								},
								outcome: outputFn("C"),
							},
						],
					}),
					B: itemFn("B"),
					C: itemFn("C", {
						lines: [
							lineFn("reuse", {
								input: [
									materialFn("A"),
									materialFn("B"),
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
			expect(
				result.flows.some((flow) => flow.nodes.includes("item:C")),
				`${action}/${effect}`,
			).toBe(action === "use" && effect === "keep");
		}
	}
	for (const mode of [
		"consume",
		"reserve",
	]) {
		const result = await readFn(
			{
				A: itemFn("A"),
				B: itemFn("B", {
					lines: [
						lineFn("first", {
							input: [
								materialFn("A", mode),
							],
							outcome: outputFn("C"),
						}),
					],
				}),
				C: itemFn("C", {
					lines: [
						lineFn("reuse", {
							input: [
								materialFn("A"),
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
		expect(
			result.flows.some((flow) => flow.nodes.includes("item:C")),
			mode,
		).toBe(mode === "reserve");
	}
});

it("ranks all equal-depth candidates before limiting, then prefers fewer external prerequisites and direct replacement", async () => {
	const items = {
		A: itemFn("A", {
			lines: [
				lineFn("costly", {
					input: [
						materialFn("X"),
						materialFn("Y"),
					],
					outcome: outputFn("D"),
				}),
			],
		}),
		X: itemFn("X", {
			merge: [
				{
					action: "use",
					effect: "keep",
					target: {
						type: "item",
						itemUid: "A",
					},
					outcome: outputFn("D"),
				},
				mergeFn("A", "D", {
					action: "use",
				}),
			],
		}),
		Y: itemFn("Y"),
		D: itemFn("D"),
	};
	const result = await readFn(items, "A", "D", {
		limit: 1,
	});
	expect(result.flows[0].steps[0].evidence.output).toBe("replacement");
	expect(result.flows[0].externalPrerequisiteNodes).toEqual([
		"item:X",
	]);
	expect(result.reasons).toEqual([
		"limit",
	]);
});

it("permits a bounded revisit after explicit state recreation without endlessly expanding reversible cycles", async () => {
	const restore = outputFn("A");
	restore.set[0].roll[0].outcome.push(outputFn("key").set[0].roll[0].outcome[0]);
	const items = {
		A: itemFn("A", {
			merge: [
				mergeFn("key", "B"),
				mergeFn("key", "goal"),
			],
		}),
		key: itemFn("key"),
		B: itemFn("B", {
			clock: {
				durationMs: 1000,
				onExpire: restore,
			},
		}),
		goal: itemFn("goal"),
		absent: itemFn("absent"),
	};
	const result = await readFn(items, "A", "absent", {
		maxDepth: 12,
	});
	expect(result.status).toBe("no");
	expect(result.expansions).toBeLessThan(30);
	const revisits = await readFn(items, "A", "goal");
	expect(
		revisits.flows.some((flow) => flow.nodes.join(",") === "item:A,item:B,item:A,item:goal"),
	).toBe(true);
	expect(revisits.flows[0].steps).toHaveLength(1);
});

it("retires expired, depleted and unit-paying owners before a later branch tries to reuse them", async () => {
	for (const fields of [
		{
			clock: {
				durationMs: 1000,
				onExpire: outputFn("C"),
			},
		},
		{
			units: {
				amount: 1,
				outcome: outputFn("C"),
			},
		},
		{
			lines: [
				lineFn("pay", {
					input: [
						{
							type: "simple",
							units: {
								from: "self",
								cost: 1,
							},
						},
					],
					outcome: outputFn("C"),
				}),
			],
		},
	]) {
		const result = await readFn(
			{
				A: itemFn("A", fields),
				C: itemFn("C", {
					merge: [
						mergeFn("A", "D"),
					],
				}),
				D: itemFn("D"),
			},
			"A",
			"D",
		);
		expect(result.flows.some((flow) => flow.nodes.includes("item:C"))).toBe(false);
	}
});

it("retains unconditional co-products when following replacement without pooling mutually exclusive sets", async () => {
	for (const alternative of [
		false,
		true,
	]) {
		const outcome = outputFn("tool");
		if (alternative) outcome.set.push(outputFn("other").set[0]);
		const result = await readFn(
			{
				A: itemFn("A"),
				tool: itemFn("tool", {
					merge: [
						mergeFn("A", "B", {
							outcome,
						}),
					],
				}),
				B: itemFn("B", {
					lines: [
						lineFn("finish", {
							input: [
								materialFn("tool"),
							],
							outcome: outputFn("goal"),
						}),
					],
				}),
				other: itemFn("other"),
				goal: itemFn("goal"),
			},
			"A",
			"goal",
		);
		expect(
			result.flows.some((flow) => flow.nodes.join(",") === "item:A,item:B,item:goal"),
		).toBe(!alternative);
	}
});
