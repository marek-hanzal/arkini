import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { isExpectedPlacementDeliveryBlockFx } from "~/engine/placement/read/isExpectedPlacementDeliveryBlockFx";
import { PlacementFailureReasonEnumSchema } from "~/engine/placement/schema/PlacementFailureReasonEnumSchema";

describe("isExpectedPlacementDeliveryBlock", () => {
	it("classifies every current placement delivery failure exhaustively", () => {
		expect(
			PlacementFailureReasonEnumSchema.options.map((reason) =>
				Effect.runSync(isExpectedPlacementDeliveryBlockFx(reason)),
			),
		).toEqual([
			true,
			false,
			true,
			true,
			true,
		]);
	});
});
