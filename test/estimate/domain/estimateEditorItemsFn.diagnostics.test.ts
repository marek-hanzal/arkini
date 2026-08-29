import { describe, expect, it } from "vitest";

import { editorItemEstimateTestFixture } from "~test/estimate/domain/editorItemEstimateTestFixture";

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
	});

	it("diagnoses a dependency cycle when no authored start can reach it", () => {
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
						id: "cycle-target",
						output: "target",
					}),
					route({
						allOf: [
							requirement("target"),
						],
						durationMs: 1,
						id: "cycle-x",
						output: "x",
					}),
				],
			}),
		);

		expect(result).toMatchObject({
			obtainable: false,
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

	it("does not reuse a cycle failure outside its blocking ancestor path", () => {
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
							requirement("x"),
						],
						durationMs: 1,
						id: "a-via-x",
						output: "a",
					}),
					route({
						allOf: [
							requirement("root"),
						],
						durationMs: 10,
						id: "a-via-root",
						output: "a",
					}),
					route({
						allOf: [
							requirement("a"),
						],
						durationMs: 1,
						id: "x-via-a",
						output: "x",
					}),
					route({
						allOf: [
							requirement("a"),
							requirement("x"),
						],
						durationMs: 1,
						id: "make-target",
						output: "target",
					}),
				],
			}),
		);

		expect(result).toMatchObject({
			durationMs: 12,
			obtainable: true,
		});
	});

	it("does not freeze finite-root production on a cyclic witness", () => {
		const result = estimate(
			graph({
				facts: [
					"a",
					"b",
					"c",
					"root",
				],
				roots: [
					{
						factId: "a",
						quantity: 1,
					},
					"root",
				],
				routes: [
					route({
						allOf: [
							requirement("a", "consume"),
						],
						durationMs: 1,
						id: "make-b",
						output: "b",
					}),
					route({
						allOf: [
							requirement("root", "consume"),
						],
						durationMs: 1,
						id: "make-c",
						output: "c",
					}),
					route({
						allOf: [
							requirement("b", "consume"),
						],
						durationMs: 1,
						id: "a-fast-cycle",
						output: "a",
					}),
					route({
						allOf: [
							requirement("c", "consume"),
						],
						durationMs: 10,
						id: "a-slow-complete",
						output: "a",
					}),
				],
			}),
			"a",
			2,
		);

		expect(result).toMatchObject({
			durationMs: 11,
			obtainable: true,
			route: {
				rootQuantity: 1,
				routeId: "a-slow-complete",
			},
		});
	});

	it("allows a seeded retained cycle without inventing a production dependency", () => {
		const result = estimate(
			graph({
				facts: [
					"a",
					"b",
				],
				roots: [
					{
						factId: "a",
						quantity: 1,
					},
				],
				routes: [
					route({
						allOf: [
							requirement("a", "one-time"),
						],
						durationMs: 1,
						id: "make-b",
						output: "b",
					}),
					route({
						allOf: [
							requirement("b", "one-time"),
						],
						durationMs: 1,
						id: "make-a",
						output: "a",
					}),
				],
			}),
			"a",
			2,
		);

		expect(result).toMatchObject({
			durationMs: 2,
			obtainable: true,
			route: {
				rootQuantity: 1,
				routeId: "make-a",
			},
		});
	});

	it("does not freeze finite-root production on an underseeded retained self route", () => {
		const result = estimate(
			graph({
				facts: [
					"a",
					"root",
				],
				roots: [
					{
						factId: "a",
						quantity: 1,
					},
					"root",
				],
				routes: [
					route({
						allOf: [
							requirement("a", "one-time", 2),
						],
						durationMs: 1,
						id: "a-fast-underseeded",
						output: "a",
					}),
					route({
						allOf: [
							requirement("root", "consume"),
						],
						durationMs: 10,
						id: "a-slow-complete",
						output: "a",
					}),
				],
			}),
			"a",
			2,
		);

		expect(result).toMatchObject({
			durationMs: 10,
			obtainable: true,
			route: {
				rootQuantity: 1,
				routeId: "a-slow-complete",
			},
		});
	});

	it("does not treat an underseeded finite dependency as a complete witness", () => {
		const result = estimate(
			graph({
				facts: [
					"a",
					"b",
					"root",
				],
				roots: [
					{
						factId: "b",
						quantity: 1,
					},
					"root",
				],
				routes: [
					route({
						allOf: [
							requirement("b", "one-time", 2),
						],
						durationMs: 1,
						id: "a-fast-underseeded-dependency",
						output: "a",
					}),
					route({
						allOf: [
							requirement("root", "consume"),
						],
						durationMs: 10,
						id: "a-slow-complete",
						output: "a",
					}),
				],
			}),
			"a",
		);

		expect(result).toMatchObject({
			durationMs: 10,
			obtainable: true,
			route: {
				routeId: "a-slow-complete",
			},
		});
	});

	it("retries dependents after selecting production for an already reachable finite root", () => {
		const result = estimate(
			graph({
				facts: [
					"a",
					"z",
				],
				roots: [
					{
						factId: "z",
						quantity: 1,
					},
				],
				routes: [
					route({
						allOf: [
							requirement("z", "one-time", 2),
						],
						durationMs: 1,
						id: "make-a",
						output: "a",
					}),
					route({
						durationMs: 1,
						id: "replenish-z",
						output: "z",
					}),
				],
			}),
			"a",
		);

		expect(result).toMatchObject({
			durationMs: 2,
			obtainable: true,
			route: {
				routeId: "make-a",
			},
		});
	});

	it("returns partial when larger demand outgrows the scalar unit witness", () => {
		const result = estimate(
			graph({
				facts: [
					"b",
					"root",
					"target",
				],
				roots: [
					{
						factId: "b",
						quantity: 1,
					},
					"root",
				],
				routes: [
					route({
						allOf: [
							requirement("b", "consume"),
						],
						durationMs: 1,
						id: "fast-unit-witness",
						output: "target",
					}),
					route({
						allOf: [
							requirement("root", "consume"),
						],
						durationMs: 10,
						id: "slow-quantity-route",
						output: "target",
					}),
				],
			}),
			"target",
			2,
		);

		expect(result).toMatchObject({
			obtainable: false,
			status: "partial",
		});
		expect(result.diagnostics).toContainEqual({
			factId: "target",
			kind: "quantity-specific-route-not-retried",
			quantity: 2,
			routeId: "fast-unit-witness",
		});
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
		expect(result.diagnostics).toContainEqual({
			factId: "missing",
			kind: "unreachable",
			quantity: 1,
			routeId: "dead-end",
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
