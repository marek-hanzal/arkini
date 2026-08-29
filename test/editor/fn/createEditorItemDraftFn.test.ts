import { describe, expect, it } from "vitest";

import { createEditorItemDraftFn } from "~/editor/fn/createEditorItemDraftFn";
import { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { TypeSchema } from "~/engine/item/schema/TypeSchema";

describe("createEditorItemDraftFn", () => {
	it.each(TypeSchema.options)("creates one schema-valid %s draft", (type) => {
		const draft = createEditorItemDraftFn({
			resourceId: "asset:first",
			type,
			uid: `draft-${type}`,
		});

		expect(
			ItemSchema.safeParse({
				...draft,
				description: `A new ${type} item.`,
				title: `New ${type}`,
			}).success,
		).toBe(true);
		expect(draft).toMatchObject({
			asset: {
				default: [
					"asset:first",
				],
			},
			type,
			uid: `draft-${type}`,
		});
	});

	it("owns specialized starting defaults", () => {
		const create = (type: TypeSchema.Type) =>
			createEditorItemDraftFn({
				resourceId: "asset:first",
				type,
				uid: `draft-${type}`,
			});

		expect(create("producer")).toMatchObject({
			lines: [
				expect.objectContaining({
					default: true,
					runtimeMs: 0,
				}),
			],
			maxQueueSize: 1,
		});
		expect(create("inventory")).toMatchObject({
			maxCount: 1,
			maxStackSize: 1,
			scope: "board",
		});
		expect(create("temporary")).toMatchObject({
			durationMs: 500,
			maxStackSize: 1,
			scope: "board",
		});
	});
});
