import type { ItemSchema } from "~/item-definition/schema/ItemSchema";

interface CreateDraftFnProps {
	readonly draft?: boolean;
	readonly resourceId: string;
	readonly uid: string;
}

/** Creates the canonical starting shape shared by UI and MCP. */
export const createDraftFn = ({
	draft = false,
	resourceId,
	uid,
}: CreateDraftFnProps): ItemSchema.Type => {
	return {
		uid,
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
