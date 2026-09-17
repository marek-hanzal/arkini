import { describe, expect, it } from "vitest";

import { readAcquisitionAvailabilityRequirementsFn } from "~/flow/fn/readAcquisitionAvailabilityRequirementsFn";
import { createSimpleItem } from "~test/game-config-validation/support/gameValidationTestSource";
import type { WhenSchema } from "~/production-condition/schema/WhenSchema";

const exists = (itemId: string): WhenSchema.Type => ({
	query: {
		scope: "universe",
		selector: {
			itemId,
			type: "item",
		},
	},
	type: "exists",
});

describe("readAcquisitionAvailabilityRequirementsFn", () => {
	it("projects a configured Limit threshold and retains Disable as a negative condition", () => {
		const items = {
			capped: {
				...createSimpleItem("capped"),
				maxCount: 3,
			},
		};
		const when = [
			{
				type: "limit" as const,
				itemId: "capped",
			},
		];
		expect(
			readAcquisitionAvailabilityRequirementsFn({
				items,
				rules: [
					{
						type: "enable",
						when,
					},
				],
				source: "line-condition",
			}),
		).toEqual({
			allOf: [
				{
					factId: "capped",
					quantity: 3,
					source: "line-condition",
					usage: "ongoing",
				},
			],
			anyOf: [],
		});
		expect(
			readAcquisitionAvailabilityRequirementsFn({
				items,
				rules: [
					{
						type: "disable",
						when,
					},
				],
				source: "output-condition",
			}),
		).toEqual({
			allOf: [],
			anyOf: [],
			unsupported: [
				{
					factId: "capped",
					reason: "negative-condition",
					source: "output-condition",
				},
			],
		});
	});

	it("orders non-ASCII requirement IDs by stable code units", () => {
		const requirements = readAcquisitionAvailabilityRequirementsFn({
			items: {},
			rules: [
				{
					type: "enable",
					when: [
						exists("ä-item"),
						exists("z-item"),
					],
				},
			],
			source: "line-condition",
		});

		expect(requirements.allOf.map(({ factId }) => factId)).toEqual([
			"z-item",
			"ä-item",
		]);
	});
});
