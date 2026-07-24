import { describe, expect, it } from "vitest";

import { isExpectedPlacementDeliveryBlock } from "~/engine/placement/read/isExpectedPlacementDeliveryBlock";
import { PlacementFailureReasonEnumSchema } from "~/engine/placement/schema/PlacementFailureReasonEnumSchema";

describe("isExpectedPlacementDeliveryBlock", () => {
	it("classifies every current placement delivery failure exhaustively", () => {
		expect(
			PlacementFailureReasonEnumSchema.options.map(isExpectedPlacementDeliveryBlock),
		).toEqual([
			true,
			true,
			true,
			true,
		]);
	});
});
