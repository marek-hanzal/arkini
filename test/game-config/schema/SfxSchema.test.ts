import { describe, expect, it } from "vitest";

import { SfxSchema } from "~/game-config/schema/SfxSchema";

describe("SfxSchema", () => {
	it("accepts exact gameplay and presentation events as assignment keys", () => {
		expect(
			SfxSchema.parse({
				events: {
					"item-detail:opened": "detail-open",
					"job:started": "job-start",
				},
			}),
		).toEqual({
			events: {
				"item-detail:opened": "detail-open",
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
