import { describe, expect, it } from "vitest";

import type { EditorAcquisitionRequirement } from "~/flow/type/EditorAcquisitionGraph";
import { editorItemEstimateTestFixture } from "~test/estimate/domain/editorItemEstimateTestFixture";

const { estimate, graph, requirement, route } = editorItemEstimateTestFixture;

describe("estimateEditorItemsFn requirement projection", () => {
	it("keeps one-time infrastructure independent of output runs", () => {
		const result = estimate(
			graph({
				facts: [
					"deposit",
					"target",
				],
				roots: [],
				routes: [
					route({
						durationMs: 50,
						id: "acquire-deposit",
						output: "deposit",
					}),
					route({
						allOf: [
							requirement("deposit", "one-time"),
						],
						durationMs: 2,
						id: "use-deposit",
						output: "target",
					}),
				],
			}),
			"target",
			10,
		);

		expect(result).toMatchObject({
			durationMs: 70,
			obtainable: true,
		});
		if (!result.obtainable) throw new Error("Expected complete route.");
		expect(result.routeSteps.find(({ factId }) => factId === "deposit")?.quantity).toBe(1);
	});

	it("uses finite authored quantity before estimating the remaining yield", () => {
		const result = estimate(
			graph({
				facts: [
					"target",
				],
				roots: [
					{
						factId: "target",
						quantity: 1,
					},
				],
				routes: [
					route({
						durationMs: 10,
						id: "make-target",
						output: "target",
					}),
				],
			}),
			"target",
			3,
		);

		expect(result).toMatchObject({
			durationMs: 20,
			obtainable: true,
			route: {
				actionRuns: 2,
				quantity: 3,
				rootQuantity: 1,
			},
		});
	});

	it("acquires positive enable prerequisites without evaluating rule truth", () => {
		const enableRequirement: EditorAcquisitionRequirement = {
			factId: "condition",
			quantity: 1,
			source: "line-condition",
			usage: "one-time",
		};
		const result = estimate(
			graph({
				facts: [
					"condition",
					"owner",
					"target",
				],
				roots: [
					"owner",
				],
				routes: [
					route({
						durationMs: 20,
						id: "make-condition",
						output: "condition",
					}),
					route({
						allOf: [
							requirement("owner", "one-time"),
							enableRequirement,
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
		if (!result.obtainable) throw new Error("Expected complete route.");
		expect(result.route.requirements).toContainEqual(
			expect.objectContaining({
				factId: "condition",
				usage: "one-time",
			}),
		);
	});
});
