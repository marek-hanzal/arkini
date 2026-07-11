import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { whenRangeFx } from "~/v1/when/fx/whenRangeFx";

describe("whenRangeFx", () => {
	it("includes both range boundaries", () => {
		expect(
			Effect.runSync(
				whenRangeFx({
					max: 4,
					min: 2,
					quantity: 2,
				}),
			),
		).toBe(true);
		expect(
			Effect.runSync(
				whenRangeFx({
					max: 4,
					min: 2,
					quantity: 4,
				}),
			),
		).toBe(true);
		expect(
			Effect.runSync(
				whenRangeFx({
					max: 4,
					min: 2,
					quantity: 5,
				}),
			),
		).toBe(false);
	});
});
