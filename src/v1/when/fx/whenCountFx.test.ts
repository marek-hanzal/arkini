import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { whenCountFx } from "./whenCountFx";

describe("whenCountFx", () => {
	it("matches one exact quantity", () => {
		expect(
			Effect.runSync(
				whenCountFx({
					count: 3,
					quantity: 3,
				}),
			),
		).toBe(true);
		expect(
			Effect.runSync(
				whenCountFx({
					count: 3,
					quantity: 2,
				}),
			),
		).toBe(false);
	});
});
