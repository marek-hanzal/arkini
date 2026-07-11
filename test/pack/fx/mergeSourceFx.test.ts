import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { mergeSourceFx } from "~/v1/pack/fx/mergeSourceFx";

describe("mergeSourceFx", () => {
	it("merges items and categories with ordinary object spreads", async () => {
		const merged = await Effect.runPromise(
			mergeSourceFx([
				{
					version: "1.0",
					categories: {
						material: {
							id: "material",
							title: "Materials",
						},
					},
				},
				{
					items: {},
				},
			]),
		);

		expect(merged).toEqual({
			version: "1.0",
			categories: {
				material: {
					id: "material",
					title: "Materials",
				},
			},
			items: {},
		});
	});
});
