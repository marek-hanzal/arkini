import type { MergeSchema } from "~/item-merge/schema/MergeSchema";

/** Default cloned by item forms when adding one merge contract. */
export const EditorItemMergeDraftDefault = {
	target: {
		type: "item",
		itemId: "",
	},
	action: "use",
	effect: "keep",
} satisfies MergeSchema.Type;
