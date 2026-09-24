import type { ItemSchema } from "~/item-definition/schema/ItemSchema";

interface CreateDraftFnProps {
	readonly resourceUid: string;
	readonly uid: string;
}

/** Creates the canonical starting shape shared by UI and MCP. */
export const createDraftFn = ({ resourceUid, uid }: CreateDraftFnProps): ItemSchema.Type => {
	return {
		uid,
		title: "",
		ui: "simple",
		artwork: {
			scale: 1,
			default: [
				resourceUid,
			] as [
				string,
			],
		},
		lines: [],
		maxQueueSize: 1,
	};
};
