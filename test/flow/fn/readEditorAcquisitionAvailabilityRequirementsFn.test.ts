import { describe, expect, it } from "vitest";

import { readEditorAcquisitionAvailabilityRequirementsFn } from "~/flow/fn/readEditorAcquisitionAvailabilityRequirementsFn";
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

describe("readEditorAcquisitionAvailabilityRequirementsFn", () => {
	it("orders non-ASCII requirement IDs by stable code units", () => {
		const requirements = readEditorAcquisitionAvailabilityRequirementsFn({
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
