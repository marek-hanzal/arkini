import { describe, expect, it } from "vitest";

import { searchEditorItemsFn } from "~/item-authoring/domain/fn/searchEditorItemsFn";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";

const item = (id: string, title: string) =>
	({
		description: `${title} description`,
		id,
		title,
		type: "simple",
		uid: id,
	}) as ItemSchema.Type;

describe("searchEditorItemsFn", () => {
	it("uses deterministic Unicode casing for exact matches", () => {
		const dottedUppercaseI = item("dotted", "İTEM");
		const ascii = item("ascii", "ITEM");

		expect(
			searchEditorItemsFn(
				[
					ascii,
					dottedUppercaseI,
				],
				"i\u0307tem",
			),
		).toEqual([
			dottedUppercaseI,
		]);
	});
});
