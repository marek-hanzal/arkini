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

	it("selects globally compatible sibling routes against one finite root pool", () => {
		const result = estimate(
			graph({
				facts: [
					"raw",
					"a",
					"b",
					"target",
				],
				roots: [
					{
						factId: "raw",
						quantity: 1,
					},
				],
				routes: [
					route({
						allOf: [
							requirement("raw"),
						],
						durationMs: 0,
						id: "a-fast",
						output: "a",
					}),
					route({
						durationMs: 11,
						id: "a-slow",
						output: "a",
					}),
					route({
						allOf: [
							requirement("raw"),
						],
						durationMs: 0,
						id: "b-fast",
						output: "b",
					}),
					route({
						durationMs: 13,
						id: "b-slow",
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
			}),
		);

		expect(result).toMatchObject({
			durationMs: 11,
			obtainable: true,
		});
		if (!result.obtainable) throw new Error("Expected a globally compatible witness.");
		expect(result.requirementSummary.consumed.filter(({ factId }) => factId === "raw")).toEqual(
			[
				{
					factId: "raw",
					quantity: 1,
				},
			],
		);
		expect(
			result.routeSteps.map(({ factId, routeId }) => ({
				factId,
				routeId,
			})),
		).toEqual([
			{
				factId: "target",
				routeId: "make-target",
			},
			{
				factId: "a",
				routeId: "a-slow",
			},
			{
				factId: "b",
				routeId: "b-fast",
			},
		]);
	});

	it("keeps bounded route states distinct for every valid exact route ID", () => {
		const bChoiceKey = "route\u0000B";
		const aFastRouteId = `P\u0002${bChoiceKey}\u0001Q`;
		const bFastRouteId = `Q\u0002${bChoiceKey}\u0001R`;
		const result = estimate(
			graph({
				facts: [
					"raw",
					"A",
					"B",
					"target",
				],
				roots: [
					{
						factId: "raw",
						quantity: 1,
					},
				],
				routes: [
					route({
						allOf: [
							requirement("raw"),
						],
						durationMs: 0,
						id: aFastRouteId,
						output: "A",
					}),
					route({
						allOf: [
							requirement("raw"),
						],
						durationMs: 100,
						id: "P",
						output: "A",
					}),
					route({
						allOf: [
							requirement("raw"),
						],
						durationMs: 0,
						id: bFastRouteId,
						output: "B",
					}),
					route({
						durationMs: 1,
						id: "R",
						output: "B",
					}),
					route({
						allOf: [
							requirement("A"),
							requirement("B"),
						],
						durationMs: 0,
						id: "make-target",
						output: "target",
					}),
				],
			}),
		);

		expect(result).toMatchObject({
			durationMs: 1,
			obtainable: true,
		});
		if (!result.obtainable) throw new Error("Expected collision-free route selection.");
		expect(result.routeSteps.find(({ factId }) => factId === "A")?.routeId).toBe(aFastRouteId);
		expect(result.routeSteps.find(({ factId }) => factId === "B")?.routeId).toBe("R");
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
