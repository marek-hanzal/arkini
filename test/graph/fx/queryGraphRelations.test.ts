import { Effect } from "effect";
import { expect, it } from "vitest";
import { createProjectGraphFx } from "~/graph/fx/createProjectGraphFx";
import { projectFn } from "./createProjectGraphFx.test/fixtures";
import {
	adversarialConfigFn,
	configFn,
	itemFn,
	lineFn,
	outputFn,
} from "../fn/compileGraphFactsFn.test/fixtures";

it("answers who produces B separately from merges into B and rule mentions of B", async () => {
	const project = {
		...projectFn(
			[],
			[
				"A",
			],
		),
		config: adversarialConfigFn(),
	};
	const graph = await Effect.runPromise(createProjectGraphFx());
	const productions = await Effect.runPromise(
		graph.queryFx(project, {
			kind: "connections",
			from: "item:B",
			direction: "in",
			kinds: [
				"line-item-outcome",
			],
		}),
	);
	expect(
		productions.edges.map((edge) => [
			edge.from,
			edge.to,
			edge.annotations.setIndex,
			edge.annotations.rollIndex,
			edge.annotations.outcomeIndex,
		]),
	).toEqual([
		[
			"item:A",
			"item:B",
			0,
			0,
			0,
		],
		[
			"item:A",
			"item:B",
			0,
			0,
			3,
		],
		[
			"item:A",
			"item:B",
			0,
			1,
			0,
		],
		[
			"item:A",
			"item:B",
			1,
			0,
			0,
		],
	]);
	expect(productions.edges[0].annotations.chance).toBe(0);
	const accepts = await Effect.runPromise(
		graph.queryFx(project, {
			kind: "connections",
			from: "item:B",
			direction: "in",
			kinds: [
				"merge-target",
			],
		}),
	);
	expect(accepts.edges).toHaveLength(2);
	expect(accepts.edges.every((edge) => edge.from === "item:A" && edge.to === "item:B")).toBe(
		true,
	);
	const rules = await Effect.runPromise(
		graph.queryFx(project, {
			kind: "connections",
			from: "item:B",
			direction: "in",
			kinds: [
				"rule-reference",
			],
		}),
	);
	expect(rules.edges).toHaveLength(16);
	expect(
		rules.edges.some(
			(edge) =>
				edge.annotations.condition?.type === "count" &&
				edge.annotations.condition.count === 0,
		),
	).toBe(true);
	expect(
		(
			await Effect.runPromise(
				graph.queryFx(project, {
					kind: "connections",
					from: "item:B",
					to: "item:A",
					kinds: [
						"line-item-outcome",
					],
				}),
			)
		).status,
	).toBe("no");
});
it("keeps distinct line UIDs in separate operations and bounds node-owned operation results", async () => {
	const project = {
		...projectFn(
			[],
			[
				"A",
			],
		),
		config: configFn({
			A: itemFn("A", {
				lines: [
					lineFn("first-line", {
						outcome: outputFn("B"),
					}),
					lineFn("second-line", {
						outcome: outputFn("C"),
					}),
				],
			}),
			B: itemFn("B"),
			C: itemFn("C"),
		}),
	};
	const graph = await Effect.runPromise(createProjectGraphFx());
	const result = await Effect.runPromise(
		graph.queryFx(project, {
			kind: "connections",
			from: "item:A",
		}),
	);
	expect(result.edges).toHaveLength(2);
	expect(new Set(result.edges.map((edge) => edge.id)).size).toBe(2);
	expect(new Set(result.edges.map((edge) => edge.operationId)).size).toBe(2);
	expect(new Set(result.edges.map((edge) => edge.annotations.setId)).size).toBe(2);
	expect(new Set(result.edges.map((edge) => edge.annotations.rollId)).size).toBe(2);
	expect(result.operations.map((operation) => operation.source)).toEqual([
		[
			"items",
			"A",
			"lines",
			0,
		],
		[
			"items",
			"A",
			"lines",
			1,
		],
	]);
	const capped = await Effect.runPromise(
		graph.queryFx(project, {
			kind: "node",
			from: "item:A",
			limit: 1,
		}),
	);
	expect(capped.operations).toHaveLength(1);
	expect(capped.truncated).toBe(true);
});
it("explains distinct directed occurrences and reverse traversal without inventing reverse edges", async () => {
	const project = projectFn([
		[
			"A",
			"B",
		],
		[
			"A",
			"B",
		],
		[
			"B",
			"C",
		],
	]);
	const graph = await Effect.runPromise(createProjectGraphFx());
	const query = {
		kind: "connections",
		from: "item:A",
		to: "item:B",
	};
	const direct = await Effect.runPromise(graph.queryFx(project, query));
	expect(direct.edges).toHaveLength(2);
	expect(direct.operations.map((op) => op.source)).toEqual([
		[
			"items",
			"A",
			"merge",
			0,
		],
		[
			"items",
			"A",
			"merge",
			1,
		],
	]);
	expect(direct.edges.map((edge) => edge.source)).toEqual([
		[
			"items",
			"A",
			"merge",
			0,
			"target",
			"itemUid",
		],
		[
			"items",
			"A",
			"merge",
			1,
			"target",
			"itemUid",
		],
	]);
	const reverse = await Effect.runPromise(
		graph.queryFx(project, {
			...query,
			from: "item:B",
			to: "item:A",
		}),
	);
	expect(reverse.status).toBe("no");
	const inbound = await Effect.runPromise(
		graph.queryFx(project, {
			...query,
			from: "item:B",
			to: "item:A",
			direction: "in",
		}),
	);
	expect(inbound.edges).toEqual(direct.edges);
});
