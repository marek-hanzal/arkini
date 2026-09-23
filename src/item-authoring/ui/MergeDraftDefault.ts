import type { MergeSchema } from "~/item-merge/schema/MergeSchema";

/** Default cloned by item forms when adding one merge contract. */
export const MergeDraftDefault = {
	target: {
		type: "item",
		itemUid: "",
	},
	action: "use",
	effect: "keep",
} satisfies MergeSchema.Type;
