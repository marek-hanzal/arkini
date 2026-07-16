import { describe, expect, it } from "vitest";

import { MetaSchema } from "~/engine/meta/schema/MetaSchema";

describe("MetaSchema", () => {
	it("requires explicit positive dimensions for both the board and inventory grids", () => {
		const meta = {
			id: "arkini",
			title: "Arkini",
			board: {
				width: 7,
				height: 11,
			},
			inventory: {
				width: 7,
				height: 7,
			},
		};

		expect(MetaSchema.safeParse(meta).success).toBe(true);
		expect(
			MetaSchema.safeParse({
				...meta,
				inventory: {
					...meta.inventory,
					width: 0,
				},
			}).success,
		).toBe(false);
	});
});
