import { describe, expect, it } from "vitest";

import { createEstimateTopologyFn } from "~/estimate/fn/createEstimateTopologyFn";

import { editorItemEstimateTestFixture } from "~test/estimate/fn/editorItemEstimateTestFixture";

const { graph, requirement, route } = editorItemEstimateTestFixture;

describe("createEstimateTopologyFn", () => {
	it("keeps component identity and seeded projection independent of insertion order", () => {
		const factIds = [
			"cycle-z",
			"self",
			"dag-b",
			"disconnected",
			"cycle-a",
			"dag-a",
		];
		const routes = [
			route({
				allOf: [
					requirement("cycle-a"),
				],
				durationMs: 1,
				id: "cycle-z:a",
				output: "cycle-z",
			}),
			route({
				allOf: [
					requirement("dag-b"),
				],
				durationMs: 1,
				id: "dag-a:b",
				output: "dag-a",
			}),
			route({
				allOf: [
					requirement("self"),
				],
				durationMs: 1,
				id: "self:self",
				output: "self",
			}),
			route({
				allOf: [
					requirement("cycle-z"),
				],
				durationMs: 1,
				id: "cycle-a:z",
				output: "cycle-a",
			}),
		];
		const readTopologyFn = (reverse: boolean) =>
			createEstimateTopologyFn(
				graph({
					facts: reverse
						? [
								...factIds,
							].reverse()
						: factIds,
					roots: [
						"cycle-z",
						"dag-b",
						"self",
					],
					routes: reverse
						? [
								...routes,
							].reverse()
						: routes,
				}),
			);

		const expectedComponentEntries = [
			[
				"cycle-a",
				"cycle-a",
			],
			[
				"cycle-z",
				"cycle-a",
			],
			[
				"dag-a",
				"dag-a",
			],
			[
				"dag-b",
				"dag-b",
			],
			[
				"disconnected",
				"disconnected",
			],
			[
				"self",
				"self",
			],
		];
		const expectedSeededEntries = [
			[
				"cycle-a",
				"cycle-a",
			],
			[
				"cycle-z",
				"cycle-a",
			],
			[
				"dag-b",
				"dag-b",
			],
			[
				"self",
				"self",
			],
		];
		for (const topology of [
			readTopologyFn(false),
			readTopologyFn(true),
		]) {
			expect([
				...topology.componentByFact,
			]).toEqual(expectedComponentEntries);
			expect([
				...topology.seededComponentByFact,
			]).toEqual(expectedSeededEntries);
		}
	});

	it("excludes ignored disable-condition and charge edges from component membership", () => {
		const topology = createEstimateTopologyFn(
			graph({
				facts: [
					"condition-root",
					"condition-dependent",
					"charge-root",
					"charge-dependent",
				],
				roots: [
					"condition-root",
					"charge-root",
				],
				routes: [
					route({
						anyOf: [
							[
								{
									factId: "condition-dependent",
									quantity: 1,
									source: "line-condition",
									usage: "ongoing",
								},
							],
						],
						durationMs: 1,
						id: "condition-edge",
						output: "condition-root",
					}),
					route({
						allOf: [
							requirement("condition-root"),
						],
						durationMs: 1,
						id: "condition-back-edge",
						output: "condition-dependent",
					}),
					route({
						chargeUses: [
							{
								accounting: "single-payer-exact",
								payerFactId: "charge-dependent",
								usableActionRuns: 1,
							},
						],
						durationMs: 1,
						id: "charge-edge",
						output: "charge-root",
					}),
					route({
						allOf: [
							requirement("charge-root"),
						],
						durationMs: 1,
						id: "charge-back-edge",
						output: "charge-dependent",
					}),
				],
			}),
		);

		expect(topology.seededComponentByFact.get("condition-root")).toBeDefined();
		expect(topology.seededComponentByFact.get("charge-root")).toBeDefined();
		expect(topology.seededComponentByFact.get("condition-dependent")).toBeUndefined();
		expect(topology.seededComponentByFact.get("charge-dependent")).toBeUndefined();
	});
});
