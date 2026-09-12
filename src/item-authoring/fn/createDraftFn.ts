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
	const itemId = requestedItemId ?? "item:new-item";
	return {
		uid,
		id: itemId,
		title: "",
		draft,
		asset: {
			scale: 1,
			default: [
				resourceId,
			] as [
				string,
			],
		},
		scope: "any" as const,
		maxStackSize: 1,
		lines: [],
		maxQueueSize: 1,
	};
};
