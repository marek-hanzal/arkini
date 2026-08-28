import { describe, expect, it } from "vitest";

import { editorItemEstimateMaximumQuantity } from "~/editor/estimator/EditorItemEstimateQuantitySchema";

import { editorItemEstimateTestFixture } from "~test/editor/estimator/editorItemEstimateTestFixture";

const { estimate, graph, requirement, route } = editorItemEstimateTestFixture;

describe("estimateEditorItemFx", () => {
	it("bounds public requests before building an estimate policy", () => {
		const quantity = editorItemEstimateMaximumQuantity + 1;
		const result = estimate(
			graph({
				facts: [
					"target",
				],
				roots: [],
				routes: [],
			}),
			"target",
			quantity,
		);

		expect(result).toMatchObject({
			diagnostics: [
				{
					factId: "target",
					kind: "quantity-limit-exceeded",
					maximumQuantity: editorItemEstimateMaximumQuantity,
					quantity,
					source: "request",
				},
			],
			status: "partial",
		});
	});

	it("reports oversized authored dependency demand as partial", () => {
		const quantity = editorItemEstimateMaximumQuantity + 1;
		const result = estimate(
			graph({
				facts: [
					"root",
					"material",
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
						durationMs: 1,
						id: "make-material",
						output: "material",
						quantityDistribution: [
							{
								probability: 0.5,
								quantity: 0,
							},
							{
								probability: 0.5,
								quantity: 1,
							},
						],
					}),
					route({
						allOf: [
							requirement("material", "consume", quantity),
						],
						durationMs: 1,
						id: "make-target",
						output: "target",
					}),
				],
			}),
		);

		expect(result).toMatchObject({
			diagnostics: [
				{
					factId: "material",
					kind: "quantity-limit-exceeded",
					maximumQuantity: editorItemEstimateMaximumQuantity,
					quantity,
					source: "authored-demand",
				},
			],
			status: "partial",
		});
	});

	it("selects an acquisition route by its complete upstream duration", () => {
		const result = estimate(
			graph({
				facts: [
					"root",
					"expensive-infrastructure",
					"cheap-infrastructure",
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
						durationMs: 1_200,
						id: "build-expensive",
						output: "expensive-infrastructure",
					}),
					route({
						allOf: [
							requirement("root"),
						],
						durationMs: 100,
						id: "build-cheap",
						output: "cheap-infrastructure",
					}),
					route({
						allOf: [
							requirement("expensive-infrastructure", "one-time"),
						],
						durationMs: 5,
						id: "locally-fast",
						output: "target",
					}),
					route({
						allOf: [
							requirement("cheap-infrastructure", "one-time"),
						],
						durationMs: 30,
						id: "complete-route-fast",
						output: "target",
					}),
				],
			}),
		);
		expect(result).toMatchObject({
			durationMs: 130,
			obtainable: true,
			route: {
				routeId: "complete-route-fast",
			},
		});
	});

	it("requires every AND sibling and runs independent branches in parallel", () => {
		const result = estimate(
			graph({
				facts: [
					"root",
					"a",
					"b",
					"target",
				],
				roots: [
					"root",
				],
				routes: [
					route({
						durationMs: 120,
						id: "make-a",
						output: "a",
						allOf: [
							requirement("root"),
						],
					}),
					route({
						durationMs: 120,
						id: "make-b",
						output: "b",
						allOf: [
							requirement("root"),
						],
					}),
					route({
						allOf: [
							requirement("a"),
							requirement("b"),
						],
						durationMs: 10,
						id: "make-target",
						output: "target",
					}),
				],
			}),
		);

		expect(result).toMatchObject({
			durationMs: 130,
			obtainable: true,
		});
	});

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
