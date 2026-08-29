import { describe, expect, it } from "vitest";

import { PlacementUnavailableError } from "~/engine/placement/error/PlacementUnavailableError";
import { isExpectedPlacementDeliveryBlockFn } from "~/engine/placement/read/fn/isExpectedPlacementDeliveryBlockFn";

describe("isExpectedPlacementDeliveryBlock", () => {
	it("classifies every current placement delivery failure exhaustively", () => {
		expect(
			Object.values(PlacementUnavailableError.Reason).map((reason) =>
				isExpectedPlacementDeliveryBlockFn(reason),
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
