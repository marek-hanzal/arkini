import { describe, expect, it } from "vitest";

import { SfxSchema } from "~/game-config/schema/SfxSchema";

describe("SfxSchema", () => {
	it("accepts only exact committed gameplay events as assignment keys", () => {
		expect(
			SfxSchema.parse({
				events: {
					"job:started": "job-start",
				},
			}),
		).toEqual({
			events: {
				"job:started": "job-start",
			},
		});
		expect(
			SfxSchema.safeParse({
				events: {
					"unknown:event": "unknown",
				},
			}).success,
		).toBe(false);
	});
});
