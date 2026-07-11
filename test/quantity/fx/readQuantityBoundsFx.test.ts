import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readQuantityBoundsFx } from "~/v1/quantity/fx/readQuantityBoundsFx";

describe("readQuantityBoundsFx", () => {
	it("reads one fixed quantity as equal bounds", () => {
		expect(
			Effect.runSync(
				readQuantityBoundsFx({
					quantity: {
						type: "value",
						value: 3,
					},
				}),
			),
		).toEqual({
			min: 3,
			max: 3,
		});
	});

	it("preserves one inclusive quantity range", () => {
		expect(
			Effect.runSync(
				readQuantityBoundsFx({
					quantity: {
						type: "range",
						min: 2,
						max: 5,
					},
				}),
			),
		).toEqual({
			min: 2,
			max: 5,
		});
	});
});
