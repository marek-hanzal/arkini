import { describe, expect, it } from "vitest";

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
	scope: "any",
	maxStackSize: 1,
} as const;

describe("EditorItemFormSchema", () => {
	it("emits the canonical item without presentation-only form fields", () => {
		expect(EditorItemFormSchema.parse(item)).toEqual(item);
	});

	it("keeps a blank required number invalid at its exact field path", () => {
		const parsed = EditorItemFormSchema.safeParse({
			...item,
			maxStackSize: Number.NaN,
		});

		expect(parsed.success).toBe(false);
		if (parsed.success) return;
		expect(parsed.error.issues.some((issue) => issue.path.join(".") === "maxStackSize")).toBe(
			true,
		);
	});
});
