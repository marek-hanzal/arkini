import { describe, expect, it } from "vitest";

import { editorItemEstimateTestFixture } from "~test/estimate/fn/editorItemEstimateTestFixture";

const { estimate, graph, requirement, route } = editorItemEstimateTestFixture;

describe("estimateEditorItemsFn", () => {
	it("selects a nested route by optimistic critical-path duration", () => {
		const result = estimate(
			graph({
				facts: [
					"root",
					"a",
					"b",
					"x",
					"target",
				],
				roots: [
					"root",
				],
				routes: [
					route({
						allOf: [
							requirement("root"),
						],
						durationMs: 100,
						id: "make-a",
						output: "a",
					}),
					route({
						allOf: [
							requirement("root"),
						],
						durationMs: 100,
						id: "make-b",
						output: "b",
					}),
					route({
						allOf: [
							requirement("a"),
							requirement("b"),
						],
						durationMs: 0,
						id: "parallel-x",
						output: "x",
					}),
					route({
						durationMs: 150,
						id: "direct-x",
						output: "x",
					}),
					route({
						allOf: [
							requirement("x"),
						],
						durationMs: 0,
						id: "make-target",
						output: "target",
					}),
				],
			}),
		);

		expect(result).toMatchObject({
			durationMs: 100,
			obtainable: true,
		});
		if (!result.obtainable) throw new Error("Expected parallel nested route.");
		expect(result.routeSteps.find(({ factId }) => factId === "x")).toMatchObject({
			routeId: "parallel-x",
		});
	});

	it("selects one complete alternative in an any-of requirement", () => {
		const result = estimate(
			graph({
				facts: [
					"root",
					"slow",
					"fast",
					"target",
				],
				roots: [
					"root",
				],
				routes: [
					route({
						durationMs: 300,
						id: "make-slow",
						output: "slow",
						allOf: [
							requirement("root"),
						],
					}),
					route({
						durationMs: 20,
						id: "make-fast",
						output: "fast",
						allOf: [
							requirement("root"),
						],
					}),
					route({
						anyOf: [
							[
								requirement("slow"),
								requirement("fast"),
							],
						],
						durationMs: 5,
						id: "make-target",
						output: "target",
					}),
				],
			}),
		);

		expect(result).toMatchObject({
			durationMs: 25,
			obtainable: true,
		});
		if (result.obtainable) expect(result.route.requirements[0]?.acquisitionFactId).toBe("fast");
	});

	it("rejects an OR alternative that can only recur through the active target", () => {
		const result = estimate(
			graph({
				facts: [
					"root",
					"a",
					"x",
					"target",
				],
				roots: [
					"root",
				],
				routes: [
					route({
						allOf: [
							requirement("target"),
						],
						durationMs: 0,
						id: "make-a",
						output: "a",
					}),
					route({
						allOf: [
							requirement("root"),
						],
						durationMs: 10,
						id: "make-x",
						output: "x",
					}),
					route({
						anyOf: [
							[
								requirement("a"),
								requirement("x"),
							],
						],
						durationMs: 0,
						id: "make-target",
						output: "target",
					}),
				],
			}),
		);

		expect(result).toMatchObject({
			durationMs: 10,
			obtainable: true,
		});
		if (!result.obtainable) throw new Error("Expected external OR branch.");
		expect(result.route.requirements[0]?.acquisitionFactId).toBe("x");
	});
});
