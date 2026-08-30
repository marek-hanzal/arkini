import { describe, expect, it } from "vitest";

import { editorItemEstimateTestFixture } from "~test/estimate/fn/editorItemEstimateTestFixture";

const { estimate, graph, requirement, route } = editorItemEstimateTestFixture;

describe("estimateEditorItemsFn", () => {
	it("rejects a cyclic candidate without poisoning a valid alternative", () => {
		const result = estimate(
			graph({
				facts: [
					"root",
					"x",
					"target",
				],
				roots: [
					"root",
				],
				routes: [
					route({
						durationMs: 1,
						id: "cycle-target",
						output: "target",
						allOf: [
							requirement("x"),
						],
					}),
					route({
						durationMs: 1,
						id: "cycle-x",
						output: "x",
						allOf: [
							requirement("target"),
						],
					}),
					route({
						durationMs: 20,
						id: "valid-target",
						output: "target",
						allOf: [
							requirement("root"),
						],
					}),
				],
			}),
		);

		expect(result).toMatchObject({
			durationMs: 20,
			obtainable: true,
			route: {
				routeId: "valid-target",
			},
		});
		expect(result.diagnostics).toContainEqual({
			factIds: [
				"target",
				"x",
				"target",
			],
			kind: "cycle",
			routeId: "cycle-target",
		});
	});

	it("rejects a nested cyclic route without hiding its slower complete alternative", () => {
		const result = estimate(
			graph({
				facts: [
					"x",
					"target",
				],
				roots: [],
				routes: [
					route({
						allOf: [
							requirement("x"),
						],
						durationMs: 1,
						id: "make-target",
						output: "target",
					}),
					route({
						allOf: [
							requirement("target"),
						],
						durationMs: 1,
						id: "a-cyclic-x",
						output: "x",
					}),
					route({
						durationMs: 20,
						id: "z-complete-x",
						output: "x",
					}),
				],
			}),
		);

		expect(result).toMatchObject({
			durationMs: 21,
			obtainable: true,
		});
		if (!result.obtainable) throw new Error("Expected nested complete route.");
		expect(result.routeSteps.find(({ factId }) => factId === "x")?.routeId).toBe(
			"z-complete-x",
		);
	});

	it("returns route diagnostics when every path is unreachable", () => {
		const result = estimate(
			graph({
				facts: [
					"missing",
					"target",
				],
				roots: [],
				routes: [
					route({
						durationMs: 10,
						id: "dead-end",
						output: "target",
						allOf: [
							requirement("missing"),
						],
					}),
				],
			}),
		);

		expect(result).toMatchObject({
			factId: "target",
			obtainable: false,
		});
	});

	it("keeps bounded-state overflow ahead of the diagnostic display limit", () => {
		const result = estimate(
			graph({
				facts: [
					"target",
				],
				roots: [],
				routes: [
					...Array.from(
						{
							length: 8,
						},
						(_, index) =>
							route({
								durationMs: 1,
								id: `a${index}-zero-yield`,
								output: "target",
								quantityDistribution: [
									{
										probability: 1,
										quantity: 0,
									},
								],
							}),
					),
					route({
						durationMs: 1,
						id: "z-unsupported",
						operation: {
							id: "unsupported-operation",
							inputs: [],
							outputCompilation: "state-space-unsupported",
						},
						output: "target",
					}),
				],
			}),
		);

		expect(result).toMatchObject({
			obtainable: false,
			status: "partial",
		});
		expect(result.diagnostics).toHaveLength(8);
		expect(result.diagnostics[0]).toEqual({
			kind: "joint-output-accounting-unsupported",
			reason: "state-space",
			routeId: "z-unsupported",
		});
	});

	it("uses stable route identity to break complete-duration ties", () => {
		const result = estimate(
			graph({
				facts: [
					"root",
					"target",
				],
				roots: [
					"root",
				],
				routes: [
					route({
						durationMs: 10,
						id: "z-route",
						output: "target",
						allOf: [
							requirement("root"),
						],
					}),
					route({
						durationMs: 10,
						id: "a-route",
						output: "target",
						allOf: [
							requirement("root"),
						],
					}),
				],
			}),
		);

		expect(result).toMatchObject({
			obtainable: true,
			route: {
				routeId: "a-route",
			},
		});
	});
});
