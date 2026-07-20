import type { LineSchema } from "~/engine/line/schema/LineSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";

type LineOwnerItem = Extract<
	RuntimeItemSchema.Type["item"],
	{
		readonly type: "blueprint" | "craft" | "producer" | "stash";
	}
>;

/** Reads the canonical authored lines owned by one line-capable item. */
export const readLineOwnerLines = (item: LineOwnerItem): readonly LineSchema.Type[] =>
	item.type === "producer"
		? item.lines
		: [
				item.line,
			];
