import { describe, expect, it } from "vitest";

import type { EditorAcquisitionGraph } from "~/flow/type/EditorAcquisitionGraph";

import { editorItemEstimateTestFixture } from "~test/estimate/fn/editorItemEstimateTestFixture";

const { estimate, graph, requirement, route } = editorItemEstimateTestFixture;

describe("estimateEditorItemsFn", () => {
	it("acquires consumed and concurrently retained same-fact quantities separately", () => {
		const dependencyGraph: EditorAcquisitionGraph = {
			factIds: [
				"tool",
				"target",
			],
			limitations: [],
			roots: [
				{
					factId: "tool",
					quantity: 2,
				},
			],
			routes: [
				route({
					allOf: [
						requirement("tool", "consume"),
						requirement("tool", "ongoing"),
					],
					durationMs: 1,
					id: "use-and-keep",
					output: "target",
				}),
			],
		};
		const result = estimate(dependencyGraph);
		expect(result).toMatchObject({
			obtainable: true,
		});
	});

	it("reuses a root prerequisite across parallel siblings", () => {
		const dependencyGraph = graph({
			facts: [
				"tool",
				"a",
				"b",
				"target",
			],
			roots: [],
			routes: [
				route({
					allOf: [
						requirement("tool"),
					],
					durationMs: 1,
					id: "make-a",
					output: "a",
				}),
				route({
					allOf: [
						requirement("tool", "one-time"),
					],
					durationMs: 1,
					id: "make-b",
					output: "b",
				}),
				route({
					allOf: [
						requirement("a"),
						requirement("b"),
					],
					durationMs: 1,
					id: "make-target",
					output: "target",
				}),
			],
		});
		const result = estimate({
			...dependencyGraph,
			roots: [
				{
					factId: "tool",
					quantity: 1,
				},
			],
		});

		expect(result).toMatchObject({
			durationMs: 2,
			obtainable: true,
		});
	});

	it("spends one finite root pool across sibling demands and produces only the shared deficit", () => {
		const dependencyGraph = graph({
			facts: [
				"seed",
				"raw",
				"a",
				"b",
				"target",
			],
			roots: [
				"seed",
			],
			routes: [
				route({
					allOf: [
						requirement("seed"),
					],
					durationMs: 10,
					id: "make-raw",
					output: "raw",
				}),
				route({
					allOf: [
						requirement("raw", "consume", 2),
					],
					durationMs: 0,
					id: "make-a",
					output: "a",
				}),
				route({
					allOf: [
						requirement("raw", "consume", 2),
					],
					durationMs: 0,
					id: "make-b",
					output: "b",
				}),
				route({
					allOf: [
						requirement("a"),
						requirement("b"),
					],
					durationMs: 0,
					id: "make-target",
					output: "target",
				}),
			],
		});
		const result = estimate({
			...dependencyGraph,
			roots: [
				...dependencyGraph.roots,
				{
					factId: "raw",
					quantity: 2,
				},
			],
		});

		expect(result).toMatchObject({
			durationMs: 20,
			obtainable: true,
		});
	});
});
