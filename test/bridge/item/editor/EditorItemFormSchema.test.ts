import { describe, expect, it } from "vitest";

import { createEditorItemFormValues } from "~/bridge/item/editor/createEditorItemFormValues";
import { EditorItemFormSchema } from "~/bridge/item/editor/EditorItemFormSchema";

const item = {
	uid: "q12cmsx5ussy30wyjiea8yaw",
	id: "item:test",
	type: "simple",
	title: "Test item",
	description: "A valid item used by the editor form schema test.",
	asset: {
		default: [
			"item-test",
		],
	},
	tags: "resource, test, era:I",
	categoryId: "resource",
	scope: "any",
	maxStackSize: 1,
} as const;

describe("EditorItemFormSchema", () => {
	it("normalizes the one raw tags field into canonical item tags", () => {
		expect(EditorItemFormSchema.parse(item).tags).toEqual([
			"resource",
			"test",
			"era:I",
		]);
	});


	it("projects canonical tags back into the one local presentation field", () => {
		const canonical = EditorItemFormSchema.parse(item);
		expect(createEditorItemFormValues(canonical).tags).toBe(
			"resource, test, era:I",
		);
	});

	it("keeps a blank required number invalid at its exact field path", () => {
		const parsed = EditorItemFormSchema.safeParse({
			...item,
			maxStackSize: Number.NaN,
		});

		expect(parsed.success).toBe(false);
		if (parsed.success) return;
		expect(
			parsed.error.issues.some((issue) => issue.path.join(".") === "maxStackSize"),
		).toBe(true);
	});
});
