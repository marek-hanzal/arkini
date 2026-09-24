import { Effect } from "effect";
import { expect, it } from "vitest";
import { createProjectGraphFx } from "~/graph/fx/createProjectGraphFx";
import {
	configFn,
	itemFn,
	lineFn,
	outputFn,
	queryFn,
} from "../fn/compileGraphFactsFn.test/fixtures";
import { projectFn } from "./createProjectGraphFx.test/fixtures";

it("exposes fractional authored seconds without evaluating timing rules or leaking cached records", async () => {
	const graph = await Effect.runPromise(createProjectGraphFx());
	const project = {
		...projectFn([]),
		config: configFn({
			A: itemFn("A", {
				clock: {
					intervalMs: 250,
					durationMs: 1250,
					enable: false,
				},
				lines: [
					lineFn("line", {
						runtimeMs: 1500,
						enable: false,
						outcome: outputFn("B"),
						rules: [
							{
								type: "runtime:adjust",
								adjustMs: -250,
								when: [
									{
										type: "exists",
										query: queryFn("B"),
									},
								],
							},
						],
					}),
					lineFn("instant"),
				],
			}),
			B: itemFn("B", {
				clock: {
					durationMs: 500,
				},
			}),
			C: itemFn("C"),
		}),
	};
	const query = {
		kind: "operations",
		owner: "item:A",
	};
	const result = await Effect.runPromise(graph.discoveryFx(project, query));
	expect(
		result.operations.find((op) => op.kind === "line" && op.lineUid === "line"),
	).toMatchObject({
		runtimeMs: 1500,
		runtimeSeconds: 1.5,
	});
	expect(
		result.operations.find((op) => op.kind === "line" && op.lineUid === "instant"),
	).toMatchObject({
		runtimeSeconds: 0,
	});
	expect(result.operations.find((op) => op.kind === "clock")).toMatchObject({
		intervalSeconds: 0.25,
		durationSeconds: 1.25,
		enable: false,
	});
	expect(result.nodes.find((node) => node.id === "item:A")?.clock).toEqual({
		intervalSeconds: 0.25,
		durationSeconds: 1.25,
	});
	const filtered = await Effect.runPromise(
		graph.discoveryFx(project, {
			kind: "operations",
			filter: {
				runtimeSeconds: {
					gt: 1,
					lt: 2,
				},
			},
		}),
	);
	expect(filtered.operations.map((op) => op.title)).toEqual([
		"line",
	]);
	const clocks = await Effect.runPromise(
		graph.discoveryFx(project, {
			kind: "operations",
			filter: {
				intervalSeconds: {
					max: 0.25,
				},
				durationSeconds: {
					min: 1.25,
				},
			},
		}),
	);
	expect(clocks.operations.map((op) => op.owner)).toEqual([
		"item:A",
	]);
	const connections = await Effect.runPromise(
		graph.discoveryFx(project, {
			kind: "connections",
			from: "item:A",
			kinds: [
				"rule-reference",
			],
		}),
	);
	expect(connections.edges[0].metadata.adjustSeconds).toBe(-0.25);
	const search = await Effect.runPromise(
		graph.discoveryFx(project, {
			kind: "search",
			query: "B",
		}),
	);
	expect(search.nodes.find((node) => node.id === "item:B")?.clock).toEqual({
		durationSeconds: 0.5,
	});
	const untimed = await Effect.runPromise(
		graph.discoveryFx(project, {
			kind: "search",
			query: "C",
		}),
	);
	expect(untimed.nodes.find((node) => node.id === "item:C")).not.toHaveProperty("clock");
	const line = result.operations.find((op) => op.kind === "line" && op.lineUid === "line")!;
	Object.assign(line, {
		runtimeSeconds: 999,
	});
	Object.assign(result.nodes.find((node) => node.id === "item:A")!.clock!, {
		durationSeconds: 999,
	});
	Object.assign(search.nodes.find((node) => node.id === "item:B")!.clock!, {
		durationSeconds: 999,
	});
	const again = await Effect.runPromise(graph.discoveryFx(project, query));
	expect(
		again.operations.find((op) => op.kind === "line" && op.lineUid === "line"),
	).toMatchObject({
		runtimeSeconds: 1.5,
	});
	expect(again.nodes.find((node) => node.id === "item:A")?.clock?.durationSeconds).toBe(1.25);
	const searchAgain = await Effect.runPromise(
		graph.discoveryFx(project, {
			kind: "search",
			query: "B",
		}),
	);
	expect(searchAgain.nodes.find((node) => node.id === "item:B")?.clock?.durationSeconds).toBe(
		0.5,
	);
});
