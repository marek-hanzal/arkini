import type { ItemSchema } from "~/item-definition/schema/ItemSchema";

interface CreateDraftFnProps {
	readonly draft?: boolean;
	readonly itemId?: string;
	readonly resourceId: string;
	readonly uid: string;
}

/** Creates the canonical starting shape shared by UI and MCP. */
export const createDraftFn = ({
	draft = false,
	itemId: requestedItemId,
	resourceId,
	uid,
}: CreateDraftFnProps): ItemSchema.Type => {
	const itemId = requestedItemId ?? "";
	return {
		uid,
		id: itemId,
		title: "",
		draft,
		ui: "simple",
		artwork: {
			scale: 1,
			default: [
				resourceId,
			] as [
				string,
			],
		},
		lines: [],
		maxQueueSize: 1,
	};
};
