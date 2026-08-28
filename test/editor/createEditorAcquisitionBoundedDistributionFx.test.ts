import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createEditorAcquisitionBoundedDistributionFx } from "~/editor/createEditorAcquisitionBoundedDistributionFx";

describe("createEditorAcquisitionBoundedDistributionFx", () => {
	it("merges duplicate states and enforces the exact raw state boundary", () => {
		const capability = Effect.runSync(createEditorAcquisitionBoundedDistributionFx());
		const merged = Effect.runSync(
			capability.normalizeFx([
				{
					probability: 0.25,
					quantities: new Map([
						[
							"ore",
							1,
						],
					]),
				},
				{
					probability: 0.25,
					quantities: new Map([
						[
							"ore",
							1,
						],
					]),
				},
			]),
		);
		expect(merged).toEqual([
			{
				probability: 1,
				quantities: new Map([
					[
						"ore",
						1,
					],
				]),
			},
		]);

		const states = Array.from(
			{
				length: 4_096,
			},
			(_, index) => ({
				probability: 1,
				quantities: new Map([
					[
						"ore",
						index + 1,
					],
				]),
			}),
		);
		expect(
			Effect.runSync(
				capability.mixFx([
					{
						distribution: states,
						probability: 1,
					},
				]),
			),
		).toHaveLength(4_096);
		expect(
			Effect.runSync(
				capability.mixFx([
					{
						distribution: [
							...states,
							{
								probability: 1,
								quantities: new Map([
									[
										"ore",
										4_097,
									],
								]),
							},
						],
						probability: 1,
					},
				]),
			),
		).toBeUndefined();
	});
});
