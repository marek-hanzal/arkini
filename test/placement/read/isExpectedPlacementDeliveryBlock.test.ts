import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { PlacementUnavailableError } from "~/engine/placement/error/PlacementUnavailableError";
import { isExpectedPlacementDeliveryBlockFx } from "~/engine/placement/read/isExpectedPlacementDeliveryBlockFx";

describe("isExpectedPlacementDeliveryBlock", () => {
	it("classifies every current placement delivery failure exhaustively", () => {
		expect(
			Object.values(PlacementUnavailableError.Reason).map((reason) =>
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
