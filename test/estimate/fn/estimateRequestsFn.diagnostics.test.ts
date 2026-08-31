import { describe, expect, it } from "vitest";

import { itemEstimateTestFixture } from "~test/estimate/fn/itemEstimateTestFixture";

const { estimate, graph, requirement, route } = itemEstimateTestFixture;

describe("estimateRequestsFn", () => {
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
		const sideOptionFactIds = Array.from(
			{
				length: 8,
			},
			(_, index) => [
				`side-${index}-a`,
				`side-${index}-b`,
			],
		).flat();
		const result = estimate(
			graph({
				facts: [
					...sideOptionFactIds,
					"side",
					"x",
					"target",
				],
				roots: sideOptionFactIds,
				routes: [
					route({
						allOf: [
							requirement("x"),
							requirement("side"),
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
					route({
						anyOf: Array.from(
							{
								length: 8,
							},
							(_, index) => [
								requirement(`side-${index}-a`),
								requirement(`side-${index}-b`),
							],
						),
						durationMs: 0,
						id: "make-side",
						output: "side",
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

	it("returns partial when an alternate witness exceeds bounded authored demand", () => {
		const result = estimate(
			graph({
				facts: [
					"x",
					"y",
					"target",
				],
				roots: [
					{
						factId: "x",
						quantity: 1,
					},
					{
						factId: "y",
						quantity: 4_000,
					},
				],
				routes: [
					route({
						anyOf: Array.from(
							{
								length: 3,
							},
							() => [
								requirement("x"),
								requirement("y", "consume", 4_000),
							],
						),
						durationMs: 0,
						id: "make-target",
						output: "target",
					}),
				],
			}),
		);

		expect(result).toMatchObject({
			diagnostics: [
				{
					factId: "y",
					kind: "quantity-limit-exceeded",
					maximumQuantity: 10_000,
					quantity: 12_000,
					source: "authored-demand",
				},
			],
			obtainable: false,
			status: "partial",
		});
	});

	it("keeps a complete deterministic witness without enumerating independent route combinations", () => {
		const inputFactIds = Array.from(
			{
				length: 13,
			},
			(_, index) => `input-${index}`,
		);
		const result = estimate(
			graph({
				facts: [
					...inputFactIds,
					"target",
				],
				roots: [],
				routes: [
					...inputFactIds.flatMap((factId) => [
						route({
							durationMs: 1,
							id: `a-${factId}`,
							output: factId,
						}),
						route({
							durationMs: 1,
							id: `b-${factId}`,
							output: factId,
						}),
					]),
					route({
						allOf: inputFactIds.map((factId) => requirement(factId)),
						durationMs: 0,
						id: "complex-target",
						output: "target",
					}),
					route({
						durationMs: 100,
						id: "direct-target",
						output: "target",
					}),
				],
			}),
		);

		expect(result).toMatchObject({
			diagnostics: [],
			durationMs: 1,
			obtainable: true,
			status: "complete",
		});
		if (!result.obtainable) throw new Error("Expected the deterministic complete witness.");
		expect(result.route.routeId).toBe("complex-target");
		expect(
			result.routeSteps
				.filter(({ factId }) => factId.startsWith("input-"))
				.map(({ routeId }) => routeId),
		).toEqual(
			[
				...inputFactIds,
			]
				.sort()
				.map((factId) => `a-${factId}`),
		);
	});

	it("repairs a finite-root conflict with the faster complete witness", () => {
		const inputFactIds = Array.from(
			{
				length: 5,
			},
			(_, index) => `input-${index}`,
		);
		const result = estimate(
			graph({
				facts: [
					"raw",
					...inputFactIds,
					"target",
				],
				roots: [
					{
						factId: "raw",
						quantity: 1,
					},
				],
				routes: [
					...inputFactIds.flatMap((factId) => [
						route({
							allOf: [
								requirement("raw"),
							],
							durationMs: 0,
							id: `fast-${factId}`,
							output: factId,
						}),
						route({
							durationMs: 10,
							id: `slow-${factId}`,
							output: factId,
						}),
					]),
					route({
						allOf: inputFactIds.map((factId) => requirement(factId)),
						durationMs: 0,
						id: "complex-target",
						output: "target",
					}),
					route({
						durationMs: 100,
						id: "direct-target",
						output: "target",
					}),
				],
			}),
		);

		expect(result).toMatchObject({
			diagnostics: [],
			durationMs: 10,
			obtainable: true,
			status: "complete",
		});
		if (!result.obtainable) throw new Error("Expected the complete global witness.");
		expect(result.route.routeId).toBe("complex-target");
	});

	it("keeps a complete route when bounded refinement rejects another route", () => {
		const inputFactIds = Array.from(
			{
				length: 5,
			},
			(_, index) => `input-${index}`,
		);
		const result = estimate(
			graph({
				facts: [
					"raw",
					...inputFactIds,
					"target",
				],
				roots: [
					{
						factId: "raw",
						quantity: 1,
					},
				],
				routes: [
					...inputFactIds.flatMap((factId) => [
						route({
							allOf: [
								requirement("raw"),
							],
							durationMs: 0,
							id: `fast-${factId}`,
							output: factId,
						}),
						route({
							allOf: [
								requirement("raw"),
							],
							durationMs: 10,
							id: `slow-${factId}`,
							output: factId,
						}),
					]),
					route({
						allOf: inputFactIds.map((factId) => requirement(factId)),
						durationMs: 0,
						id: "complex-target",
						output: "target",
					}),
					route({
						durationMs: 100,
						id: "direct-target",
						output: "target",
					}),
				],
			}),
		);

		expect(result).toMatchObject({
			diagnostics: [
				{
					kind: "witness-search-exhausted",
					maximumStates: 8,
					routeId: "complex-target",
				},
			],
			durationMs: 100,
			obtainable: true,
			status: "complete",
		});
		if (!result.obtainable) throw new Error("Expected the complete fallback route.");
		expect(result.route.routeId).toBe("direct-target");
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
